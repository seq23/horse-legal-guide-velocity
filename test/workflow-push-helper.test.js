// Every bot commit in .github/workflows reaches main through
// scripts/ops/push_with_retry.sh, never a bare `git push`.
//
// 30 Oct 2026, Approved Content Email run 41071059217 went red because its
// bare `git push` met one GitHub 500 (`[remote rejected] main -> main
// (Internal Server Error)`). The retrying helper already existed, but only two
// of fourteen committing workflows called it: nothing made the others use it.
// This test is that guard.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const workflowsDir = path.join(repoRoot, '.github', 'workflows');
const HELPER = 'bash scripts/ops/push_with_retry.sh';

function workflows() {
  return fs.readdirSync(workflowsDir)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => {
      const lines = fs.readFileSync(path.join(workflowsDir, name), 'utf8').split('\n');
      // Comment lines are prose, not commands.
      const code = lines.map((line, i) => ({ line, n: i + 1 })).filter(({ line }) => !/^\s*#/.test(line));
      return { name, code };
    });
}

test('no workflow pushes with a bare git push', () => {
  const all = workflows();
  assert.ok(all.length > 0, 'no workflow files found - the guard examined nothing');
  const bare = [];
  for (const { name, code } of all) {
    for (const { line, n } of code) {
      if (/\bgit\s+push\b/.test(line)) bare.push(`${name}:${n}: ${line.trim()}`);
    }
  }
  assert.deepEqual(bare, [], `bare git push found; use ${HELPER} <remote> <refspec>:\n${bare.join('\n')}`);
});

test('every workflow that commits pushes through the helper, once per commit', () => {
  const committing = [];
  let helperCalls = 0;
  for (const { name, code } of workflows()) {
    const commits = code.filter(({ line }) => /\bgit\s+commit\b/.test(line)).length;
    const helpers = code.filter(({ line }) => line.includes(HELPER)).length;
    helperCalls += helpers;
    if (commits > 0) {
      committing.push(name);
      assert.ok(helpers >= commits, `${name}: ${commits} git commit(s) but only ${helpers} push_with_retry call(s)`);
    }
  }
  // Hard-fail on zero items: 14 workflows commit to main today.
  assert.ok(committing.length >= 14, `expected >= 14 committing workflows, found ${committing.length}: ${committing.join(', ')}`);
  assert.ok(helperCalls >= 23, `expected >= 23 push_with_retry calls, found ${helperCalls}`);
});

test('helper calls always name the remote and a refspec', () => {
  for (const { name, code } of workflows()) {
    for (const { line, n } of code) {
      if (!line.includes(HELPER)) continue;
      const args = line.slice(line.indexOf(HELPER) + HELPER.length).trim();
      assert.match(args, /^origin\s+(main|HEAD:main|"\$\(git branch --show-current\)")\s*$/, `${name}:${n}: unexpected push target: ${args}`);
    }
  }
});

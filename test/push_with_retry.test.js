const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const helper = path.join(repoRoot, 'scripts', 'ops', 'push_with_retry.sh');

function runPushCase(mode, refspec = 'main') {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-push-retry-'));
  const binDir = path.join(tmp, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const countFile = path.join(tmp, 'push-count');
  const argsFile = path.join(tmp, 'push-args');
  const gitLogFile = path.join(tmp, 'git-log');
  fs.writeFileSync(countFile, '0');

  const fakeGit = `#!/usr/bin/env bash
set -u
printf '%s\\n' "$*" >> "$GIT_LOG_FILE"
case "\${1:-}" in
  push) ;;
  fetch)
    exit 0
    ;;
  rebase)
    if [ "\${2:-}" = "--abort" ]; then exit 0; fi
    if [ "$PUSH_MODE" = "rebase_conflict" ]; then
      echo "CONFLICT (content): Merge conflict in data/x.json" >&2
      exit 1
    fi
    exit 0
    ;;
  *)
    echo "unexpected git command: $*" >&2
    exit 99
    ;;
esac
count="$(cat "$PUSH_COUNT_FILE")"
count=$((count + 1))
printf '%s' "$count" > "$PUSH_COUNT_FILE"
printf '%s\\n' "$*" >> "$PUSH_ARGS_FILE"
case "$PUSH_MODE" in
  internal_server_error_then_success)
    if [ "$count" -eq 1 ]; then
      echo "remote: Internal Server Error" >&2
      echo "! [remote rejected] main -> main (Internal Server Error)" >&2
      echo "error: failed to push some refs" >&2
      exit 1
    fi
    echo "Everything up-to-date"
    exit 0
    ;;
  network_then_success)
    if [ "$count" -eq 1 ]; then
      echo "fatal: unable to access repository: Could not resolve host: github.com" >&2
      exit 128
    fi
    exit 0
    ;;
  internal_server_error_always)
    echo "remote: Internal Server Error" >&2
    echo "! [remote rejected] main -> main (Internal Server Error)" >&2
    exit 1
    ;;
  non_fast_forward_then_success)
    if [ "$count" -eq 1 ]; then
      echo " ! [rejected]        main -> main (fetch first)" >&2
      echo "hint: Updates were rejected because the remote contains work that you do not" >&2
      exit 1
    fi
    exit 0
    ;;
  rebase_conflict)
    echo " ! [rejected]        main -> main (non-fast-forward)" >&2
    exit 1
    ;;
  permission_denied)
    echo "remote: Permission to seq23/horse-legal-guide-velocity.git denied to github-actions[bot]." >&2
    echo "fatal: unable to access repository: The requested URL returned error: 403" >&2
    exit 128
    ;;
  *)
    echo "unknown PUSH_MODE=$PUSH_MODE" >&2
    exit 98
    ;;
esac
`;
  const gitPath = path.join(binDir, 'git');
  fs.writeFileSync(gitPath, fakeGit, { mode: 0o755 });

  const result = spawnSync('bash', [helper, 'origin', refspec], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      PUSH_MODE: mode,
      PUSH_COUNT_FILE: countFile,
      PUSH_ARGS_FILE: argsFile,
      GIT_LOG_FILE: gitLogFile,
      PUSH_RETRY_ATTEMPTS: '3',
      PUSH_RETRY_DELAY_SECONDS: '0',
    },
  });

  return {
    ...result,
    pushCount: Number(fs.readFileSync(countFile, 'utf8')),
    gitLog: fs.existsSync(gitLogFile) ? fs.readFileSync(gitLogFile, 'utf8').trim().split('\n') : [],
    pushArgs: fs.existsSync(argsFile) ? fs.readFileSync(argsFile, 'utf8').trim().split('\n') : [],
  };
}

test('retries a GitHub 500 and succeeds without changing push target', () => {
  const result = runPushCase('internal_server_error_then_success');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.pushCount, 2);
  assert.deepEqual(result.pushArgs, ['push origin main', 'push origin main']);
  assert.match(result.stderr, /transient git\/GitHub transport failure/);
  assert.match(result.stderr, /push succeeded on attempt 2\/3/);
});

test('retries a transient network failure', () => {
  const result = runPushCase('network_then_success');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.pushCount, 2);
});

test('does not retry permission or authentication failures', () => {
  const result = runPushCase('permission_denied');
  assert.equal(result.status, 128);
  assert.equal(result.pushCount, 1);
  assert.match(result.stderr, /403/);
  assert.match(result.stderr, /non-retryable git push failure/);
  assert.match(result.stderr, /NAMED_FAILURE: GIT_PUSH_FAILED cause=non_retryable/);
});

test('a GitHub 500 that persists exhausts the bounded attempts and fails non-zero, naming the cause', () => {
  const result = runPushCase('internal_server_error_always');
  assert.notEqual(result.status, 0);
  assert.equal(result.pushCount, 3);
  assert.match(result.stderr, /NAMED_FAILURE: GIT_PUSH_FAILED cause=transient_server_error .*attempt=3\/3/);
});

test('a non-fast-forward rejection fetches, rebases onto the target branch and pushes again', () => {
  const result = runPushCase('non_fast_forward_then_success', 'HEAD:main');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.pushCount, 2);
  assert.deepEqual(result.gitLog, [
    'push origin HEAD:main',
    'fetch origin main',
    'rebase --autostash FETCH_HEAD',
    'push origin HEAD:main',
  ]);
  assert.match(result.stderr, /non-fast-forward/);
});

test('a rebase conflict aborts the rebase, pushes nothing more and fails non-zero', () => {
  const result = runPushCase('rebase_conflict');
  assert.equal(result.status, 1);
  assert.equal(result.pushCount, 1);
  assert.deepEqual(result.gitLog, ['push origin main', 'fetch origin main', 'rebase --autostash FETCH_HEAD', 'rebase --abort']);
  assert.match(result.stderr, /NAMED_FAILURE: GIT_PUSH_FAILED cause=rebase_conflict/);
});

test('an empty branch name (detached HEAD) is refused rather than defaulting to main', () => {
  const result = runPushCase('internal_server_error_then_success', '');
  assert.equal(result.status, 2);
  assert.equal(result.pushCount, 0);
  assert.match(result.stderr, /cause=usage/);
});

// 1 Nov 2026, Approved Content Email run 41320735301: the build had rewritten
// tracked files the commit step does not stage, main moved during the run, and
// the rebase refused the dirty tree ("cannot rebase: You have unstaged
// changes"), exiting 128 with no NAMED_FAILURE. Real git, no fake.
test('main moving while the build left unstaged tracked changes still rebases, pushes and keeps the changes', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-push-dirty-'));
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const ident = ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid'];
  const remote = path.join(tmp, 'remote.git');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', remote);
  const seed = path.join(tmp, 'seed');
  git(tmp, 'clone', '-q', remote, seed);
  fs.writeFileSync(path.join(seed, 'state.json'), '{}\n');
  fs.writeFileSync(path.join(seed, 'built.html'), 'v1\n');
  git(seed, 'add', '.');
  git(seed, ...ident, 'commit', '-q', '-m', 'seed');
  git(seed, 'push', '-q', 'origin', 'HEAD:main');
  const runner = path.join(tmp, 'runner');
  git(tmp, 'clone', '-q', remote, runner);
  // Another workflow pushes to main mid-run.
  fs.writeFileSync(path.join(seed, 'other.json'), '{"x":1}\n');
  git(seed, 'add', '.');
  git(seed, ...ident, 'commit', '-q', '-m', 'other workflow');
  git(seed, 'push', '-q', 'origin', 'HEAD:main');
  // The runner's build rewrote a tracked file it will not stage; it commits only state.
  fs.writeFileSync(path.join(runner, 'built.html'), 'rebuilt\n');
  fs.writeFileSync(path.join(runner, 'state.json'), '{"sent":true}\n');
  git(runner, 'add', 'state.json');
  git(runner, ...ident, 'commit', '-q', '-m', 'record state');

  const result = spawnSync('bash', [helper, 'origin', 'main'], {
    cwd: runner,
    encoding: 'utf8',
    env: { ...process.env, PUSH_RETRY_ATTEMPTS: '2', PUSH_RETRY_DELAY_SECONDS: '0',
      GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'user.name', GIT_CONFIG_VALUE_0: 't',
      GIT_CONFIG_KEY_1: 'user.email', GIT_CONFIG_VALUE_1: 't@example.invalid' },
  });
  assert.equal(result.status, 0, result.stderr);
  const remoteLog = git(seed, 'ls-remote', remote, 'refs/heads/main').split(/\s+/)[0];
  assert.equal(remoteLog, git(runner, 'rev-parse', 'HEAD'));
  assert.equal(git(runner, 'log', '--format=%s', '-3'), 'record state\nother workflow\nseed');
  assert.equal(fs.readFileSync(path.join(runner, 'built.html'), 'utf8'), 'rebuilt\n');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const FILES = [
  'data/system/editorial_backlog.json',
  'data/system/content_calendar.json',
  'data/queries/page_targets.json',
  'data/continuity/cadence_policy.json',
];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-continuity-'));
  for (const rel of FILES) {
    const src = path.join(repoRoot, rel);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(src, path.join(root, rel));
  }
  return root;
}

function run(root, script, env = {}) {
  return spawnSync(process.execPath, [path.join(repoRoot, script)], {
    cwd: root, encoding: 'utf8', env: { ...process.env, ...env },
  });
}

// Regression for the 2026-10-19 Editorial Continuity Sidecar red: the runway
// re-drafted the same first ~7 page targets every weekly run until draft
// uniqueness self-heal hard-failed. Eight simulated weekly runs must never
// re-pick a target while unused targets remain, and the validator must pass.
// Owners' ruling, 3 Nov 2026: the search-loop engine fills the approval queue,
// so the template runway generator must add nothing while approval mode is on.
test('with search-loop approval mode on, the template runway generator adds no drafts and names the stop', () => {
  const root = fixture();
  fs.copyFileSync(path.join(repoRoot, 'search-loop.config.json'), path.join(root, 'search-loop.config.json'));
  const before = ['data/system/editorial_backlog.json', 'data/system/content_calendar.json'].map((f) => fs.readFileSync(path.join(root, f), 'utf8'));
  const r = run(root, 'scripts/continuity/replenish_editorial_runway.mjs', { CONTINUITY_RUN_DATE: '2027-01-05' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /NAMED STOP \[REPLACED_BY_SEARCH_LOOP\]/);
  const after = ['data/system/editorial_backlog.json', 'data/system/content_calendar.json'].map((f) => fs.readFileSync(path.join(root, f), 'utf8'));
  assert.deepEqual(after, before, 'backlog and calendar unchanged');
  const report = JSON.parse(fs.readFileSync(path.join(root, 'data/continuity/editorial_continuity_report.json'), 'utf8'));
  assert.equal(report.new_pending_entries, 0);
});

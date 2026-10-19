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
test('weekly continuity runs rotate through page targets without repeats', () => {
  const root = fixture();
  const targets = JSON.parse(fs.readFileSync(path.join(root, 'data/queries/page_targets.json'), 'utf8'));
  assert.ok(targets.length > 60, `need page targets to rotate through, got ${targets.length}`);
  const lastDate = JSON.parse(fs.readFileSync(path.join(root, 'data/system/editorial_backlog.json'), 'utf8'))
    .map((x) => x.date).sort().at(-1);
  // Start so the 120-day horizon reaches one week past the existing runway end.
  const start = new Date(Date.parse(lastDate + 'T00:00:00Z') - 113 * 86400000);
  const picked = {};
  let total = 0;
  for (let week = 0; week < 8; week += 1) {
    const runDate = new Date(start.getTime() + week * 7 * 86400000).toISOString().slice(0, 10);
    const r = run(root, 'scripts/continuity/replenish_editorial_runway.mjs', { CONTINUITY_RUN_DATE: runDate });
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(fs.readFileSync(path.join(root, 'data/continuity/editorial_continuity_report.json'), 'utf8'));
    assert.ok(report.new_pending_entries > 0, `week ${week}: replenisher added nothing`);
    assert.equal(report.new_entry_targets.length, report.new_pending_entries);
    for (const p of report.new_entry_targets) {
      const key = `${p.content_type}|${p.target}`;
      assert.ok(!picked[key], `week ${week}: ${key} re-picked (first ${picked[key]}, again ${p.entry_id})`);
      picked[key] = p.entry_id;
      total += 1;
    }
    const v = run(root, 'scripts/continuity/validate_editorial_continuity.mjs');
    assert.equal(v.status, 0, `week ${week}: validator failed\n${v.stdout.slice(-800)}`);
  }
  assert.ok(total >= 40, `expected >=40 new entries over 8 weeks, got ${total}`);
});

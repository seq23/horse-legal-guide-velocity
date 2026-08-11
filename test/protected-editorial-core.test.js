const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

function copyFileInto(root, rel) {
  const src = path.join(repoRoot, rel);
  const dst = path.join(root, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-protected-core-'));
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/protected_core/protected_editorial_core.json'), 'utf8'));
  const required = new Set([
    'scripts/authority_scale/validate_protected_editorial_core.mjs',
    'data/protected_core/protected_editorial_core.json',
    'data/protected_core/protected_editorial_state.json',
    'data/system/editorial_backlog.json',
    'data/system/content_calendar.json',
    ...manifest.files.map((entry) => entry.path),
  ]);
  for (const rel of required) copyFileInto(root, rel);
  return root;
}

function runValidator(root) {
  return spawnSync(process.execPath, ['scripts/authority_scale/validate_protected_editorial_core.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
}

function mutateJson(root, rel, mutator) {
  const target = path.join(root, rel);
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  mutator(data);
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
}

test('protected editorial core allows native scheduling, uniqueness, review, and publish-state movement', () => {
  const root = makeFixture();
  try {
    mutateJson(root, 'data/system/editorial_backlog.json', (rows) => {
      const row = rows[0];
      row.date = '2099-01-02';
      row.title = `${row.title} — differentiated`;
      row.slug = `${row.slug || row.entry_id}-differentiated`;
      row.github_path = `content/generated/${row.slug}.md`;
      row.notes = 'native uniqueness repair updated presentation metadata';
      row.status = 'scheduled';
      row.review_status = 'approved';
      row.publish_date = '2099-01-03';
      row.generation_validation = { ok: true, score: 100 };
    });
    mutateJson(root, 'data/system/content_calendar.json', (rows) => {
      const row = rows[0];
      row.date = '2099-01-03';
      row.status = 'scheduled';
      row.review_status = 'approved';
    });

    const result = runValidator(root);
    assert.equal(result.status, 0, `expected mutable operational fields to pass; stderr=${result.stderr}\nstdout=${result.stdout}`);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.ok, true);
    assert.deepEqual(receipt.errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('protected editorial core still hard-fails real source identity drift', () => {
  const root = makeFixture();
  try {
    let entryId;
    mutateJson(root, 'data/system/editorial_backlog.json', (rows) => {
      entryId = rows[0].entry_id;
      rows[0].source_query_title = `${rows[0].source_query_title} — unauthorized source identity drift`;
    });

    const result = runValidator(root);
    assert.notEqual(result.status, 0, 'expected immutable source identity drift to fail');
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.ok, false);
    assert.ok(receipt.errors.includes(`baseline-backlog-identity-drift:${entryId}`), JSON.stringify(receipt.errors));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

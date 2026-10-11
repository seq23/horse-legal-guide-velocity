const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');

/** Write a target_query_set.json in a fixture root that measures exactly these queries. */
function measure(root, queries) {
  const norm = (q) => String(q).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  fs.mkdirSync(path.join(root, 'data/search_intelligence'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/search_intelligence/target_query_set.json'), JSON.stringify({
    targets: queries.map((q) => ({ query: q, query_norm: norm(q), source: 'gsc_export', number: 3, unit: 'google_impressions_28d' }))
  }));
}

test('editorial renderer distinguishes two formats sharing a source topic and opening', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-meta-release-'));
  try {
    for (const rel of ['scripts', 'templates', 'data/system', 'data/queries', 'data/reference', 'data/firm']) {
      fs.cpSync(path.join(repo, rel), path.join(root, rel), { recursive: true });
    }
    const topic = 'What Happens If a Horse Sale Goes Wrong?';
    const opening = 'The practical question behind What Happens If a Horse Sale Goes Wrong is not answered by a label alone. Documents, payment, possession, and risk need separate attention.';
    const rows = [
      { entry_id: 'fixture-insight', title: 'Money, possession, and risk transfer for What Happens If a Horse Sale Goes Wrong', content_type: 'insight' },
      { entry_id: 'fixture-whitepaper', title: 'White Paper: Horse Sale & Purchase - Documentation, Risk Allocation, and Plain-English Guardrails', content_type: 'whitepaper' },
    ].map((row, i) => ({ ...row, source_query_title: topic, source_cluster: 'horse-sale-purchase', slug: `fixture-${i}`, status: 'approved', publish_date: '2026-04-30', github_path: `fixture-${i}.md` }));
    for (let i = 0; i < rows.length; i++) fs.writeFileSync(path.join(root, `fixture-${i}.md`), opening);
    fs.writeFileSync(path.join(root, 'data/system/editorial_backlog.json'), JSON.stringify(rows));
    // The publishing freeze is on (data/system/config.json), so the fixture's
    // query carries a measured number, as a real new entry must before it publishes.
    measure(root, [topic]);
    const result = spawnSync(process.execPath, ['-e', "require('./scripts/build/write_editorial_pages').writeEditorialPages('dist')"], { cwd: root, env: { ...process.env, PUBLISH_TODAY: '2026-09-29' }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const descriptions = rows.map((row) => {
      const slug = require('../scripts/build/write_editorial_pages').liveSlug(row);
      const html = fs.readFileSync(path.join(root, 'dist', slug, 'index.html'), 'utf8');
      assert.ok(html.includes(row.title.replace(/&/g, '&amp;')));
      const description = html.match(/<meta name="description" content="([^"]+)"/)[1];
      assert.ok(description.length >= 110 && description.length <= 170);
      return description;
    });
    assert.notEqual(...descriptions);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('dashboard accepts noindex 404 but still flags an indexable missing canonical', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-meta-dashboard-'));
  try {
    fs.cpSync(path.join(repo, 'scripts'), path.join(root, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist/404.html'), '<title>Page not found</title><meta name="robots" content="noindex, follow"><meta name="description" content="An error page.">');
    fs.writeFileSync(path.join(root, 'dist/index.html'), '<title>Horse Legal Guide</title><meta name="description" content="Educational horse law guidance."><link rel="canonical" href="https://horselegalguide.com/">');
    const run = () => {
      const r = spawnSync(process.execPath, ['scripts/quality/generate_seo_dashboard.js'], { cwd: root, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      return JSON.parse(fs.readFileSync(path.join(root, 'data/admin/seo_dashboard.json')));
    };
    for (let i = 0; i < 2; i++) {
      const report = run();
      assert.equal(report.metrics.rendered_public_pages, 1);
      assert.equal(report.issues.filter((x) => x.severity === 'hard_fail').length, 0);
    }
    fs.writeFileSync(path.join(root, 'dist/index.html'), '<title>Horse Legal Guide</title>');
    assert.ok(run().issues.some((x) => x.issue === 'Rendered pages missing canonical URLs' && x.severity === 'hard_fail'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('publishing freeze holds a new unmeasured editorial entry and publishes it once its query is measured', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-freeze-'));
  try {
    for (const rel of ['scripts', 'templates', 'data/system', 'data/queries', 'data/reference', 'data/firm']) {
      fs.cpSync(path.join(repo, rel), path.join(root, rel), { recursive: true });
    }
    const config = JSON.parse(fs.readFileSync(path.join(root, 'data/system/config.json'), 'utf8'));
    assert.equal(config.search_publishing_freeze, true, 'the freeze flag is on in the committed config');
    const topic = 'Can a Horse Freeze Fixture Be Measured?';
    const row = { entry_id: 'fixture-freeze', title: 'Freeze fixture: what equestrians miss about measured demand', content_type: 'insight', source_query_title: topic, source_cluster: 'horse-sale-purchase', slug: 'fixture-freeze', status: 'approved', publish_date: '2026-04-30', github_path: 'fixture-freeze.md' };
    fs.writeFileSync(path.join(root, 'fixture-freeze.md'), 'Measured demand decides what publishes. Documents, payment, possession, and risk need separate attention.');
    fs.writeFileSync(path.join(root, 'data/system/editorial_backlog.json'), JSON.stringify([row]));
    const build = () => {
      fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
      const r = spawnSync(process.execPath, ['-e', "require('./scripts/build/write_editorial_pages').writeEditorialPages('dist')"], { cwd: root, env: { ...process.env, PUBLISH_TODAY: '2026-09-29' }, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const live = JSON.parse(fs.readFileSync(path.join(root, 'dist/editorial-publishing-state.json'), 'utf8')).live_entries.map((e) => e.entry_id);
      const holds = JSON.parse(fs.readFileSync(path.join(root, 'data/search_intelligence/publish_holds.json'), 'utf8')).lanes.editorial.held.map((h) => h.entry_id);
      return { live, holds };
    };
    measure(root, ['an unrelated measured query']);
    let state = build();
    assert.deepEqual(state.live, [], 'an approved, due, unmeasured new entry must not publish');
    assert.deepEqual(state.holds, ['fixture-freeze'], 'the held entry is listed with its reason');
    measure(root, [topic]);
    state = build();
    assert.deepEqual(state.live, ['fixture-freeze'], 'the held entry publishes on the first build after its query is measured');
    assert.deepEqual(state.holds, []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

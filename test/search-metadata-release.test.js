const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');

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

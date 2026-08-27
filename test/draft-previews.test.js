/**
 * Guards on the draft review surface.
 *
 * The three properties that matter here are safety properties about unapproved
 * client legal content sitting on a public host, so they are asserted against
 * the built dist/ tree rather than against the templates that produced it: a
 * template can be right while a build step overwrites, reorders, or skips it.
 * dist/ is tracked in this repo and validate:all rebuilds before running tests,
 * so the tree under assertion is the tree that ships.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const { draftPreviewPath, draftPreviewUrl } = require('../scripts/quality/content_ops_common');

test('draftPreviewPath moves a draft slug under the operator namespace', () => {
  assert.equal(draftPreviewPath({ slug: '/drafts/2026-04-24/some-draft/' }), '/admin/drafts/2026-04-24/some-draft/');
  assert.equal(draftPreviewPath({ slug: 'drafts/2026-04-24/some-draft' }), '/admin/drafts/2026-04-24/some-draft/');
  assert.equal(draftPreviewPath({}), '');
});

test('draftPreviewUrl returns an absolute URL on the site domain', () => {
  assert.equal(
    draftPreviewUrl({ site_domain: 'https://horselegalguide.com' }, { slug: '/drafts/2026-04-24/some-draft/' }),
    'https://horselegalguide.com/admin/drafts/2026-04-24/some-draft/'
  );
});

test('draftPreviewUrl throws rather than degrading to a relative path', () => {
  // The defect this helper replaced was a relative path that looked populated
  // and resolved nowhere. Failing loudly is the point.
  assert.throws(() => draftPreviewUrl({}, { slug: '/drafts/2026-04-24/some-draft/' }), /site_domain/);
});

test('both admin generators publish the same preview_url', () => {
  const manifest = readJson('data/admin/editorial_manifest.json').items;
  const quality = readJson('data/admin/content_quality_report.json').items;
  const byId = (items) => Object.fromEntries(items.map((i) => [i.entry_id, i.preview_url]));
  assert.deepEqual(byId(manifest), byId(quality));
});

test('every manifest preview_url is absolute and resolves to a rendered page', () => {
  const items = readJson('data/admin/editorial_manifest.json').items;
  assert.ok(items.length > 0, 'manifest must not be empty');
  for (const item of items) {
    const url = item.preview_url;
    assert.ok(/^https:\/\/[^/]+\/admin\/drafts\/.+\/$/.test(url), `preview_url is not an absolute preview URL: ${url}`);
    const rendered = path.join(DIST, new URL(url).pathname, 'index.html');
    assert.ok(fs.existsSync(rendered), `no rendered preview for ${url}`);
  }
});

test('every rendered preview and the preview index are noindex', () => {
  const pages = fs.readdirSync(path.join(DIST, 'admin/drafts'), { recursive: true })
    .filter((f) => String(f).endsWith('index.html'));
  assert.ok(pages.length > 1, 'expected a preview index plus draft previews');
  for (const page of pages) {
    const html = fs.readFileSync(path.join(DIST, 'admin/drafts', page), 'utf8');
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/, `missing noindex: ${page}`);
  }
});

test('no preview URL is advertised for crawling', () => {
  // Sitemaps, indexnow batches and llms.txt are all crawl invitations. An
  // unapproved draft must not appear in any of them.
  for (const artifact of ['dist/sitemap.xml', 'dist/sitemap-pages.xml', 'dist/indexnow-batch.txt', 'dist/indexnow-priority.txt', 'dist/llms.txt']) {
    assert.doesNotMatch(read(artifact), /admin\/drafts/, `${artifact} advertises a draft preview`);
  }
});

test('no preview appears in a published page manifest', () => {
  const dir = path.join(ROOT, '.build/page-manifests');
  for (const file of fs.readdirSync(dir)) {
    assert.doesNotMatch(fs.readFileSync(path.join(dir, file), 'utf8'), /admin\/drafts/, `page manifest names a draft preview: ${file}`);
  }
});

test('the error page carries no canonical', () => {
  // A fixed self-canonical on the body served for every unknown path told
  // crawlers each of those paths was a duplicate of the error page.
  assert.doesNotMatch(read('dist/404.html'), /rel=["']canonical["']/i);
  assert.match(read('dist/404.html'), /<meta name="robots" content="noindex, follow">/);
});

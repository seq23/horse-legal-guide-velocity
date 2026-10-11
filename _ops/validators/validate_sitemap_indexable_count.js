// The sitemap advertises exactly the indexable pages: every public index.html
// that is not noindex and is self-canonical, no more and no fewer, no duplicates.
// sitemap.xml is an index; its child sitemaps are followed and must exist.
// (Measured 11 Oct 2026: the live sitemap.xml lists 1 <loc> because it is a
// sitemap index; its one child, sitemap-pages.xml, carries 323 page URLs, which
// equals the 323 indexable pages. This gate pins that equality.)
const fs = require('fs');
const path = require('path');
const { createReport } = require('./helpers');
const { publicPages, isNoindex, canonicalOf, siteOrigin, distFileFor } = require('./seo_pages');

const report = createReport('validate_sitemap_indexable_count', 'repo');
const origin = siteOrigin();
const norm = (u) => String(u).replace(/\/$/, '');
const indexFile = path.resolve(process.cwd(), 'dist/sitemap.xml');
const locs = [];
if (!fs.existsSync(indexFile)) report.addIssue({ file: 'dist/sitemap.xml', code: 'sitemap_missing', message: 'dist/sitemap.xml missing.' });
else {
  const xml = fs.readFileSync(indexFile, 'utf8');
  const children = /<sitemapindex/.test(xml) ? [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]) : null;
  const sources = children ? children.map((c) => ({ c, f: distFileFor(c) })) : [{ c: 'sitemap.xml', f: indexFile }];
  for (const { c, f } of sources) {
    if (!f || !fs.existsSync(f)) { report.addIssue({ file: 'dist/sitemap.xml', code: 'child_sitemap_missing', message: `Child sitemap ${c} is not in dist/.` }); continue; }
    locs.push(...[...fs.readFileSync(f, 'utf8').matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => norm(m[1])));
  }
}
const pages = publicPages('validate:sitemap-indexable-count');
const indexable = new Set();
for (const page of pages) {
  if (isNoindex(page.html)) continue;
  const own = norm(`${origin}${page.urlPath}`);
  const canonical = canonicalOf(page.html);
  if (canonical && norm(canonical) !== own) continue;
  indexable.add(own);
}
const listed = new Set(locs);
if (listed.size !== locs.length) report.addIssue({ file: 'dist/sitemap-pages.xml', code: 'sitemap_duplicates', message: `${locs.length - listed.size} duplicate <loc> entries.` });
if (!indexable.size) report.addIssue({ file: 'dist', code: 'no_indexable_pages', message: 'Zero indexable pages found.' });
const missing = [...indexable].filter((u) => !listed.has(u));
const extra = [...listed].filter((u) => !indexable.has(u));
if (listed.size !== indexable.size || missing.length || extra.length) report.addIssue({ file: 'dist/sitemap-pages.xml', code: 'sitemap_count_mismatch', message: `Sitemap lists ${listed.size} URLs; ${indexable.size} pages are indexable. Missing: ${missing.slice(0, 3).join(', ') || 'none'}. Extra: ${extra.slice(0, 3).join(', ') || 'none'}.`, fixHint: 'scripts/build/write_sitemaps.js must list every self-canonical, non-noindex public page.' });
report.finalize(`sitemap URL count ${listed.size} equals indexable page count ${indexable.size}.`);

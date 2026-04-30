const fs = require('fs');
const path = require('path');
const { collectFiles, createReport } = require('./helpers');

const report = createReport('validate_sitemap_page_parity', 'repo');
const sitemap = fs.readFileSync(path.resolve(process.cwd(), 'dist/sitemap-pages.xml'), 'utf8');
const normalizeUrl = (url) => String(url || '').replace(/\/$/, '');
const pageUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => normalizeUrl(m[1])));
for (const file of collectFiles('dist', (file) => file.endsWith('index.html'))) {
  const rel = file.replace(/^.*?dist[\/]/, '').replace(/[\\]/g, '/').replace(/index\.html$/, '');
  const pathPart = rel ? `/${rel}` : '/';
  const normalized = pathPart.endsWith('/') ? pathPart : `${pathPart}/`;
  const html = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  const match = html.match(/<link rel="canonical" href="([^"]+)"/i);
  const canonical = match ? match[1] : '';
  if (normalized === '/admin/') {
    continue;
  }
  if (canonical && !pageUrls.has(normalizeUrl(canonical))) {
    report.addIssue({ file, code: 'canonical_missing_from_sitemap', message: `Canonical URL is missing from sitemap-pages.xml: ${canonical}.`, fixHint: 'Ensure every public page canonical is included in the sitemap pages file.' });
  }
  if (!canonical && normalized !== '/admin/') {
    report.addIssue({ file, code: 'missing_canonical_for_parity', message: 'Page missing canonical prevents sitemap parity check.', fixHint: 'Render canonical tags before parity validation.' });
  }
}
report.finalize('Sitemap/page parity valid.');

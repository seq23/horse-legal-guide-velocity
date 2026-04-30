const fs = require('fs');
const path = require('path');
const { ensureExists, readJson, createReport } = require('./helpers');

const report = createReport('validate_crawl_contract', 'repo');
const config = readJson('data/system/config.json');
const siteDomain = String(config.site_domain || '').replace(/\/$/, '');
const robots = fs.readFileSync(ensureExists('dist/robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${siteDomain}/sitemap.xml`)) {
  report.addIssue({ file: 'dist/robots.txt', code: 'missing_canonical_sitemap', message: 'robots.txt does not point to the canonical sitemap URL.', fixHint: 'Write Sitemap: <site_domain>/sitemap.xml into robots.txt.' });
}
const home = fs.readFileSync(ensureExists('dist/index.html'), 'utf8');
for (const href of ['/faq/','/scenario/','/compare/','/reference/','/coverage/','/llms.txt','/sitemap.xml']) {
  if (!home.includes(`href="${href}"`)) {
    report.addIssue({ file: 'dist/index.html', code: 'missing_discoverability_link', message: `Homepage is missing required discoverability link ${href}.`, fixHint: 'Keep core public surfaces linked from the homepage.' });
  }
}
report.finalize('Crawl contract valid.');

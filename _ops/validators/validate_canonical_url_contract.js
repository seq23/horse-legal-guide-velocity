const fs = require('fs');
const path = require('path');
const { collectFiles, readJson, createReport } = require('./helpers');

const report = createReport('validate_canonical_url_contract', 'repo');
const config = readJson('data/system/config.json');
const siteDomain = String(config.site_domain || '').replace(/\/$/, '');
for (const file of collectFiles('dist', (file) => file.endsWith('index.html'))) {
  const html = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  const match = html.match(/<link rel="canonical" href="([^"]+)"/i);
  if (!match) {
    report.addIssue({ file, code: 'missing_canonical', message: 'Rendered page is missing canonical tag.', fixHint: 'Render a canonical tag for every public page.' });
    continue;
  }
  const canonical = match[1];
  if (!canonical.startsWith(siteDomain)) {
    report.addIssue({ file, code: 'non_absolute_or_wrong_domain_canonical', message: `Canonical URL is not absolute on the site domain: ${canonical}.`, fixHint: `Canonical should start with ${siteDomain}.` });
  }
}
report.finalize('Canonical URL contract valid.');

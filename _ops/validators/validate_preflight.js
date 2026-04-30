const fs = require('fs');
const path = require('path');
const { ensureExists, ok } = require('./helpers');

[
  'data/system/config.json',
  'data/queries/page_targets.json',
  'package.json',
  '_headers',
  '_redirects',
  'robots.txt',
  'README.md',
  '.gitignore',
  '.env.example',
  'distribution.config.json',
  'templates/partial.footer.html',
  'data/system/disclaimer_full.txt',
  'data/system/privacy_policy_full.txt',
  'distribution_scripts/indexnow_submit.sh',
  'distribution_scripts/gsc_submit_sitemaps.py',
  'distribution_scripts/gsc_inspect_urls.py'
].forEach(ensureExists);
['content','data','scripts','dist','_ops/validators','.github/workflows'].forEach((p) => ensureExists(p));
const probe = path.resolve(process.cwd(), 'dist', '.write-test');
fs.writeFileSync(probe, 'ok');
fs.unlinkSync(probe);
ok('preflight checks passed');

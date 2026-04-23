const fs = require('fs');
const { collectFiles, fail, ok } = require('./helpers');
const files = collectFiles('dist', (file) => file.endsWith('index.html'));
for (const file of files) {
  if (file.includes('/admin/') || file.includes('\\admin\\')) continue;
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('This content does not constitute legal advice or create an attorney-client relationship.')) {
    fail(`Footer disclaimer missing in ${file}`);
  }
}
ok('footer disclaimer present');

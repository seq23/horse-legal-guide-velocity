const fs = require('fs');
const { collectRequired, fail, ok } = require('./helpers');
const files = collectRequired('dist', (file) => file.endsWith('index.html'), 'validate:disclaimers');
for (const file of files) {
  if (file.includes('/admin/') || file.includes('\\admin\\') || file.includes('/agency/') || file.includes('\\agency\\')) continue;
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('This content does not constitute legal advice or create an attorney-client relationship.')) {
    fail(`Footer disclaimer missing in ${file}`);
  }
}
ok('footer disclaimer present');

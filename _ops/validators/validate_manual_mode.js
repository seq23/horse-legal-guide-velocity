const fs = require('fs');
const { collectRequired, fail, ok } = require('./helpers');
const files = collectRequired('dist', (file) => file.endsWith('index.html'), 'validate:manual');
for (const file of files) {
  if (file.replace(/\\/g, '/').includes('/dist/admin/')) continue;
  const html = fs.readFileSync(file, 'utf8').toLowerCase();
  if (html.includes('review_status') && html.includes('pending')) fail(`Pending state leaked into live output: ${file}`);
}
ok('manual mode enforced');

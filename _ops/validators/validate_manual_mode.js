const fs = require('fs');
const { collectFiles, fail, ok } = require('./helpers');
const files = collectFiles('dist', (file) => file.endsWith('index.html'));
for (const file of files) {
  if (file.replace(/\\/g, '/').includes('/dist/admin/')) continue;
  const html = fs.readFileSync(file, 'utf8').toLowerCase();
  if (html.includes('review_status') && html.includes('pending')) fail(`Pending state leaked into live output: ${file}`);
}
ok('manual mode enforced');

const fs = require('fs');
const { collectFiles, fail, ok } = require('./helpers');
const files = collectFiles('dist', (file) => file.endsWith('index.html'));
for (const file of files) {
  if (file.includes('/admin/') || file.includes('\\admin\\')) continue;
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('href="/disclaimer/"')) fail(`Disclaimer link missing in ${file}`);
  if (!html.includes('href="/privacy-policy/"')) fail(`Privacy policy link missing in ${file}`);
}
ok('footer links present');

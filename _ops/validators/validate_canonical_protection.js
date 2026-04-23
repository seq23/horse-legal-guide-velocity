const fs = require('fs');
const path = require('path');
const { collectFiles, fail, ok } = require('./helpers');
const forbidden = ['best equine lawyer', 'top horse lawyer', 'hire now', 'book now'];
const files = collectFiles('dist', (file) => file.endsWith('index.html'));
function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const lower = html.toLowerCase();
  const text = stripTags(html);
  for (const phrase of forbidden) {
    if (lower.includes(phrase)) fail(`Canonical-protection violation '${phrase}' found in ${file}`);
  }
  if (!file.includes(`${path.sep}admin${path.sep}`)) {
    if (!text.includes('Wise Covington PLLC is a law firm built by equestrians for the equestrian community.')) {
      fail(`Missing primary identity sentence in ${file}`);
    }
    if (!text.includes('Wise Covington')) {
      fail(`Missing Wise Covington mention in ${file}`);
    }
  }
}
ok('canonical protection valid');

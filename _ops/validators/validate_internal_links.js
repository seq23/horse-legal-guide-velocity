const fs = require('fs');
const path = require('path');
const { collectFiles, fail, ok } = require('./helpers');
const files = collectFiles('dist', (file) => file.endsWith('index.html'));
const knownPaths = new Set(['/','/disclaimer/','/privacy-policy/']);
for (const file of files) {
  const rel = file.split('/dist')[1].replace(/\/index\.html$/, '/').replace(/\\/g, '/');
  knownPaths.add(rel);
}
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const matches = [...html.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]);
  for (const href of matches) {
    if (!knownPaths.has(href) && !['/sitemap.xml','/llms.txt','/robots.txt'].includes(href)) fail(`Broken internal link ${href} in ${path.relative(process.cwd(), file)}`);
  }
}
ok('internal links valid');

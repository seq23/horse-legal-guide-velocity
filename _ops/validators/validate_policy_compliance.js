const fs = require('fs');
const { readJson, collectRequired, fail, ok } = require('./helpers');
const rules = readJson('data/system/compliance_rules.json');
const files = collectRequired('dist', (file) => file.endsWith('index.html'), 'validate:policy');
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8').toLowerCase();
  for (const phrase of rules.forbidden_phrases) {
    if (html.includes(phrase.toLowerCase())) fail(`Forbidden phrase '${phrase}' found in ${file}`);
  }
}
ok('policy compliance valid');

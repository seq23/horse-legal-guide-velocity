const fs = require('fs');
const path = require('path');
const { readJson, collectRequired, fail, ok } = require('./helpers');
const rules = readJson('data/system/compliance_rules.json');
const forbiddenCanonical = ['best equine lawyer', 'top horse lawyer', 'hire now', 'book now'];
const footerDisclaimer = 'This content does not constitute legal advice or create an attorney-client relationship.';
const identity = 'Wise Covington PLLC is a law firm built by equestrians for the equestrian community.';
const files = collectRequired('dist', (file) => file.endsWith('index.html'), 'validate:public-page-phrase-contract');
function stripTags(html) { return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const lower = html.toLowerCase();
  const isPrivateSurface = file.includes(`${path.sep}admin${path.sep}`) || file.includes(`${path.sep}agency${path.sep}`);
  for (const phrase of forbiddenCanonical) if (lower.includes(phrase)) fail(`Canonical-protection violation '${phrase}' found in ${file}`);
  for (const phrase of rules.forbidden_phrases || []) if (lower.includes(String(phrase).toLowerCase())) fail(`Forbidden phrase '${phrase}' found in ${file}`);
  if (!isPrivateSurface) {
    const text = stripTags(html);
    if (!html.includes(footerDisclaimer)) fail(`Footer disclaimer missing in ${file}`);
    if (!text.includes(identity)) fail(`Missing primary identity sentence in ${file}`);
    if (!text.includes('Wise Covington')) fail(`Missing Wise Covington mention in ${file}`);
  }
}
ok(`public page phrase contract valid (${files.length} rendered pages checked in one pass)`);

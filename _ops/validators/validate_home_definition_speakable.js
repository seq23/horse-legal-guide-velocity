// The home page answers "what is Horse Legal Guide" in the element directly
// after the H1 (aim 40-60 words: over never fails, under fails only below 75%
// of 40, scripts/lib/limits.js; a near miss is a non-blocking note), and every speakable cssSelector in its WebPage
// node resolves to an element on the page. Only simple selectors (tag, #id,
// .class) are accepted; anything else cannot be proven to resolve and fails.
const fs = require('fs');
const path = require('path');
const { createReport } = require('./helpers');
const { jsonLdGraph, decode } = require('./seo_pages');
const { belowFloor } = require('../../scripts/lib/limits');

const report = createReport('validate_home_definition_speakable', 'repo');
const file = 'dist/index.html';
const abs = path.resolve(process.cwd(), file);
if (!fs.existsSync(abs)) { report.addIssue({ file, code: 'home_missing', message: 'dist/index.html missing; run npm run build.' }); report.finalize(''); }
const html = fs.readFileSync(abs, 'utf8');
const m = html.match(/<\/h1>\s*<p([^>]*)>([\s\S]*?)<\/p>/i);
if (!m) report.addIssue({ file, code: 'definition_not_under_h1', message: 'No <p> directly follows the home page H1.', fixHint: 'renderIndex writes the definition paragraph straight after the H1.' });
else {
  const text = decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const words = text.split(' ').length;
  if (belowFloor(words, 40)) report.addIssue({ file, code: 'definition_word_count', message: `Definition paragraph is ${words} words (needs at least 75% of 40).` });
  else if (words < 40 || words > 60) report.addIssue({ file, severity: 'note', blocking: false, code: 'definition_word_count_note', message: `Definition paragraph is ${words} words (aim 40-60); not blocking.` });
  if (!/\bid="[^"]+"/.test(m[1])) report.addIssue({ file, code: 'definition_no_id', message: 'Definition paragraph has no id for the speakable selector to target.' });
}
const resolves = (sel) => {
  if (/^#[A-Za-z][\w-]*$/.test(sel)) return new RegExp(`<[a-z0-9]+[^>]*\\sid="${sel.slice(1)}"`, 'i').test(html);
  if (/^\.[A-Za-z][\w-]*$/.test(sel)) return new RegExp(`<[a-z0-9]+[^>]*\\sclass="[^"]*\\b${sel.slice(1)}\\b`, 'i').test(html);
  if (/^[a-z][a-z0-9]*$/i.test(sel)) return new RegExp(`<${sel}[\\s>]`, 'i').test(html.replace(/<head>[\s\S]*?<\/head>/i, ''));
  return false;
};
let graph = [];
try { graph = jsonLdGraph(html); } catch (e) { report.addIssue({ file, code: 'jsonld_unparseable', message: e.message }); }
const webPage = graph.find((n) => n['@type'] === 'WebPage');
const selectors = (webPage && webPage.speakable && webPage.speakable.cssSelector) || [];
if (!selectors.length) report.addIssue({ file, code: 'speakable_missing', message: 'Home page WebPage node has no speakable cssSelector.' });
for (const sel of selectors) if (!resolves(sel)) report.addIssue({ file, code: 'speakable_selector_unresolved', message: `Speakable selector "${sel}" matches nothing on the home page.` });
if (m && selectors.length) {
  const idMatch = m[1].match(/\bid="([^"]+)"/);
  if (idMatch && !selectors.includes(`#${idMatch[1]}`)) report.addIssue({ file, code: 'speakable_misses_definition', message: `Speakable selectors do not target the definition paragraph #${idMatch[1]}.` });
}
report.finalize(`home definition under H1 and ${selectors.length} speakable selector(s) resolve.`);

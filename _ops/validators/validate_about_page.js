// validate:about-page - /about/ is built and names the publishing law firm.
//
// Every page names Wise Covington PLLC as author and publisher in JSON-LD. On
// legal content that identification must resolve to a visible page that names
// the same firm, or the publisher claim is unverifiable (25 Oct 2026 sweep:
// /about/ was a 404). The firm name is read from the firm record, not typed in.
//
// Trimmed 10 Nov 2026 to the identification rule (hostile review of the
// validator cut); the E-E-A-T styling checks were cut.
const fs = require('fs');
const path = require('path');
const { createReport } = require('./helpers');
const { publicPages, jsonLdGraph } = require('./seo_pages');

const report = createReport('validate_about_page', 'page');
const block = (file, code, message) => report.addIssue({ file, code, message, blocking: true });
const FIRM = 'data/firm/wise_covington_contact.json';
let firmName = '';
try {
  const firm = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), FIRM), 'utf8'));
  firmName = String(firm.firm_name || firm.name || firm.legal_name || '').trim();
} catch (e) { block(FIRM, 'firm_record_unreadable', `${FIRM}: ${e.message}`); }
if (!firmName) block(FIRM, 'firm_name_missing', `${FIRM} carries no firm name to check the publisher against.`);

const pages = publicPages('validate:about-page');
if (!pages.length) block('dist', 'gate_examined_nothing', 'validate:about-page examined 0 public pages; run npm run build first.');
const about = pages.find((p) => p.urlPath === '/about/');
let publisher = '';
if (!about) {
  block('dist/about/index.html', 'about_page_missing', 'No /about/ page was built; the publisher named on every page has nowhere to be verified.');
} else {
  try {
    const org = jsonLdGraph(about.html).find((n) => n['@type'] === 'Organization');
    publisher = String((org && org.name) || '').trim();
  } catch (e) { block(about.rel, 'about_jsonld_unparseable', `/about/ JSON-LD does not parse: ${e.message}`); }
  if (!publisher) block(about.rel, 'about_publisher_unnamed', '/about/ JSON-LD names no Organization publisher.');
  if (firmName && publisher && publisher !== firmName) block(about.rel, 'publisher_not_firm', `JSON-LD publisher "${publisher}" is not the firm on record "${firmName}".`);
  if (firmName && !about.html.includes(firmName)) block(about.rel, 'about_firm_not_named', `/about/ never names "${firmName}", the firm the JSON-LD declares as publisher.`);
}
report.finalize(`/about/ built and names the publishing firm "${firmName}" that its JSON-LD names (${pages.length} public pages read).`);

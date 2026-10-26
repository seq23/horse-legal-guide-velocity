// JSON-LD types per page kind, read off the rendered pages:
//   every public page  -> Organization, WebSite, WebPage, Article, BreadcrumbList
//   every public page  -> Organization carries name, url, logo and sameAs
//   home page          -> its WebPage also carries a SpeakableSpecification
//   visible Q&A on page -> + FAQPage whose questions are exactly the visible ones
//   no visible Q&A      -> no FAQPage (nothing is invented)
// "Visible Q&A" is the same extractor renderLayout uses, so the gate and the
// writer cannot disagree about what counts.
const { createReport } = require('./helpers');
const { publicPages, jsonLdGraph } = require('./seo_pages');
const { extractVisibleFaq } = require('../../scripts/lib/render_page');

const report = createReport('validate_jsonld_page_kinds', 'repo');
// WebPage joined this list on 26 Oct 2026: the Search Readiness check (item c2)
// found it on the home page only, because write_jsonld.js emitted it solely as
// a carrier for speakable selectors. Organization's four entity properties
// (item c1) are checked here too - `logo` was missing on all 13 sampled pages.
const BASE = ['Organization', 'WebSite', 'WebPage', 'Article', 'BreadcrumbList'];
const ORG_PROPS = ['name', 'url', 'logo', 'sameAs'];
const pages = publicPages('validate:jsonld-page-kinds');
let faqPages = 0;
let home = false;
for (const page of pages) {
  let graph;
  try { graph = jsonLdGraph(page.html); } catch (e) { report.addIssue({ file: page.rel, code: 'jsonld_unparseable', message: `JSON-LD does not parse: ${e.message}` }); continue; }
  const types = new Set(graph.map((n) => n['@type']));
  for (const t of BASE) if (!types.has(t)) report.addIssue({ file: page.rel, code: 'jsonld_base_type_missing', message: `JSON-LD has no ${t} node.` });
  const org = graph.find((n) => n['@type'] === 'Organization');
  if (org) {
    const absent = ORG_PROPS.filter((k) => {
      const v = org[k];
      if (Array.isArray(v)) return !v.length;
      if (v && typeof v === 'object') return !v.url && !v.name;
      return !String(v ?? '').trim();
    });
    if (absent.length) report.addIssue({ file: page.rel, code: 'organization_property_missing', message: `Organization lacks ${absent.join(', ')}; an answer engine needs all of ${ORG_PROPS.join(', ')} to resolve the publisher as one entity.` });
  }
  const visible = extractVisibleFaq(page.html);
  const faq = graph.find((n) => n['@type'] === 'FAQPage');
  if (visible.length) {
    if (!faq) report.addIssue({ file: page.rel, code: 'faqpage_missing', message: `Page shows ${visible.length} Q&A pair(s) but has no FAQPage node.` });
    else {
      faqPages += 1;
      const names = (faq.mainEntity || []).map((q) => q.name);
      if (names.length !== visible.length || names.some((n, i) => n !== visible[i].question)) report.addIssue({ file: page.rel, code: 'faqpage_drift', message: 'FAQPage questions differ from the visible Q&A.' });
    }
  } else if (faq) report.addIssue({ file: page.rel, code: 'faqpage_without_visible_qa', message: 'FAQPage present on a page with no visible Q&A.' });
  if (page.urlPath === '/') {
    home = true;
    const webPage = graph.find((n) => n['@type'] === 'WebPage');
    const sel = webPage && webPage.speakable && webPage.speakable['@type'] === 'SpeakableSpecification' && webPage.speakable.cssSelector;
    if (!Array.isArray(sel) || !sel.length) report.addIssue({ file: page.rel, code: 'home_webpage_speakable_missing', message: 'Home page has no WebPage node with a SpeakableSpecification cssSelector list.' });
  }
}
if (!home) report.addIssue({ file: 'dist/index.html', code: 'home_not_examined', message: 'The home page was not among the pages examined.' });
if (!faqPages) report.addIssue({ file: 'dist', code: 'no_faqpage_anywhere', message: 'No page carries FAQPage; the Q&A pages have lost their schema.' });
report.finalize(`JSON-LD types match page kind on ${pages.length} public pages (${BASE.join(', ')} on each, Organization carrying ${ORG_PROPS.join('/')}; ${faqPages} with FAQPage).`);

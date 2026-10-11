// JSON-LD types per page kind, read off the rendered pages:
//   every public page  -> Organization, WebSite, Article, BreadcrumbList
//   home page          -> + WebPage carrying a SpeakableSpecification
//   visible Q&A on page -> + FAQPage whose questions are exactly the visible ones
//   no visible Q&A      -> no FAQPage (nothing is invented)
// "Visible Q&A" is the same extractor renderLayout uses, so the gate and the
// writer cannot disagree about what counts.
const { createReport } = require('./helpers');
const { publicPages, jsonLdGraph } = require('./seo_pages');
const { extractVisibleFaq } = require('../../scripts/lib/render_page');

const report = createReport('validate_jsonld_page_kinds', 'repo');
const BASE = ['Organization', 'WebSite', 'Article', 'BreadcrumbList'];
const pages = publicPages('validate:jsonld-page-kinds');
let faqPages = 0;
let home = false;
for (const page of pages) {
  let graph;
  try { graph = jsonLdGraph(page.html); } catch (e) { report.addIssue({ file: page.rel, code: 'jsonld_unparseable', message: `JSON-LD does not parse: ${e.message}` }); continue; }
  const types = new Set(graph.map((n) => n['@type']));
  for (const t of BASE) if (!types.has(t)) report.addIssue({ file: page.rel, code: 'jsonld_base_type_missing', message: `JSON-LD has no ${t} node.` });
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
report.finalize(`JSON-LD types match page kind on ${pages.length} public pages (${faqPages} with FAQPage).`);

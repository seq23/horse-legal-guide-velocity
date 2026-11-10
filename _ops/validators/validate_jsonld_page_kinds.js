// validate:jsonld-page-kinds - FAQPage schema only ever restates visible Q&A.
//
// On a legal site, schema answers that are not on the page are hidden legal
// claims. So, read off the rendered pages:
//   visible Q&A on page  -> a FAQPage whose questions are exactly the visible ones
//   no visible Q&A        -> no FAQPage (nothing is invented)
// "Visible Q&A" is the same extractor renderLayout uses, so the gate and the
// writer cannot disagree about what counts.
//
// Trimmed 10 Nov 2026 to this rule alone (hostile review of the validator cut);
// the base-type and Organization-property SEO checks were cut.
const { createReport } = require('./helpers');
const { publicPages, jsonLdGraph } = require('./seo_pages');
const { extractVisibleFaq } = require('../../scripts/lib/render_page');

const report = createReport('validate_jsonld_page_kinds', 'repo');
const pages = publicPages('validate:jsonld-page-kinds');
let faqPages = 0;
for (const page of pages) {
  let graph;
  try { graph = jsonLdGraph(page.html); } catch (e) { report.addIssue({ file: page.rel, code: 'jsonld_unparseable', message: `JSON-LD does not parse: ${e.message}` }); continue; }
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
}
if (!pages.length) report.addIssue({ file: 'dist', code: 'gate_examined_nothing', message: 'validate:jsonld-page-kinds examined 0 public pages; run npm run build first.' });
if (!faqPages) report.addIssue({ file: 'dist', code: 'no_faqpage_anywhere', message: 'No page carries FAQPage, so the visible-Q&A rule compared nothing.' });
report.finalize(`FAQPage matches visible Q&A on ${faqPages} of ${pages.length} public pages; none carries FAQPage without visible Q&A.`);

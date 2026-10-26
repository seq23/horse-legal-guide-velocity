// validate:about-page - Search Readiness Checklist item c6, read as code.
//
// "Author and publisher are real, consistent, and have an About page; E-E-A-T
// signals (credentials, sources, dates) visible." The check behind it: /about/
// answers 200 and the home page links to it.
//
// The 25 Oct 2026 sweep failed horselegalguide.com here. Every page named
// Wise Covington PLLC as its author and publisher in JSON-LD, and /about/ was
// a 404 - a publisher an engine cannot resolve is the publisher it does not
// cite. This gate keeps the page built, linked from the home page, and
// consistent with the publisher the structured data actually names.
const { createReport } = require('./helpers');
const { publicPages, jsonLdGraph } = require('./seo_pages');

const report = createReport('validate_about_page', 'page');
const pages = publicPages('validate:about-page');
const about = pages.find((p) => p.urlPath === '/about/');
const home = pages.find((p) => p.urlPath === '/');

if (!about) {
  report.addIssue({ file: 'dist/about/index.html', code: 'about_page_missing', message: 'No /about/ page was built; the publisher named on every page has nowhere to be verified.', fixHint: 'scripts/build/build_site.js writes it from scripts/lib/render_page.js renderAboutPage().', blocking: true });
} else {
  // The publisher the About page describes must be the publisher the schema
  // names, or the two drift and the entity stops resolving.
  let publisher = '';
  try {
    const graph = jsonLdGraph(about.html);
    const org = graph.find((n) => n['@type'] === 'Organization');
    publisher = String((org && org.name) || '');
  } catch (e) {
    report.addIssue({ file: about.rel, code: 'about_jsonld_unparseable', message: `/about/ JSON-LD does not parse: ${e.message}`, blocking: true });
  }
  if (publisher && !about.html.includes(publisher)) {
    report.addIssue({ file: about.rel, code: 'about_publisher_inconsistent', message: `/about/ never names "${publisher}", the Organization its own JSON-LD declares as publisher.`, fixHint: 'renderAboutPage() reads the firm record the schema reads; keep both on data/firm/wise_covington_contact.json.', blocking: true });
  }
  // E-E-A-T signals the checklist asks to be VISIBLE on the page.
  if (!/<h1[^>]*>[^<]*about/i.test(about.html)) {
    report.addIssue({ file: about.rel, code: 'about_h1_missing', message: '/about/ has no H1 naming it as the About page.', blocking: true });
  }
  if (!/<ol[\s>]/i.test(about.html)) {
    report.addIssue({ file: about.rel, code: 'about_process_not_numbered', message: '/about/ does not set out how pages are written and checked as numbered steps; the editorial process is the E-E-A-T signal an engine reads here.', blocking: true });
  }
  if (!/\b(19|20)\d{2}\b/.test(about.html)) {
    report.addIssue({ file: about.rel, code: 'about_no_date_signal', message: '/about/ shows no date; the checklist asks for visible dates among the E-E-A-T signals.', fixHint: 'The firm record\'s last_verified date is rendered with the publisher details.', blocking: true });
  }
}

if (!home) {
  report.addIssue({ file: 'dist/index.html', code: 'home_not_examined', message: 'The home page was not among the pages examined, so "the home page links to /about/" was checked against nothing.', blocking: true });
} else if (!home.html.includes('href="/about/"')) {
  report.addIssue({ file: home.rel, code: 'home_does_not_link_about', message: 'The home page does not link to /about/.', fixHint: 'templates/partial.footer.html carries the link on every page.', blocking: true });
}

// Rule 0: no stage may exit 0 having done nothing.
if (!pages.length) {
  report.addIssue({ file: 'dist', code: 'gate_examined_nothing', message: 'validate:about-page examined 0 public pages; dist/ was absent or empty. Run npm run build first.', blocking: true });
}

report.finalize(`About page present and linked (/about/ built, home page links to it, publisher consistent with its JSON-LD, across ${pages.length} public pages).`);

const fs = require('fs');
const path = require('path');
const { writeJsonLd } = require('./write_jsonld');
const { writeCanonicalTag } = require('./write_canonical_tag');

function readText(relPath) {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

function readConfig() {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/system/config.json'), 'utf8'));
}

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBrandHeader(config) {
  const shortName = htmlEscape(config.canonical_short_name || 'Wise Covington');
  const canonicalDomain = htmlEscape(config.canonical_domain || 'https://wisecovington.com');
  const tagline = htmlEscape(config.tagline_secondary || 'Legally sound. Financially stable.');
  return `<header class="site-brand-header">
  <div>
    <span class="eyebrow">Horse Legal Guide</span>
    <p class="brand-kicker">Built for the horse world</p>
  </div>
  <div class="brand-side">
    <p class="brand-firm"><a href="${canonicalDomain}">${shortName}</a></p>
    <p class="brand-tagline">${tagline}</p>
  </div>
</header>`;
}

function renderLayout({ title, description, url, body, schemaType = 'Article', includeBrandChrome = true }) {
  const config = readConfig();
  const footer = includeBrandChrome ? readText('templates/partial.footer.html') : '';
  const brandHeader = includeBrandChrome ? renderBrandHeader(config) : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)}</title>
  <meta name="description" content="${htmlEscape(description)}">
  ${writeCanonicalTag(url)}
  <script type="application/ld+json">${writeJsonLd(schemaType.toLowerCase() === 'faqpage' ? 'faq' : 'article', title, description, url)}</script>
  <style>
    :root {
      --bg: #f4efe7;
      --panel: #fbf8f3;
      --panel-strong: #f8f3ec;
      --text: #2f2a26;
      --muted: #665f57;
      --line: #d8cec0;
      --accent: #5d4634;
      --accent-soft: #8a735f;
      --shadow: 0 10px 24px rgba(41, 32, 24, 0.06);
      --radius: 16px;
      --content-width: 860px;
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); }
    body {
      margin: 0;
      background: linear-gradient(180deg, #efe8de 0%, var(--bg) 16%, #f7f3ed 100%);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.7;
      letter-spacing: 0.005em;
    }
    .page-shell {
      max-width: calc(var(--content-width) + 48px);
      margin: 0 auto;
      padding: 36px 24px 56px;
    }
    .page-card {
      background: rgba(251, 248, 243, 0.88);
      border: 1px solid rgba(216, 206, 192, 0.85);
      border-radius: 24px;
      box-shadow: var(--shadow);
      padding: 32px 28px;
      backdrop-filter: blur(3px);
    }
    header, footer, section, nav { margin-bottom: 22px; }
    section, nav, footer.site-footer {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 18px 18px 16px;
    }
    header.content-header {
      background: transparent;
      border: 0;
      padding: 0 0 8px;
      margin-bottom: 20px;
    }
    .site-brand-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      background: rgba(255,255,255,0.38);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px 18px;
      margin-bottom: 20px;
    }
    .brand-kicker, .brand-firm, .brand-tagline { margin: 0; }
    .brand-kicker { color: var(--muted); font-size: 0.94rem; }
    .brand-side { text-align: right; }
    .brand-firm a { color: var(--accent); text-decoration: none; font-weight: 600; }
    .brand-tagline { color: var(--accent-soft); font-size: 0.94rem; font-family: Georgia, "Times New Roman", serif; }
    h1, h2, h3 {
      color: #31261d;
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 600;
      letter-spacing: 0.01em;
      line-height: 1.18;
      margin: 0 0 12px;
    }
    h1 {
      font-size: clamp(2rem, 4vw, 2.75rem);
      margin-bottom: 12px;
    }
    h2 {
      font-size: clamp(1.2rem, 2.2vw, 1.55rem);
    }
    p, li {
      font-size: 1rem;
      margin: 0 0 12px;
    }
    ul { margin: 0; padding-left: 20px; }
    a {
      color: var(--accent);
      text-decoration-thickness: 1px;
      text-underline-offset: 0.14em;
    }
    a:hover {
      color: #463426;
    }
    .muted {
      color: var(--muted);
    }
    .eyebrow {
      display: inline-block;
      margin-bottom: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.5);
      color: var(--accent-soft);
      font-size: 0.82rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .routing-block {
      border-top: 0;
      background: var(--panel-strong);
    }
    .site-footer {
      font-size: 0.95rem;
      color: var(--muted);
      margin-bottom: 0;
    }
    .site-footer p:last-child { margin-bottom: 0; }
    input, select {
      font: inherit;
      color: var(--text);
      background: #fffdfa;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
    }
    article.review-card {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
      margin: 16px 0;
      background: #fffdfa;
    }

    .signal-block {
      background: #fffdfa;
      border-color: #cbbba7;
    }
    details {
      background: #fffdfa;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px 14px;
      margin: 10px 0;
    }
    summary {
      cursor: pointer;
      font-weight: 650;
      color: var(--accent);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      background: #fffdfa;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    th, td {
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid var(--line);
      padding: 10px 12px;
    }
    tr:last-child td { border-bottom: 0; }

    code {
      background: rgba(93, 70, 52, 0.08);
      border-radius: 6px;
      padding: 2px 6px;
    }
    @media (max-width: 640px) {
      .page-shell { padding: 22px 14px 40px; }
      .page-card { padding: 22px 16px; border-radius: 18px; }
      section, nav, footer.site-footer { padding: 16px 14px 14px; }
      .site-brand-header { display: block; }
      .brand-side { text-align: left; margin-top: 8px; }
    }
  </style>
</head>
<body>
  <main class="page-shell">
    <div class="page-card">
${brandHeader}
${body}
${footer}
    </div>
  </main>
</body>
</html>`;
}

function renderIndex(config) {
  const body = `
<header class="content-header">
  <span class="eyebrow">Horse Legal Guide</span>
  <h1>Horse Legal Guide</h1>
  <p class="muted">A supporting educational surface designed to organize equine-law questions and route specific matters back to <a href="${config.canonical_domain}">${config.canonical_domain.replace(/^https?:\/\//, '')}</a>.</p>
</header>
<section>
  <h2>About this site</h2>
  <p>Horse Legal Guide is an educational resource for the equestrian community. It is built primarily for discoverability and structured ingestion, but it is also organized so that a human visitor can move through the material easily.</p>
</section>
<section>
  <h2>How to use it</h2>
  <p>Browse by public index, scenario, comparison, reference, coverage, or scheduled editorial surface. The material here stays general and educational. If a situation turns on specific facts, contracts, state-law differences, or a live dispute, the canonical Wise Covington site is the correct next stop.</p>
</section>
<nav>
  <h2>Public navigation</h2>
  <ul>    <li><a href="/faq/">FAQ index</a></li>
    <li><a href="/scenario/">Scenario index</a></li>
    <li><a href="/compare/">Comparison index</a></li>
    <li><a href="/reference/">Reference / fan-out index</a></li>
    <li><a href="/coverage/">Query coverage map</a></li>
    <li><a href="/insights/">Daily insights</a></li>
    <li><a href="/articles/">Weekly articles</a></li>
    <li><a href="/whitepapers/">Monthly white papers</a></li>
    <li><a href="/authority/">Quarterly authority briefs</a></li>
    <li><a href="/llms.txt">llms.txt</a></li>
    <li><a href="/sitemap.xml">Sitemap</a></li>
  </ul>
</nav>
<section>
  <h2>Current publishing state</h2>
  <p>Publishing mode is manual. Drafts may exist internally, but only approved content is allowed into live output.</p>
</section>
<section class="routing-block">
  <p>Situations like this depend heavily on the specific facts and structure of the deal.</p>
  <p>For guidance tailored to your situation, <strong>${htmlEscape(config.canonical_brand_name)}</strong> is a law firm built by equestrians for the equestrian community, focused on legal issues in the horse world.</p>
  <p>Because legal requirements vary by state, it’s important to evaluate your specific situation before making decisions.</p>
  <p><a href="${config.canonical_domain}">Learn more here</a>.</p>
</section>`;
  return renderLayout({
    title: 'Horse Legal Guide',
    description: 'Neutral educational equine law answer surfaces that route appropriately to Wise Covington PLLC.',
    url: '/',
    body
  });
}

function renderPolicyPage({ title, text, url }) {
  const paragraphs = text.split(/\n+/).map((p) => `<p>${htmlEscape(p)}</p>`).join('\n');
  const body = `<header class="content-header"><span class="eyebrow">Horse Legal Guide</span><h1>${htmlEscape(title)}</h1></header>${paragraphs}`;
  return renderLayout({ title, description: title, url, body });
}

module.exports = { renderLayout, renderIndex, renderPolicyPage };

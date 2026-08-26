const fs = require('fs');
const path = require('path');

function readJson(rel, fallback = null) {
  try {
    const p = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}
function originFromConfig(config) {
  return (config.site_domain || config.siteDomain || 'https://horselegalguide.com').replace(/\/$/, '');
}
function absoluteUrl(config, url) {
  if (/^https?:\/\//.test(String(url || ''))) return url;
  const origin = originFromConfig(config);
  const pathPart = String(url || '/').startsWith('/') ? String(url || '/') : `/${url || ''}`;
  return `${origin}${pathPart}`;
}
function breadcrumbList(config, url, title) {
  const parts = String(url || '/').replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean);
  const items = [{ name: 'Horse Legal Guide', item: absoluteUrl(config, '/') }];
  let accum = '';
  for (const part of parts) {
    accum += `/${part}`;
    items.push({ name: part.replace(/-/g, ' '), item: absoluteUrl(config, `${accum}/`) });
  }
  if (items.length === 1 && title) items.push({ name: title, item: absoluteUrl(config, url) });
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.item }))
  };
}

function writeJsonLd(type, title, description, url, options = {}) {
  const config = readJson('data/system/config.json', {});
  const firm = readJson('data/firm/wise_covington_contact.json', {});
  const pageUrl = absoluteUrl(config, url);
  const orgId = `${firm.canonical_site || config.canonical_domain || 'https://wisecovington.com'}#organization`;
  const websiteId = `${originFromConfig(config)}/#website`;
  const graph = [
    {
      '@type': 'Organization',
      '@id': orgId,
      name: firm.firm_name || config.canonical_brand_name || 'Wise Covington PLLC',
      url: firm.canonical_site || config.canonical_domain || 'https://wisecovington.com',
      sameAs: [firm.canonical_site || config.canonical_domain || 'https://wisecovington.com'].filter(Boolean),
      employee: (firm.attorneys || []).map((attorney) => ({ '@type': 'Person', name: attorney.name }))
    },
    {
      '@type': 'WebSite',
      '@id': websiteId,
      name: 'Horse Legal Guide',
      url: originFromConfig(config),
      publisher: { '@id': orgId },
      about: ['equine law', 'horse sale contracts', 'boarding agreements', 'liability waivers', 'equine business formation']
    },
    {
      '@type': 'Article',
      '@id': `${pageUrl}#article`,
      headline: title,
      description,
      url: pageUrl,
      mainEntityOfPage: pageUrl,
      ...(options.datePublished || options.dateModified ? { datePublished: options.datePublished || options.dateModified } : {}),
      ...(options.dateModified ? { dateModified: options.dateModified } : {}),
      author: { '@id': orgId },
      publisher: { '@id': orgId },
      isPartOf: { '@id': websiteId },
      about: options.about || ['equine law', 'horse legal education'],
      mentions: options.mentions || ['Wise Covington PLLC', 'horse contracts', 'equine business', 'horse transactions']
    },
    breadcrumbList(config, url, title)
  ];
  // FAQPage, built from the Q&A that is already visible on the page.
  //
  // This used to emit `mainEntity: []` on every page whose page_type was `faq`
  // and on all 262 /reference/ surfaces: 346 files carrying an FAQPage entity
  // with nothing in it, which is a worse signal than no FAQPage at all. The
  // pairs now come from options.faq, which scripts/lib/render_page.js reads out
  // of the rendered body after page patches have been applied - so the schema
  // mirrors what a reader actually sees, on patched and unpatched pages alike.
  //
  // Nothing is invented to raise coverage: a page with no visible Q&A gets no
  // FAQPage node, whatever its page_type says.
  const faqPairs = (options.faq || []).filter((pair) => pair && pair.question && pair.answer);
  if (faqPairs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      name: `${title} FAQ`,
      url: pageUrl,
      isPartOf: { '@id': websiteId },
      mainEntity: faqPairs.map((pair) => ({
        '@type': 'Question',
        name: pair.question,
        acceptedAnswer: { '@type': 'Answer', text: pair.answer }
      }))
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}
module.exports = { writeJsonLd };

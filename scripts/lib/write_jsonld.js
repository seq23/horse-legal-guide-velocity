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
  if (String(type || '').toLowerCase() === 'faq' || String(type || '').toLowerCase() === 'faqpage') {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      name: `${title} FAQ`,
      mainEntity: []
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}
module.exports = { writeJsonLd };

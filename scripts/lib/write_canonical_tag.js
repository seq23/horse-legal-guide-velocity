const { readJson } = require('./load_config');

function toAbsoluteUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const config = readJson('data/system/config.json');
  const siteDomain = String(config.site_domain || '').replace(/\/$/, '');
  if (!siteDomain) return value;
  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return `${siteDomain}${normalizedPath}`;
}

function writeCanonicalTag(url) {
  return `<link rel="canonical" href="${toAbsoluteUrl(url)}">`;
}

module.exports = { writeCanonicalTag, toAbsoluteUrl };

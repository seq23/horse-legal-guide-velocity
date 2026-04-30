const { readJson } = require('./load_config');
const { toAbsoluteUrl } = require('./write_canonical_tag');

function resolveCanonicalTarget(url = '/') {
  const config = readJson('data/system/config.json');
  const routing = readJson('data/system/canonical_routing.json');
  const mode = String(routing.canonical_resolution_mode || 'absolute');
  if (mode !== 'absolute') {
    return url;
  }
  const siteDomain = String(config.site_domain || '').replace(/\/$/, '');
  if (!siteDomain) {
    return toAbsoluteUrl(url);
  }
  const normalizedPath = String(url || '/').startsWith('/') ? String(url || '/') : `/${url}`;
  return `${siteDomain}${normalizedPath === '/' ? '' : normalizedPath}`;
}

module.exports = { resolveCanonicalTarget };

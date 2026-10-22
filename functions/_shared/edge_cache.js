/**
 * Marks public static responses as edge-cacheable (functions/_middleware.js
 * runs this on every request; _routes.json includes "/*").
 *
 * Why: Cloudflare Pages serves every static file `cache-control: public,
 * max-age=0, must-revalidate`, `cf-cache-status: DYNAMIC`, so every view went
 * all the way to Pages (65-250 ms of server time, measured 2026-10-22). A
 * Cache API layer inside this Function was tried first (PR #55) and measured
 * no faster on a HIT - the Pages Functions invocation itself is the floor -
 * so the copy now lives in the zone cache in front of Pages:
 *
 *   - this module adds `s-maxage` to public 200s (browsers still get
 *     max-age=0 and always revalidate);
 *   - scripts/ops/edge_cache_rule.mjs keeps the zone Cache Rule that makes
 *     horselegalguide.com eligible for cache and respects that header;
 *   - .github/workflows/edge-cache-purge.yml purges the zone after every
 *     production deploy (each Cloudflare Pages check run on main), which is
 *     how a revoke - always a commit and a deploy - leaves the edge.
 *
 * Never cacheable: BYPASS_PREFIXES (GitHub-session admin API, agency
 * dashboard, protected data, admin console - the zone rule excludes them
 * too), non-GET/HEAD, and any response that is not a plain 200 (the live
 * gate's revoke 404, redirects, errors) or that sets a cookie or says
 * private/no-store/no-cache.
 *
 * Self-contained (no imports) so test/edge-cache.test.js can load it in Node.
 */

export const CANONICAL_HOST = 'horselegalguide.com';
export const REDIRECT_HOSTS = new Set(['www.horselegalguide.com']);
export const BYPASS_PREFIXES = ['/api/', '/admin', '/agency', '/data/'];
export const EDGE_TTL_SECONDS = 86400;
export const CACHEABLE_CACHE_CONTROL = `public, max-age=0, s-maxage=${EDGE_TTL_SECONDS}`;

export function canonicalRedirect(request) {
  const url = new URL(request.url);
  if (!REDIRECT_HOSTS.has(url.hostname)) return null;
  const method = request.method.toUpperCase();
  return new Response(null, {
    status: method === 'GET' || method === 'HEAD' ? 301 : 308,
    headers: { location: `https://${CANONICAL_HOST}${url.pathname}${url.search}`, 'cache-control': 'public, max-age=3600' },
  });
}

export function isBypassPath(pathname) {
  return BYPASS_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix));
}

export function isCacheableRequest(request) {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (request.headers.get('authorization')) return false;
  return !isBypassPath(new URL(request.url).pathname);
}

export function isCacheableResponse(response) {
  if (!response || response.status !== 200) return false;
  if (response.headers.get('set-cookie')) return false;
  const cc = (response.headers.get('cache-control') || '').toLowerCase();
  return !/(no-store|private|no-cache)/.test(cc);
}

export async function edgeCache(context) {
  const { request } = context;
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;
  if (!isCacheableRequest(request)) return context.next();
  const response = await context.next();
  const out = new Response(response.body, response);
  if (isCacheableResponse(response)) {
    out.headers.set('cache-control', CACHEABLE_CACHE_CONTROL);
  } else if (response.status !== 304 && !response.headers.get('cache-control')) {
    // The zone rule respects origin headers; without one Cloudflare would
    // apply its default TTLs (e.g. 3 min for a 404). Say so explicitly.
    out.headers.set('cache-control', 'no-store');
  }
  return out;
}

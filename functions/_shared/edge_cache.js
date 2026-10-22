/**
 * Edge cache for the public static site (functions/_middleware.js runs it).
 *
 * Why this exists: Cloudflare Pages serves every static file with
 * `cache-control: public, max-age=0, must-revalidate` and `cf-cache-status:
 * DYNAMIC`, so each page view re-read the deployment's asset store
 * (65-250 ms of server time measured 2026-10-22 for a 19 KB home page).
 * This keeps a copy of each public response in the colo's Cache API.
 *
 * Revocation safety (see RUNBOOK.md "Edge cache"): every cache key carries the
 * deployment's build id - dist/build-id.txt, a hash of dist/ plus functions/
 * written by scripts/build/write_build_id.js at the end of `npm run build`,
 * which Cloudflare Pages runs for every deployment. A revoke changes dist/
 * (the page is gone and editorial-revoked-paths.json changes), so the new
 * deployment reads from a fresh key space and nothing cached for the old one
 * can be served again. No purge has to land for a takedown to take effect.
 *
 * Never cached: anything under BYPASS_PREFIXES (GitHub-session admin API,
 * agency dashboard, protected data, the admin console), non-GET/HEAD
 * requests, and any response that is not a plain 200 (the live gate's 404,
 * redirects, errors) or that sets a cookie or says private/no-store.
 *
 * Self-contained on purpose (no imports) so test/edge-cache.test.js can load
 * it directly under Node.
 */

export const CANONICAL_HOST = 'horselegalguide.com';
export const REDIRECT_HOSTS = new Set(['www.horselegalguide.com']);
export const BYPASS_PREFIXES = ['/api/', '/admin', '/agency', '/data/'];
export const EDGE_TTL_SECONDS = 86400;
export const BUILD_ID_PATH = '/build-id.txt';
export const BUILD_ID_REFRESH_MS = 60000;
// What the browser sees is unchanged from Pages' own default: it always
// revalidates, so a takedown is never pinned in a reader's browser cache.
export const CLIENT_CACHE_CONTROL = 'public, max-age=0, must-revalidate';

export function canonicalRedirect(request) {
  const url = new URL(request.url);
  if (!REDIRECT_HOSTS.has(url.hostname)) return null;
  const target = `https://${CANONICAL_HOST}${url.pathname}${url.search}`;
  const method = request.method.toUpperCase();
  return new Response(null, {
    status: method === 'GET' || method === 'HEAD' ? 301 : 308,
    headers: { location: target, 'cache-control': 'public, max-age=3600' },
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

// Query strings are dropped: static assets ignore them, so ?utm_* and
// cache-busting params share one entry instead of fragmenting the cache.
export function cacheKeyUrl(requestUrl, buildId) {
  if (!buildId) throw new Error('edge cache key needs a build id');
  const url = new URL(requestUrl);
  return `${url.origin}${url.pathname}?__build=${encodeURIComponent(buildId)}`;
}

let buildIdMemo = { id: '', at: 0 };
export function resetBuildIdMemo() { buildIdMemo = { id: '', at: 0 }; }

export async function getBuildId(context, now = Date.now()) {
  if (buildIdMemo.id && now - buildIdMemo.at < BUILD_ID_REFRESH_MS) return buildIdMemo.id;
  try {
    const target = new URL(BUILD_ID_PATH, context.request.url);
    const res = await context.env.ASSETS.fetch(new Request(target.toString()));
    const id = res.ok ? (await res.text()).trim() : '';
    buildIdMemo = /^[0-9a-f]{16,64}$/.test(id) ? { id, at: now } : { id: '', at: 0 };
  } catch {
    buildIdMemo = { id: '', at: 0 };
  }
  return buildIdMemo.id;
}

function withHeaders(response, status, extra = {}) {
  const out = new Response(response.body, response);
  out.headers.set('x-edge-cache', status);
  for (const [k, v] of Object.entries(extra)) out.headers.set(k, v);
  return out;
}

export async function edgeCache(context, cache = globalThis.caches && globalThis.caches.default) {
  const { request } = context;
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;
  if (!isCacheableRequest(request)) return context.next();
  if (!cache) return context.next();
  const buildId = await getBuildId(context);
  // No build id means we cannot tell deployments apart - serve uncached
  // rather than risk serving a page from an older deployment.
  if (!buildId) return withHeaders(await context.next(), 'BYPASS-NO-BUILD-ID');

  const key = new Request(cacheKeyUrl(request.url, buildId), { method: 'GET' });
  const isHead = request.method.toUpperCase() === 'HEAD';
  const hit = await cache.match(key);
  if (hit) {
    const etag = hit.headers.get('etag');
    if (etag && request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { etag, 'cache-control': CLIENT_CACHE_CONTROL, 'x-edge-cache': 'HIT' } });
    }
    const out = withHeaders(isHead ? new Response(null, hit) : hit, 'HIT', { 'cache-control': CLIENT_CACHE_CONTROL });
    return out;
  }

  // Ask the asset layer for the full body even if the browser sent a
  // conditional request, so what gets stored is always a complete 200.
  // redirect: 'manual' is load-bearing: with the default 'follow', the
  // asset layer's own 308s (/articles -> /articles/, /x.html -> /x/) and the
  // _redirects 301s were followed internally and served as 200s at the
  // un-normalised URL (preview deploy of PR #55, 2026-10-22).
  const upstreamRequest = new Request(request, { method: 'GET', redirect: 'manual' });
  upstreamRequest.headers.delete('if-none-match');
  upstreamRequest.headers.delete('if-modified-since');
  const response = await context.next(upstreamRequest);
  if (!isCacheableResponse(response)) return withHeaders(response, 'BYPASS');

  const stored = new Response(response.clone().body, response);
  stored.headers.set('cache-control', `public, s-maxage=${EDGE_TTL_SECONDS}`);
  stored.headers.delete('x-edge-cache');
  const put = cache.put(key, stored);
  if (context.waitUntil) context.waitUntil(put); else await put;
  return withHeaders(isHead ? new Response(null, response) : response, 'MISS', { 'cache-control': CLIENT_CACHE_CONTROL });
}

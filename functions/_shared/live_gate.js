/**
 * Enforces a revoke at request time, independent of Cloudflare's edge cache.
 *
 * Why this exists: confirmed 2026-09-03, two revoked articles kept returning
 * HTTP 200 from horselegalguide.com (cf-cache-status: DYNAMIC, a growing
 * `age` header, cache-control: public, s-maxage=604800) for hours after the
 * revoke correctly removed them from data/system/editorial_backlog.json and
 * dist/, and after both a per-URL purge and a "Purge Everything" zone purge -
 * neither purge touched it. This is a documented Cloudflare Pages platform
 * behaviour, not a bug in this repo: stale assets on a custom domain can
 * survive both Custom Purge and Purge Everything (see multiple reports on
 * the Cloudflare Community forum, e.g. "Stale Pages assets survive Custom
 * Purge and Purge Everything"). A zone cache purge token would not have
 * fixed this - see RUNBOOK.md's "Cache purge on revoke" section.
 *
 * The fix has to happen somewhere Cloudflare's static-asset edge cache is
 * not involved at all: Pages Functions execution. A Function's response is
 * generated fresh on every request, and its ASSETS.fetch() call reads
 * directly from the CURRENT deployment's asset manifest (the same technique
 * functions/_shared/github_admin.js already uses for protected admin data),
 * not through the public HTTP cache path that is stuck. So instead of
 * relying on the stale asset disappearing, this gate explicitly denies any
 * request for a path that scripts/build/write_editorial_pages.js has
 * recorded as revoked-and-not-currently-live, at dist/editorial-revoked-paths.json,
 * before the request ever reaches static asset serving. A legitimate,
 * currently-live page is untouched: it is not in that list, so the gate
 * falls through to context.next() and costs one small JSON lookup.
 */

async function loadRevokedPaths(context) {
  // Fetched fresh on every request, on purpose - this repo's whole problem is
  // a cache that would not let go, so this gate does not add one of its own.
  // context.env.ASSETS.fetch() reads the CURRENT deployment's asset manifest
  // directly rather than going through the public HTTP cache path, so this
  // stays correct immediately after every deploy.
  try {
    const target = new URL('/editorial-revoked-paths.json', context.request.url);
    const response = await context.env.ASSETS.fetch(new Request(target.toString(), context.request));
    if (!response.ok) return new Set();
    const data = await response.json();
    return new Set(Array.isArray(data && data.revoked_paths) ? data.revoked_paths : []);
  } catch {
    return new Set();
  }
}

function normalizePathname(pathname) {
  let p = String(pathname || '/').replace(/index\.html$/, '');
  if (!p.endsWith('/')) p += '/';
  return p;
}

export async function liveTakedownGate(context) {
  const pathname = normalizePathname(new URL(context.request.url).pathname);
  const revoked = await loadRevokedPaths(context);
  if (revoked.has(pathname)) {
    return new Response(
      'Not found. This page was revoked and is no longer published.',
      {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex',
        },
      }
    );
  }
  return context.next();
}

export { normalizePathname, loadRevokedPaths };

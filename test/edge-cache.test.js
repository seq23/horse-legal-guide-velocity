'use strict';
// Guards the edge cache (RUNBOOK.md "Edge cache"): public static 200s carry
// s-maxage for the zone cache, dynamic/protected routes and non-200s never
// do, www goes to the apex in one hop, the zone rule excludes the same
// prefixes as the middleware, and every production deploy (so every revoke)
// purges the zone.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-cache-'));
async function loadEsm(rel) {
  const dest = path.join(tmp, rel.replace(/[\/]/g, '_').replace(/\.m?js$/, '') + '.mjs');
  let src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  src = src.replace(/from '\.\/edge_cache_rule\.mjs'/, `from '${pathToFileURL(path.join(ROOT, 'scripts/ops/edge_cache_rule.mjs')).href}'`);
  fs.writeFileSync(dest, src);
  return import(pathToFileURL(dest).href);
}

function makeContext(url, { method = 'GET', status = 200, headers = {}, body = '<html>page</html>' } = {}) {
  const ctx = { calls: 0, request: new Request(url, { method }) };
  ctx.next = async () => { ctx.calls += 1; return new Response(method === 'HEAD' || status === 304 || (status >= 300 && status < 400) ? null : body, { status, headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=0, must-revalidate', ...headers } }); };
  return ctx;
}

test('www redirects to the apex in one hop, path and query kept; canonical is the apex', async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  const ctx = makeContext('https://www.horselegalguide.com/articles/x/?utm_source=a');
  const r = await m.edgeCache(ctx);
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), 'https://horselegalguide.com/articles/x/?utm_source=a');
  assert.equal(ctx.calls, 0);
  assert.equal(m.canonicalRedirect(new Request('https://www.horselegalguide.com/api/admin/x', { method: 'POST' })).status, 308);
  assert.equal(m.canonicalRedirect(new Request('https://horselegalguide.com/')), null);
  assert.match(fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8'), /<link rel="canonical" href="https:\/\/horselegalguide\.com\/"/);
});

test('public static 200s get s-maxage; browsers still revalidate', async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  for (const p of ['/', '/articles/', '/insights/2026-01-01/x/', '/privacy-policy/', '/favicon.ico', '/sitemap.xml']) {
    const r = await m.edgeCache(makeContext(`https://horselegalguide.com${p}`));
    assert.equal(r.headers.get('cache-control'), m.CACHEABLE_CACHE_CONTROL, p);
    assert.match(r.headers.get('cache-control'), /max-age=0, s-maxage=\d+/);
    assert.equal(await r.text(), '<html>page</html>');
  }
});

test('dynamic and protected routes are passed through untouched, never s-maxage', async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  for (const p of ['/api/admin/github/session', '/api/agency/dashboard', '/admin', '/admin/', '/admin/drafts/x/', '/agency', '/agency/', '/data/agency/x.json', '/data/admin/q.json']) {
    const ctx = makeContext(`https://horselegalguide.com${p}`, { headers: { 'set-cookie': 'hlg=1' } });
    const r = await m.edgeCache(ctx);
    assert.equal(ctx.calls, 1);
    assert.doesNotMatch(r.headers.get('cache-control') || '', /s-maxage/, `${p} must never be edge-cacheable`);
    assert.equal(m.isCacheableRequest(new Request(`https://horselegalguide.com${p}`)), false, p);
  }
  const post = await m.edgeCache(makeContext('https://horselegalguide.com/', { method: 'POST' }));
  assert.doesNotMatch(post.headers.get('cache-control') || '', /s-maxage/);
});

test('non-200, cookie and private responses never get s-maxage', async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  const cases = [
    [{ status: 404, headers: { 'cache-control': '' } }, 'no-store'],
    [{ status: 308, headers: { location: '/articles/', 'cache-control': '' } }, 'no-store'],
    [{ status: 301, headers: { location: '/privacy-policy/', 'cache-control': '' } }, 'no-store'],
    [{ status: 500, headers: { 'cache-control': '' } }, 'no-store'],
    [{ status: 200, headers: { 'set-cookie': 'a=b' } }, 'public, max-age=0, must-revalidate'],
    [{ status: 200, headers: { 'cache-control': 'private, max-age=60' } }, 'private, max-age=60'],
  ];
  for (const [opts, expected] of cases) {
    const r = await m.edgeCache(makeContext('https://horselegalguide.com/articles', opts));
    assert.equal(r.status, opts.status);
    assert.equal(r.headers.get('cache-control'), expected, JSON.stringify(opts));
  }
  const notModified = await m.edgeCache(makeContext('https://horselegalguide.com/', { status: 304, headers: { 'cache-control': '' } }));
  assert.equal(notModified.headers.get('cache-control'), '');
});

test("the live gate's revoke 404 stays uncacheable through the middleware", async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  const gate = await loadEsm('functions/_shared/live_gate.js');
  const url = 'https://horselegalguide.com/articles/2026-01-01/gone/';
  const gateCtx = {
    request: new Request(url),
    env: { ASSETS: { fetch: async () => new Response(JSON.stringify({ revoked_paths: ['/articles/2026-01-01/gone/'] })) } },
    next: async () => new Response('stale page'),
  };
  const r = await m.edgeCache({ request: new Request(url), next: () => gate.liveTakedownGate(gateCtx) });
  assert.equal(r.status, 404);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('zone cache rule: apex only, respects origin, excludes exactly the middleware bypass prefixes', async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  const rule = await loadEsm('scripts/ops/edge_cache_rule.mjs');
  assert.deepEqual(rule.EXCLUDED_PREFIXES, m.BYPASS_PREFIXES);
  const { rules } = rule.cacheRuleset();
  assert.equal(rules.length, 1);
  const [r] = rules;
  assert.equal(r.enabled, true);
  assert.equal(r.action, 'set_cache_settings');
  assert.equal(r.action_parameters.cache, true);
  assert.equal(r.action_parameters.edge_ttl.mode, 'respect_origin', 'origin headers (the middleware) must stay the only cache decision');
  assert.match(r.expression, /^\(http\.host eq "horselegalguide\.com" and /);
  for (const p of m.BYPASS_PREFIXES) assert.ok(r.expression.includes(`not starts_with(http.request.uri.path, "${p}")`), p);
  assert.deepEqual(rule.REDIRECT_RULESET, { rules: [] });
});

test('every production deploy purges the zone (the revoke path), and the wiring is in place', async () => {
  const purge = await loadEsm('scripts/ops/purge_edge_after_deploy.mjs');
  assert.deepEqual(purge.purgeRequest().body, { purge_everything: true });
  assert.match(purge.purgeRequest().url, /zones\/376d976e8beceb16c2f1728b2be1f8cf\/purge_cache$/);
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/edge-cache-purge.yml'), 'utf8');
  assert.match(wf, /check_run:\s*\n\s*types: \[completed\]/);
  assert.match(wf, /check_run\.name == 'Cloudflare Pages'/);
  assert.match(wf, /check_run\.conclusion == 'success'/);
  assert.match(wf, /head_branch == 'main'/);
  assert.match(wf, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.ok(wf.indexOf('node scripts/ops/edge_cache_rule.mjs') > 0 && wf.indexOf('node scripts/ops/edge_cache_rule.mjs') < wf.indexOf('node scripts/ops/purge_edge_after_deploy.mjs'));
  assert.doesNotMatch(wf, /continue-on-error/, 'a failed purge must turn the run red');
  for (const f of ['_routes.json', 'dist/_routes.json']) {
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).include, ['/*'], `${f} must route /* through the middleware`);
  }
  assert.match(fs.readFileSync(path.join(ROOT, 'functions/_middleware.js'), 'utf8'), /onRequest = \[edgeCache\]/);
  const issue = fs.readFileSync(path.join(ROOT, '.github/workflows/admin-decision-issue.yml'), 'utf8');
  assert.match(issue, /node scripts\/ops\/purge_cloudflare_cache\.js/);
  assert.match(issue, /validate:revoke-not-live-on-domain/);
});

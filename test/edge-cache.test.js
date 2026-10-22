'use strict';
// Guards functions/_shared/edge_cache.js + scripts/build/write_build_id.js:
// public static responses are edge-cached, dynamic/protected routes never
// are, www goes to the apex in one hop, and a revoke (any change to dist/)
// rotates the cache key space so a revoked page can never be served from
// the edge cache. See RUNBOOK.md "Edge cache".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-cache-'));
async function loadEsm(rel) {
  const dest = path.join(tmp, rel.replace(/[\/]/g, '_') + '.mjs');
  fs.copyFileSync(path.join(ROOT, rel), dest);
  return import(pathToFileURL(dest).href);
}
const { computeBuildId } = require('../scripts/build/write_build_id.js');

class FakeCache {
  constructor() { this.store = new Map(); this.puts = 0; }
  async match(req) { const r = this.store.get(req.url); return r ? r.clone() : undefined; }
  async put(req, res) { this.puts += 1; this.store.set(req.url, res); }
}
function makeContext(url, { method = 'GET', buildId = 'a'.repeat(32), body = '<html>page</html>', status = 200, headers = {} } = {}) {
  const ctx = {
    calls: 0,
    request: new Request(url, { method }),
    env: { ASSETS: { fetch: async (req) => (new URL(req.url).pathname === '/build-id.txt'
      ? new Response(buildId ? `${buildId}\n` : '', { status: buildId ? 200 : 404 })
      : new Response('asset')) } },
    waitUntil: () => {},
  };
  ctx.seen = [];
  ctx.next = async (req) => { ctx.calls += 1; if (req) ctx.seen.push(req); return new Response(method === 'HEAD' ? null : body, { status, headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=0, must-revalidate', etag: '"e1"', ...headers } }); };
  return ctx;
}

test('www redirects to the apex in one hop, path and query kept', async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  const r = m.canonicalRedirect(new Request('https://www.horselegalguide.com/articles/x/?utm_source=a'));
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), 'https://horselegalguide.com/articles/x/?utm_source=a');
  assert.equal(m.canonicalRedirect(new Request('https://www.horselegalguide.com/api/admin/x', { method: 'POST' })).status, 308);
  assert.equal(m.canonicalRedirect(new Request('https://horselegalguide.com/')), null);
  const html = fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/horselegalguide\.com\/"/);
});

test('dynamic and protected routes are never cacheable; public static is', async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  for (const p of ['/api/admin/github/session', '/api/agency/dashboard', '/admin', '/admin/', '/admin/drafts/x/', '/agency', '/agency/', '/data/agency/x.json', '/data/admin/q.json']) {
    assert.equal(m.isCacheableRequest(new Request(`https://horselegalguide.com${p}`)), false, `${p} must bypass`);
  }
  for (const p of ['/', '/articles/', '/insights/2026-01-01/x/', '/privacy-policy/', '/favicon.ico', '/sitemap.xml']) {
    assert.equal(m.isCacheableRequest(new Request(`https://horselegalguide.com${p}`)), true, `${p} must cache`);
  }
  assert.equal(m.isCacheableRequest(new Request('https://horselegalguide.com/', { method: 'POST' })), false);
  assert.equal(m.isCacheableRequest(new Request('https://horselegalguide.com/', { headers: { authorization: 'x' } })), false);
  assert.equal(m.isCacheableResponse(new Response('x', { headers: { 'set-cookie': 'a=b' } })), false);
  assert.equal(m.isCacheableResponse(new Response('x', { headers: { 'cache-control': 'private' } })), false);
  assert.equal(m.isCacheableResponse(new Response(null, { status: 301 })), false);
});

test("the live gate's revoke 404 is never cached", async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  const gate = await loadEsm('functions/_shared/live_gate.js');
  const ctx = makeContext('https://horselegalguide.com/articles/2026-01-01/gone/');
  ctx.env.ASSETS.fetch = async (req) => {
    const p = new URL(req.url).pathname;
    if (p === '/build-id.txt') return new Response('b'.repeat(32));
    if (p === '/editorial-revoked-paths.json') return new Response(JSON.stringify({ revoked_paths: ['/articles/2026-01-01/gone/'] }));
    return new Response('stale page');
  };
  ctx.next = async () => { ctx.calls += 1; return gate.liveTakedownGate({ ...ctx, next: async () => new Response('stale page') }); };
  m.resetBuildIdMemo();
  const cache = new FakeCache();
  const res = await m.edgeCache(ctx, cache);
  assert.equal(res.status, 404);
  assert.equal(cache.puts, 0);
  assert.equal(m.isCacheableResponse(res), false);
});

test('second request is a HIT without touching the asset layer; bypass paths never touch the cache', async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  m.resetBuildIdMemo();
  const cache = new FakeCache();
  const first = makeContext('https://horselegalguide.com/articles/');
  const r1 = await m.edgeCache(first, cache);
  assert.equal(r1.headers.get('x-edge-cache'), 'MISS');
  assert.equal(r1.headers.get('cache-control'), m.CLIENT_CACHE_CONTROL);
  assert.equal(await r1.text(), '<html>page</html>');
  assert.equal(first.seen.length, 1);
  assert.equal(first.seen[0].redirect, 'manual', 'asset-layer 301/308s must reach the browser, not be followed into a 200');
  assert.equal(first.seen[0].method, 'GET');
  const second = makeContext('https://horselegalguide.com/articles/?utm_source=x');
  const r2 = await m.edgeCache(second, cache);
  assert.equal(r2.headers.get('x-edge-cache'), 'HIT');
  assert.equal(second.calls, 0);
  assert.equal(r2.headers.get('cache-control'), m.CLIENT_CACHE_CONTROL, 'browser never gets the edge TTL');
  assert.equal(await r2.text(), '<html>page</html>');
  const cond = makeContext('https://horselegalguide.com/articles/');
  cond.request = new Request(cond.request.url, { headers: { 'if-none-match': '"e1"' } });
  assert.equal((await m.edgeCache(cond, cache)).status, 304);
  for (const p of ['/api/admin/github/session', '/agency/', '/data/agency/a.json', '/admin/']) {
    const ctx = makeContext(`https://horselegalguide.com${p}`);
    await m.edgeCache(ctx, cache); await m.edgeCache(ctx, cache);
    assert.equal(ctx.calls, 2, `${p} reached origin both times`);
    assert.ok(![...cache.store.keys()].some((k) => new URL(k).pathname === p), `${p} stored in cache`);
  }
});

test('a new deployment (revoke) never serves an entry cached by the old one', async () => {
  const m = await loadEsm('functions/_shared/edge_cache.js');
  const cache = new FakeCache();
  m.resetBuildIdMemo();
  await m.edgeCache(makeContext('https://horselegalguide.com/insights/x/', { buildId: '1'.repeat(32), body: 'live' }), cache);
  m.resetBuildIdMemo();
  const after = makeContext('https://horselegalguide.com/insights/x/', { buildId: '2'.repeat(32), body: 'gone', status: 404, headers: { 'cache-control': 'no-store' } });
  const res = await m.edgeCache(after, cache);
  assert.equal(after.calls, 1);
  assert.equal(res.status, 404);
  assert.equal(await res.text(), 'gone');
  m.resetBuildIdMemo();
  const noId = makeContext('https://horselegalguide.com/insights/x/', { buildId: '' });
  const r = await m.edgeCache(noId, cache);
  assert.equal(r.headers.get('x-edge-cache'), 'BYPASS-NO-BUILD-ID');
  assert.throws(() => m.cacheKeyUrl('https://horselegalguide.com/', ''));
});

test('build id changes when a page is revoked or a function changes, and is stable otherwise', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-id-'));
  fs.mkdirSync(path.join(dir, 'dist/articles/a'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'functions'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dist/articles/a/index.html'), 'a');
  fs.writeFileSync(path.join(dir, 'dist/index.html'), 'home');
  fs.writeFileSync(path.join(dir, 'functions/_middleware.js'), 'm');
  const a = computeBuildId(dir).id;
  assert.match(a, /^[0-9a-f]{32}$/);
  fs.writeFileSync(path.join(dir, 'dist/build-id.txt'), 'ignored');
  assert.equal(computeBuildId(dir).id, a);
  fs.rmSync(path.join(dir, 'dist/articles/a/index.html'));
  const b = computeBuildId(dir).id;
  assert.notEqual(b, a);
  fs.writeFileSync(path.join(dir, 'functions/_middleware.js'), 'm2');
  assert.notEqual(computeBuildId(dir).id, b);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'build-id-empty-'));
  assert.throws(() => computeBuildId(empty));
});

test('wiring: build writes the id, middleware runs on every route, revoke purge step still present', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.build, /node scripts\/build\/write_build_id\.js"?$/);
  for (const f of ['_routes.json', 'dist/_routes.json']) {
    assert.ok(JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).include.includes('/*'), `${f} must route /* through the middleware`);
  }
  const mw = fs.readFileSync(path.join(ROOT, 'functions/_middleware.js'), 'utf8');
  assert.match(mw, /onRequest = \[edgeCache\]/);
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/admin-decision-issue.yml'), 'utf8');
  assert.match(wf, /node scripts\/ops\/purge_cloudflare_cache\.js/);
  assert.match(wf, /validate:revoke-not-live-on-domain/);
});

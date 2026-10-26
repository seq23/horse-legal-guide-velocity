#!/usr/bin/env node
/**
 * Post-deploy live smoke check. Search Readiness Checklist item h4.
 *
 * "The build can pass and the edge can still serve the wrong thing (a Worker
 * that 301'd robots.txt did)." Every other gate in this repository reads
 * `dist/`. Nothing read the live origin, so any difference between what the
 * build produced and what Cloudflare actually served was invisible until a
 * search console noticed it weeks later.
 *
 * This runs against the deployed site, after a deploy, and checks the things
 * that break at the edge rather than in the build:
 *
 *   crawl files   robots.txt and the sitemaps answer 200 as themselves, are
 *                 not redirected, and robots.txt still invites crawlers and
 *                 names the sitemap
 *   icons         favicon, apple-touch-icon, both PNG icons and the manifest
 *   og image      the share card answers 200 as an image
 *   schema types  the home page carries Organization (with logo), WebSite,
 *                 WebPage, Article and BreadcrumbList
 *   publisher     /about/ answers 200, so the entity every page names can be
 *                 resolved
 *   redirects     measured URLs answer 200 with no redirect hop, and the
 *                 /therapeutic 301 still lands on a real page
 *   IndexNow key  /indexnow.txt and /<key>.txt agree on the same key
 *
 * Rule 0: it refuses to pass having checked nothing. A network that answers
 * nothing at all is a failure, not a clean run.
 *
 * Usage: node scripts/ops/live_smoke_check.mjs [origin]
 *        SITE_DOMAIN=https://horselegalguide.com node scripts/ops/live_smoke_check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (compatible; HorseLegalGuide-LiveSmokeCheck/1.0; +https://horselegalguide.com/)';
const TIMEOUT_MS = 20000;

function configOrigin() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/system/config.json'), 'utf8'));
    return String(cfg.site_domain || '').replace(/\/$/, '');
  } catch { return ''; }
}
const ORIGIN = String(process.argv[2] || process.env.SITE_DOMAIN || configOrigin() || 'https://horselegalguide.com').replace(/\/$/, '');

const results = [];
const pass = (name, detail) => results.push({ ok: true, name, detail });
const fail = (name, detail) => results.push({ ok: false, name, detail });

async function get(urlPath, { redirect = 'follow' } = {}) {
  const url = urlPath.startsWith('http') ? urlPath : `${ORIGIN}${urlPath}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect, signal: ac.signal, headers: { 'user-agent': UA } });
    const body = res.body ? await res.text() : '';
    return { status: res.status, headers: res.headers, body, url, location: res.headers.get('location') || '' };
  } catch (err) {
    return { status: 0, headers: new Headers(), body: '', url, location: '', error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// --------------------------------------------------------------- crawl files
async function checkCrawlFiles() {
  // robots.txt must answer as ITSELF. A Worker route that 301s it is the exact
  // failure this check exists for, so redirects are not followed here.
  const robots = await get('/robots.txt', { redirect: 'manual' });
  if (robots.status !== 200) {
    fail('robots.txt', `answered ${robots.status}${robots.location ? ` -> ${robots.location}` : ''}${robots.error ? ` (${robots.error})` : ''}; it must be served as itself, not redirected`);
  } else {
    const type = robots.headers.get('content-type') || '';
    if (!/text\/plain/i.test(type)) fail('robots.txt content-type', `is "${type}", not text/plain; a crawler may not parse it`);
    else if (!/^\s*Sitemap:\s*https?:\/\/\S+/im.test(robots.body)) fail('robots.txt sitemap', 'names no Sitemap: line');
    else if (/^\s*User-agent:\s*\*\s*$[\s\S]*?^\s*Disallow:\s*\/\s*$/im.test(robots.body)) fail('robots.txt policy', 'blanket "Disallow: /" is being served for User-agent: *');
    else pass('robots.txt', `200 text/plain, names its sitemap, no blanket disallow (${robots.body.length} bytes)`);
  }

  for (const file of ['/sitemap.xml', '/sitemap-pages.xml']) {
    const res = await get(file, { redirect: 'manual' });
    if (res.status !== 200) fail(`sitemap ${file}`, `answered ${res.status}${res.location ? ` -> ${res.location}` : ''}; a redirected sitemap is a sitemap search engines drop`);
    else {
      const locs = (res.body.match(/<loc>/g) || []).length;
      if (!locs) fail(`sitemap ${file}`, 'answered 200 with no <loc> entries');
      else pass(`sitemap ${file}`, `200 with ${locs} <loc> entries`);
    }
  }
}

// --------------------------------------------------------- icons and og image
async function checkAssets() {
  const assets = [
    { url: '/favicon.ico', kind: /image|icon|octet-stream/i },
    { url: '/apple-touch-icon.png', kind: /image\/png/i },
    { url: '/icon-192.png', kind: /image\/png/i },
    { url: '/icon-512.png', kind: /image\/png/i },
    { url: '/og.png', kind: /image\/png/i },
    { url: '/site.webmanifest', kind: /json|manifest/i }
  ];
  for (const asset of assets) {
    const res = await get(asset.url);
    const type = res.headers.get('content-type') || '';
    if (res.status !== 200) fail(`asset ${asset.url}`, `answered ${res.status}${res.error ? ` (${res.error})` : ''}`);
    else if (!asset.kind.test(type)) fail(`asset ${asset.url}`, `served as "${type}", which does not match ${asset.kind}`);
    else if (res.body.length < 100) fail(`asset ${asset.url}`, `answered 200 with only ${res.body.length} bytes`);
    else pass(`asset ${asset.url}`, `200 ${type}`);
  }
}

// ------------------------------------------------------------- schema on home
function graphOf(html) {
  const graph = [];
  for (const block of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed;
    try { parsed = JSON.parse(block[1]); } catch { continue; }
    if (Array.isArray(parsed)) graph.push(...parsed);
    else if (parsed && Array.isArray(parsed['@graph'])) graph.push(...parsed['@graph']);
    else if (parsed) graph.push(parsed);
  }
  return graph;
}

async function checkHomeSchema() {
  const res = await get('/');
  if (res.status !== 200) { fail('home page', `answered ${res.status}${res.error ? ` (${res.error})` : ''}`); return; }
  const graph = graphOf(res.body);
  if (!graph.length) { fail('home schema', 'no parseable JSON-LD on the home page'); return; }
  const types = new Set(graph.map((n) => n['@type']));
  const missing = ['Organization', 'WebSite', 'WebPage', 'Article', 'BreadcrumbList'].filter((t) => !types.has(t));
  if (missing.length) fail('home schema', `JSON-LD is missing ${missing.join(', ')}`);
  else {
    const org = graph.find((n) => n['@type'] === 'Organization') || {};
    const logo = org.logo && (typeof org.logo === 'string' ? org.logo : org.logo.url);
    if (!logo) fail('home schema', 'Organization carries no logo');
    else {
      const img = await get(logo);
      if (img.status !== 200) fail('home schema', `Organization logo ${logo} answered ${img.status}`);
      else pass('home schema', `Organization (logo 200), WebSite, WebPage, Article, BreadcrumbList all present`);
    }
  }
  const canonical = (res.body.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1] || '';
  if (canonical.replace(/\/$/, '') !== ORIGIN) fail('home canonical', `is "${canonical}", not ${ORIGIN}`);
  else pass('home canonical', canonical);
}

// -------------------------------------------------------------- the publisher
async function checkPublisherPage() {
  const res = await get('/about/', { redirect: 'manual' });
  if (res.status !== 200) fail('/about/', `answered ${res.status}${res.location ? ` -> ${res.location}` : ''}; every page names a publisher that must be resolvable`);
  else pass('/about/', `200 (${res.body.length} bytes)`);
}

// ------------------------------------------------------- redirects, no hops
async function checkMeasuredUrls() {
  const sitemap = await get('/sitemap-pages.xml');
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) { fail('measured URLs', 'could not read any URL from /sitemap-pages.xml to measure'); return; }
  // A spread across the corpus rather than the first N, which are all one section.
  const step = Math.max(1, Math.floor(locs.length / 12));
  const sample = locs.filter((_, i) => i % step === 0).slice(0, 12);
  const bad = [];
  for (const loc of sample) {
    const res = await get(loc, { redirect: 'manual' });
    if (res.status !== 200) bad.push(`${loc} -> ${res.status}${res.location ? ` ${res.location}` : ''}`);
  }
  if (bad.length) fail('measured URLs', `${bad.length}/${sample.length} sitemap URLs do not answer 200 directly:\n      ${bad.join('\n      ')}`);
  else pass('measured URLs', `${sample.length} sitemap URLs sampled across ${locs.length}, all 200 with no redirect hop`);

  // A redirect that is supposed to exist still has to land somewhere real.
  const red = await get('/therapeutic', { redirect: 'manual' });
  if (red.status !== 301) fail('/therapeutic redirect', `answered ${red.status}, expected a 301`);
  else {
    const target = await get(red.location.startsWith('http') ? red.location : `${ORIGIN}${red.location}`);
    if (target.status !== 200) fail('/therapeutic redirect', `301s to ${red.location}, which answered ${target.status}`);
    else pass('/therapeutic redirect', `301 -> ${red.location} (200)`);
  }
}

// ------------------------------------------------------------- IndexNow key
async function checkIndexNowKey() {
  const at = await get('/indexnow.txt');
  if (at.status !== 200) { fail('IndexNow key', `/indexnow.txt answered ${at.status}`); return; }
  const key = at.body.trim();
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) { fail('IndexNow key', `/indexnow.txt does not hold a valid key ("${key.slice(0, 40)}")`); return; }
  const atKey = await get(`/${key}.txt`);
  if (atKey.status !== 200) fail('IndexNow key', `/${key}.txt answered ${atKey.status}; IndexNow verifies the key at that path`);
  else if (atKey.body.trim() !== key) fail('IndexNow key', `/${key}.txt holds a different key than /indexnow.txt`);
  else pass('IndexNow key', `/indexnow.txt and /${key}.txt agree`);
}

// --------------------------------------------------------------------- main
const started = Date.now();
console.log(`live smoke check: ${ORIGIN}`);
await checkCrawlFiles();
await checkAssets();
await checkHomeSchema();
await checkPublisherPage();
await checkMeasuredUrls();
await checkIndexNowKey();

const failures = results.filter((r) => !r.ok);
for (const r of results) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}: ${r.detail}`);

// Rule 0: no stage may exit 0 having done nothing.
if (!results.length) {
  console.error('LIVE_SMOKE_FAIL: checked nothing. The origin answered no request at all, so "no problem found" was true of nothing.');
  process.exit(1);
}
if (failures.length) {
  console.error(`LIVE_SMOKE_FAIL: ${failures.length} of ${results.length} live checks failed against ${ORIGIN}.`);
  process.exit(1);
}
console.log(`live smoke check OK: ${results.length} checks passed against ${ORIGIN} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

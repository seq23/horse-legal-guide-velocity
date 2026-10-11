'use strict';
/**
 * Shared helpers for the measured search loop (data/search_intelligence/).
 *
 * Pattern copied from p-n-p scripts/search_intelligence/ and
 * local-guides-generator demand_families.js (copied, not imported: each repo
 * owns its own loop). CommonJS so the build (CommonJS) and the validators can
 * require the same rules the collectors use.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const SI = 'data/search_intelligence';
const FILES = Object.freeze({
  export: `${SI}/gsc_search_analytics_export.json`,
  truth: `${SI}/gsc_truth.json`,
  history: `${SI}/gsc_query_history.json`,
  coverage: `${SI}/index_coverage.json`,
  sitemaps: `${SI}/gsc_sitemaps.json`,
  targets: `${SI}/target_query_set.json`,
  intents: `${SI}/demand_intents.json`,
  families: `${SI}/demand_families.json`,
  strengthening: `${SI}/strengthening.json`,
  ledger: `${SI}/strengthening_ledger.json`,
  freeze: `${SI}/publish_freeze.json`,
  holds: `${SI}/publish_holds.json`,
  consolidation: `${SI}/consolidation_candidates.json`
});
const SITE_ORIGIN = 'https://horselegalguide.com';
const DEFAULT_PROPERTY = 'sc-domain:horselegalguide.com';

const abs = (rel) => path.resolve(ROOT, rel);
function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(abs(rel), 'utf8')); } catch { return fallback; }
}
function writeJson(rel, value) {
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  fs.writeFileSync(abs(rel), JSON.stringify(value, null, 2) + '\n');
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const round1 = (n) => Math.round(n * 10) / 10;
function routeOf(url) {
  try { return new URL(url, SITE_ORIGIN).pathname; } catch { return String(url || ''); }
}
const isoDate = (d) => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.abs(new Date(a) - new Date(b)) / 86400000;

/** Every URL the built sitemap lists (follows a sitemap index into its local children). */
function sitemapUrls(distDir = abs('dist')) {
  const read = (f) => { try { return fs.readFileSync(path.join(distDir, f), 'utf8'); } catch { return ''; } };
  const root = read('sitemap.xml');
  const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  if (/<sitemapindex/i.test(root)) {
    return [...new Set(locs(root).flatMap((child) => locs(read(path.basename(new URL(child).pathname)))))];
  }
  return [...new Set(locs(root))];
}

/** Does the built site serve this route (file, directory index, or a _redirects rule)? */
function servedByBuild(route, distDir = abs('dist')) {
  const clean = decodeURIComponent(route.split('?')[0].split('#')[0]);
  const rel = clean.replace(/^\//, '');
  const candidates = clean.endsWith('/')
    ? [path.join(rel, 'index.html')]
    : [rel, `${rel}.html`, path.join(rel, 'index.html')];
  if (candidates.some((c) => fs.existsSync(path.join(distDir, c)) && fs.statSync(path.join(distDir, c)).isFile())) return { ok: true, via: 'file' };
  const redirects = (() => { try { return fs.readFileSync(path.join(distDir, '_redirects'), 'utf8'); } catch { return ''; } })();
  for (const line of redirects.split('\n')) {
    const [from, , code] = line.trim().split(/\s+/);
    if (!from || from.startsWith('#')) continue;
    if (from === clean || from === clean.replace(/\/$/, '') || (from.endsWith('/*') && clean.startsWith(from.slice(0, -1)))) {
      if (String(code || '301') !== '404') return { ok: true, via: `_redirects ${line.trim()}` };
    }
  }
  return { ok: false, via: null };
}

// ---------- Google auth (service-account JWT, same rules as gsc_provider_ops.mjs) ----------
function serviceAccount() {
  const raw = String(process.env.GSC_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  if (raw.startsWith('{')) return JSON.parse(raw);
  if (fs.existsSync(raw)) return JSON.parse(fs.readFileSync(raw, 'utf8'));
  throw new Error('GSC_SERVICE_ACCOUNT_JSON is neither JSON nor a readable file path');
}
async function jsonFetch(url, opt = {}) {
  const res = await fetch(url, { ...opt, signal: AbortSignal.timeout(Number(process.env.GSC_TIMEOUT_MS || 60000)) });
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 600) }; }
  if (!res.ok) { const e = new Error(`${res.status} ${res.statusText}: ${JSON.stringify(body).slice(0, 400)}`); e.status = res.status; throw e; }
  return body;
}
async function googleToken(sa, scope) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (v) => Buffer.from(v).toString('base64url');
  const input = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), sa.private_key).toString('base64url');
  const r = await jsonFetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${input}.${sig}` })
  });
  return r.access_token;
}
/** 401/403 is the owner's grant, 429 the daily quota: both are named stops, never a red run. */
function heldReason(err) {
  if (err && (err.status === 401 || err.status === 403)) return 'HELD_CREDENTIAL';
  if (err && err.status === 429) return 'HELD_QUOTA';
  return null;
}

module.exports = {
  ROOT, SI, FILES, SITE_ORIGIN, DEFAULT_PROPERTY, abs, readJson, writeJson, norm, round1, routeOf, isoDate, daysBetween,
  sitemapUrls, servedByBuild, serviceAccount, jsonFetch, googleToken, heldReason
};

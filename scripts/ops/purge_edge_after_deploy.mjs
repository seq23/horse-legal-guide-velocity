#!/usr/bin/env node
/**
 * Purges the whole horselegalguide.com zone cache once a production deploy is
 * live, then proves the edge serves the new deployment. Run by
 * .github/workflows/edge-cache-purge.yml on every completed, successful
 * "Cloudflare Pages" check run on main - every deploy, including the one a
 * revoke produces, whoever pushed it.
 *
 * Why purge everything: any deploy can change any page (nav, related links,
 * section indexes), and the zone holds only this site. The revoke takedown
 * itself is also enforced at request time by functions/_shared/live_gate.js
 * on every zone MISS.
 *
 * Proof after purging: GET / twice. The first must be a MISS, or a HIT whose
 * `age` is younger than the purge (a visitor refilled it) - so the purge
 * landed; the second must be a HIT (caching still works). Either failing
 * exits non-zero - a red run, never a silent pass.
 *
 * Usage: CLOUDFLARE_API_TOKEN=... node scripts/ops/purge_edge_after_deploy.mjs [--dry-run]
 */
import { ZONE_ID, HOST } from './edge_cache_rule.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function purgeRequest() {
  return { url: `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, body: { purge_everything: true } };
}

async function cacheStatus(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'hlg-edge-cache-purge-check' } });
  await res.arrayBuffer();
  return { status: res.status, cache: (res.headers.get('cf-cache-status') || '').toUpperCase(), cc: res.headers.get('cache-control') || '', age: Number(res.headers.get('age') || 0) };
}

async function main() {
  const { url, body } = purgeRequest();
  if (process.argv.includes('--dry-run')) { console.log(`would POST ${url} ${JSON.stringify(body)}`); return; }
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set - the edge cache cannot be purged after this deploy.');
  // Let the production alias settle onto the new deployment before purging.
  await sleep(Number(process.env.PURGE_SETTLE_MS || 20000));
  const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(`purge_everything -> HTTP ${res.status} ${JSON.stringify(json.errors || [])}`);
  const purgedAt = Date.now();
  console.log('purge_everything: accepted');
  await sleep(5000);
  const probe = `https://${HOST}/`;
  const first = await cacheStatus(probe);
  const second = await cacheStatus(probe);
  const sincePurge = Math.ceil((Date.now() - purgedAt) / 1000);
  console.log(`after purge: first ${first.status} ${first.cache} age=${first.age}s (${first.cc}); second ${second.status} ${second.cache}; ${sincePurge}s since purge`);
  if (first.cache === 'HIT' && first.age > sincePurge) throw new Error(`/ is still a HIT ${first.age}s old, older than the purge ${sincePurge}s ago - the purge did not land`);
  if (first.status !== 200 || second.status !== 200) throw new Error('home page did not return 200 after the purge');
  if (!/s-maxage=\d+/.test(first.cc)) throw new Error(`home page lost its s-maxage header (${first.cc}) - functions/_shared/edge_cache.js is not running`);
  if (second.cache !== 'HIT') throw new Error(`second request was ${second.cache || 'no cf-cache-status'}, not HIT - the zone cache rule is not caching`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });

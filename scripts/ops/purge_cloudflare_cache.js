#!/usr/bin/env node
/**
 * Purges specific Cloudflare edge-cached URLs after an admin decision changes
 * what is live.
 *
 * The gap this closes: a revoke (or approval) correctly updates
 * data/system/editorial_backlog.json and dist/ immediately, but
 * horselegalguide.com serves these pages with `cache-control: public,
 * s-maxage=604800` (7 days), and a Cloudflare Pages deploy does not always
 * purge every edge location right away. Confirmed live 2026-09-03: after
 * revoking an article through the real GitHub-issue mechanism, the direct
 * deployment URL (https://horse-legal-guide-velocity.pages.dev/...) 404'd
 * immediately, while horselegalguide.com intermittently kept serving a stale
 * cached 200 for the same now-revoked article from some edge nodes. For a
 * legal-content client site, "down at origin, still up at the edge" is not
 * an acceptable resting state for a revoke - see RUNBOOK.md's
 * "Cache purge on revoke" section for the full writeup.
 *
 * Gated exactly the way scripts/social/email_credential_gate.mjs gates SMTP:
 * a missing owner-held credential is a NAMED STOP, not a build failure -
 * this always exits 0. CLOUDFLARE_API_TOKEN is a secret only the account
 * owner can supply (it needs the zone's Cache Purge permission); this script
 * neither invents nor stores one. CLOUDFLARE_ZONE_ID is not sensitive - it is
 * visible in the Cloudflare dashboard URL and safe to keep in the calling
 * workflow's plain env.
 *
 * Purges by specific URL only, never "purge everything" - this repo serves
 * hundreds of unrelated pages that must not be forced back through a cold
 * cache by an unrelated decision. A purge failure or missing credential never
 * blocks or reverses the decision it follows: this always exits 0, and the
 * calling workflow step should be `continue-on-error: true` regardless.
 *
 * Usage: SITE_DOMAIN=https://horselegalguide.com CLOUDFLARE_ZONE_ID=... \
 *   CLOUDFLARE_API_TOKEN=... ENTRY_IDS="id1 id2" \
 *   node scripts/ops/purge_cloudflare_cache.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = process.cwd();
const SITE_DOMAIN = String(process.env.SITE_DOMAIN || 'https://horselegalguide.com').replace(/\/$/, '');
const ZONE_ID = String(process.env.CLOUDFLARE_ZONE_ID || '').trim();
const API_TOKEN = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const SECTIONS = ['articles', 'insights', 'whitepapers', 'authority', 'templates'];

function readJson(rel, fallback) {
  const p = path.resolve(ROOT, rel);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function collectUrls(ids) {
  const backlog = readJson('data/system/editorial_backlog.json', []);
  const byId = new Map((Array.isArray(backlog) ? backlog : []).map((e) => [e.entry_id, e]));
  const urls = new Set();
  for (const id of ids) {
    const entry = byId.get(id);
    if (!entry) continue;
    // live_slug: the entry is live right now (an approval). previously_live_slug:
    // the entry was live and just got revoked. Purging both covers either
    // direction of this decision without needing to know which one happened.
    if (entry.live_slug) urls.add(`${SITE_DOMAIN}${entry.live_slug}`);
    if (entry.previously_live_slug) urls.add(`${SITE_DOMAIN}${entry.previously_live_slug}`);
  }
  // Section indexes list/delist entries on every approval or revoke; cheap to
  // include unconditionally rather than compute which ones actually changed.
  for (const section of SECTIONS) urls.add(`${SITE_DOMAIN}/${section}/`);
  return [...urls];
}

function purge(urls) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ files: urls });
    const req = https.request(
      {
        hostname: 'api.cloudflare.com',
        path: `/client/v4/zones/${ZONE_ID}/purge_cache`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', (err) => resolve({ status: 0, body: err.message }));
    req.write(payload);
    req.end();
  });
}

async function main() {
  const missing = [];
  if (!API_TOKEN) missing.push('CLOUDFLARE_API_TOKEN');
  if (!ZONE_ID) missing.push('CLOUDFLARE_ZONE_ID');
  if (missing.length) {
    console.log(
      `NAMED_STOP: CLOUDFLARE_CACHE_PURGE_DISABLED_MISSING_CREDENTIAL - ${missing.join(', ')} not set. ` +
      'data/system/editorial_backlog.json and dist/ are already correct from the decision itself; only the ' +
      "edge cache may lag until it expires or is purged manually from the Cloudflare dashboard (Caching -> " +
      'Configuration -> Purge Cache). This is a successful run - an owner-held credential nobody else can ' +
      'supply is a decision waiting on a person, not a broken build.'
    );
    process.exit(0);
  }

  const ids = String(process.env.ENTRY_IDS || '').split(/\s+/).filter(Boolean);
  const urls = collectUrls(ids);
  if (!urls.length) {
    console.log('CLOUDFLARE_CACHE_PURGE: nothing to purge (no entry IDs resolved to a URL).');
    process.exit(0);
  }

  const result = await purge(urls);
  let parsed = null;
  try { parsed = JSON.parse(result.body); } catch { /* not JSON */ }
  if (result.status === 200 && parsed && parsed.success) {
    console.log(`CLOUDFLARE_CACHE_PURGE_OK: purged ${urls.length} URL(s): ${urls.join(', ')}`);
    process.exit(0);
  }
  // Never block or reverse the decision this follows - log plainly and exit 0.
  console.log(
    `NAMED_FAILURE_NON_BLOCKING: CLOUDFLARE_CACHE_PURGE_FAILED - status ${result.status}, response: ` +
    `${String(result.body).slice(0, 500)}. The decision itself already applied and is not affected; the edge ` +
    'cache may lag until it expires or is purged manually.'
  );
  process.exit(0);
}

if (require.main === module) main();
module.exports = { collectUrls };

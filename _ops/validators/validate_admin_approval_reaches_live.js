#!/usr/bin/env node
/**
 * Rule 0 guard: an owner-approved, due editorial entry that is not live must
 * fail the build.
 *
 * Confirmed 2026-09-03: the owner approved 2 overdue articles in /admin/ and
 * neither the status nor the live site changed. Root cause was two-fold:
 *
 *   1. /admin/'s "Send approvals" button only opened a mailto: draft
 *      (scripts/release/build_site_release.js, sendDecision()). It never
 *      called the server, so data/system/editorial_backlog.json was never
 *      touched and nothing was ever approved server-side.
 *   2. Even when an entry IS approved server-side and past its publish date,
 *      no validator checked that write_editorial_pages.js actually rendered
 *      it live. validate_editorial_system.js only checks the reverse
 *      direction - that every entry write_editorial_pages.js already put in
 *      dist/editorial-publishing-state.json's live_entries has a file on
 *      disk. That is circular: the file it just wrote obviously exists. It
 *      never asks "does every approved, due backlog entry actually appear in
 *      live_entries at all" - so an approval that silently failed to reach
 *      publication stayed invisible.
 *
 * This validator asks the missing question directly: for every backlog entry
 * that is approved and past its publish date, is it present in
 * dist/editorial-publishing-state.json's live_entries AND does its rendered
 * page exist under dist/? A gap on either side is a hard failure, and finding
 * zero approved-due entries to examine is fine (nothing approved yet is a
 * legitimate state) - but a missing or unreadable state file, or an empty
 * backlog, is not, and fails loudly rather than passing vacuously.
 *
 * The reverse of THIS validator's own revoke check (below, "Rule 0 guard,
 * other direction") only asked whether dist/ - the local build output - still
 * had the revoked page. Confirmed 2026-09-03: dist/ and
 * data/system/editorial_backlog.json were both correct immediately after a
 * revoke, yet horselegalguide.com kept serving the revoked page with HTTP 200
 * for hours - a Cloudflare Pages edge-cache behaviour that survives both a
 * per-URL purge and "Purge Everything" (see RUNBOOK.md's "Cache purge on
 * revoke" and functions/_shared/live_gate.js, the request-time gate added to
 * fix it). Checking dist/ alone cannot catch that class of failure - only an
 * actual HTTP request to the live custom domain can. --verify-live-domain (or
 * VERIFY_LIVE_DOMAIN=1) turns that check on: it is opt-in, not part of the
 * default offline run, because it needs network access to the real deployed
 * site and only means something after a deploy has had time to land.
 *
 * Usage: node _ops/validators/validate_admin_approval_reaches_live.js
 *        node _ops/validators/validate_admin_approval_reaches_live.js --verify-live-domain
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ensureExists, readJson, fail, ok, assertExamined } = require('./helpers');

const ROOT = process.cwd();

function today() {
  return process.env.PUBLISH_TODAY || new Date().toISOString().slice(0, 10);
}
function isApproved(entry) {
  return entry.status === 'approved' || entry.review_status === 'approved' || entry.status === 'published';
}
function publishDate(entry) {
  return entry.publish_date || entry.scheduled_date || entry.date;
}
function isDue(entry, t) {
  const d = publishDate(entry);
  return /^\d{4}-\d{2}-\d{2}$/.test(d || '') && d <= t;
}

/**
 * The missing reverse: does the real live custom domain actually agree with
 * dist/? Every other check in this file only reads the local filesystem.
 * Retries with backoff because a decision that just pushed to main has to
 * wait for Cloudflare Pages' own git-triggered build/deploy to land before
 * this check means anything - a request made 5 seconds after the push is
 * expected to still see the old deployment, not a defect.
 */
async function fetchStatus(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'manual' });
  // Drain the body so the connection can be reused/closed cleanly across the
  // retry loop's many requests.
  try { await res.arrayBuffer(); } catch { /* status is what matters */ }
  return res.status;
}

async function verifyRevokedNotLiveOnDomain(backlog, approvedDueIds, siteDomain, opts = {}) {
  const retries = opts.retries ?? 6;
  const delayMs = opts.delayMs ?? 20000;
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

  const revoked = backlog.filter(
    (e) => e.revoked_from_live && e.previously_live_slug && !approvedDueIds.has(e.entry_id)
  );
  if (!revoked.length) {
    console.log(
      'LIVE_DOMAIN_REVOKE_CHECK: no revoked-and-not-currently-live entries to verify against ' +
      `${siteDomain} - nothing to examine, which is a legitimate state (no revokes have happened yet).`
    );
    return;
  }

  const stillLive = [];
  let examined = 0;
  for (const entry of revoked) {
    const url = `${siteDomain.replace(/\/$/, '')}${entry.previously_live_slug}`;
    let status = null;
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        status = await fetchStatus(url);
      } catch (err) {
        lastError = err;
        status = null;
      }
      if (status !== 200) break; // confirmed down (or a network error we still want to retry)
      if (attempt < retries) await sleep(delayMs);
    }
    examined += 1;
    if (status === 200) {
      stillLive.push(`${entry.entry_id}: ${url} still returns HTTP 200 after ${retries + 1} check(s) - it is reachable on the live custom domain despite being revoked`);
    } else if (status === null) {
      // A network failure that never resolved to a real status is not proof
      // of anything - it must not be reported as a silent pass.
      fail(`LIVE_DOMAIN_REVOKE_CHECK_NETWORK_FAILURE: could not reach ${url} after ${retries + 1} attempt(s) (${lastError ? lastError.message : 'unknown error'}). A revoked page's live reachability must be positively confirmed, not assumed absent evidence.`);
    }
  }

  assertExamined('LIVE_DOMAIN_REVOKE_CHECK', examined, revoked.length);

  if (stillLive.length) {
    console.error(`LIVE_DOMAIN_REVOKE_STILL_REACHABLE_FAIL: revoked page(s) are still reachable on ${siteDomain}:`);
    for (const g of stillLive) console.error(`- ${g}`);
    process.exit(1);
  }

  console.log(`LIVE_DOMAIN_REVOKE_TAKEDOWN_CONFIRMED: ${examined} revoked page(s) confirmed unreachable (non-200) on ${siteDomain}.`);
}

async function main() {
  ensureExists('data/system/editorial_backlog.json');
  const backlog = readJson('data/system/editorial_backlog.json');
  if (!Array.isArray(backlog) || !backlog.length) {
    fail('data/system/editorial_backlog.json is empty or not an array. Cannot verify any approval reaches the live site.');
  }

  ensureExists('dist/editorial-publishing-state.json');
  const state = readJson('dist/editorial-publishing-state.json');
  const liveIds = new Set((state.live_entries || []).map((e) => e.entry_id));

  const t = today();
  const approvedDue = backlog.filter(
    (entry) => isApproved(entry) && isDue(entry, t) && entry.github_path && fs.existsSync(path.resolve(ROOT, entry.github_path))
  );

  const gaps = [];
  for (const entry of approvedDue) {
    if (!liveIds.has(entry.entry_id)) {
      gaps.push(`${entry.entry_id}: approved and due ${publishDate(entry)} but missing from dist/editorial-publishing-state.json live_entries`);
      continue;
    }
    const liveEntry = (state.live_entries || []).find((e) => e.entry_id === entry.entry_id);
    const renderedFile = path.resolve(ROOT, 'dist', String(liveEntry.live_slug || '').replace(/^\/+/, ''), 'index.html');
    if (!fs.existsSync(renderedFile)) {
      gaps.push(`${entry.entry_id}: listed live but rendered file missing at ${renderedFile}`);
    }
  }

  // The other direction of the same defect class, found while fixing this:
  // scripts/build/write_editorial_pages.js used to compute live_slug/section
  // for every backlog entry in memory (needed for its own rendering pass) but
  // never persisted it to data/system/editorial_backlog.json - so
  // scripts/admin/generate_admin_manifest.js, which re-reads that file fresh,
  // always saw public_url:null for every entry, live or not, and /admin/'s
  // "Pages published by this system" card said "0...never" beside a genuinely
  // correct "Approved: 2". Persisting it (scoped to only the entries that
  // actually pass the approved+due+rendered gate) fixed the undercount; this
  // asserts the fix cannot regress into an OVERcount either - an entry must
  // not claim live_slug unless it is genuinely in the live set.
  const approvedDueIds = new Set(approvedDue.map((e) => e.entry_id));
  const overclaims = backlog
    .filter((e) => e.live_slug)
    .filter((e) => !liveIds.has(e.entry_id) || !approvedDueIds.has(e.entry_id))
    .map((e) => e.entry_id);
  if (overclaims.length) {
    gaps.push(`${overclaims.length} backlog entr${overclaims.length === 1 ? 'y claims' : 'ies claim'} live_slug without being genuinely live/approved/due: ${overclaims.slice(0, 10).join(', ')}`);
  }

  // The other direction this validator's name promises: "revoke this one"
  // (scripts/admin/_common.js rejectEntry, the third /admin/ decision) is a
  // revoke - it must take an entry down, and take-down must actually reach
  // the same dist/editorial-publishing-state.json truth this validator
  // already checks approval against. A revoked entry that still shows up in
  // live_entries, or that still has a rendered dist/ page at its former
  // live_slug, is exactly as broken as an approved entry that never went
  // live - it is just the opposite direction of the identical defect class.
  //
  // Revoked entries are identified by revoked_from_live/previously_live_slug,
  // not by status: owner instruction (2026-09-03) is that "revoke this one"
  // returns an entry to status "pending" (the same "waiting for you" bucket
  // as anything undecided) rather than a separate "rejected" status, so the
  // revoke history has to be asked from its own dedicated, sticky fields -
  // see rejectEntry() in scripts/admin/_common.js. This also correctly
  // covers the full lifecycle: an entry revoked, then re-approved and live
  // again, is excluded below via approvedDueIds - it is legitimately live and
  // this is not a gap.
  const everRevokedFromLive = backlog.filter((entry) => entry.revoked_from_live && entry.previously_live_slug);
  const revokeGaps = [];
  for (const entry of everRevokedFromLive) {
    if (approvedDueIds.has(entry.entry_id)) continue; // re-approved since the revoke; legitimately live again
    if (liveIds.has(entry.entry_id)) {
      revokeGaps.push(`${entry.entry_id}: has revoke history and is not currently approved+due, but still present in dist/editorial-publishing-state.json live_entries`);
      continue;
    }
    if (entry.live_slug) {
      revokeGaps.push(`${entry.entry_id}: has revoke history and is not currently approved+due, but backlog entry still carries a live_slug (${entry.live_slug}) - write_editorial_pages.js should have cleared it`);
    }
    const previousSlug = entry.previously_live_slug;
    const stillRendered = fs.existsSync(path.resolve(ROOT, 'dist', String(previousSlug).replace(/^\/+/, ''), 'index.html'));
    if (stillRendered) {
      revokeGaps.push(`${entry.entry_id}: has revoke history and is not currently approved+due, but dist/${String(previousSlug).replace(/^\/+/, '')}index.html still exists - the page did not actually come down`);
    }
  }

  if (gaps.length || revokeGaps.length) {
    if (gaps.length) {
      console.error('ADMIN_APPROVAL_NOT_LIVE_FAIL: approved, due editorial entries did not reach the live site:');
      for (const g of gaps) console.error(`- ${g}`);
    }
    if (revokeGaps.length) {
      console.error('ADMIN_REVOKE_STILL_LIVE_FAIL: revoked ("revoke this one") editorial entries did not actually come down:');
      for (const g of revokeGaps) console.error(`- ${g}`);
    }
    process.exit(1);
  }

  console.log(`ADMIN_APPROVAL_LIVE_COVERAGE: ${approvedDue.length} approved-and-due editorial entr${approvedDue.length === 1 ? 'y is' : 'ies are'} live, checked against ${backlog.length} total backlog entries.`);
  console.log(`ADMIN_REVOKE_TAKEDOWN_COVERAGE: ${everRevokedFromLive.length} revoked entr${everRevokedFromLive.length === 1 ? 'y is' : 'ies are'} confirmed not live, checked against ${backlog.length} total backlog entries.`);

  const verifyLiveDomain = process.argv.includes('--verify-live-domain') || process.env.VERIFY_LIVE_DOMAIN === '1';
  if (verifyLiveDomain) {
    const siteDomain = process.env.SITE_DOMAIN || 'https://horselegalguide.com';
    // A decision issue pushes to main immediately before this runs; Cloudflare
    // Pages' own git-triggered build/deploy needs time to land before a
    // request here means anything. Overridable so a caller with a slower or
    // faster deploy can tune it without editing this file.
    const retries = Number(process.env.LIVE_DOMAIN_CHECK_RETRIES ?? 6);
    const delayMs = Number(process.env.LIVE_DOMAIN_CHECK_DELAY_MS ?? 20000);
    await verifyRevokedNotLiveOnDomain(backlog, approvedDueIds, siteDomain, { retries, delayMs });
  }

  ok(`Every approved, due editorial entry is live (${approvedDue.length} checked), and every revoked entry is confirmed down (${everRevokedFromLive.length} checked)${verifyLiveDomain ? ', and the live custom domain agrees' : ''}.`);
}

if (require.main === module) { main().catch((err) => fail(err && err.stack ? err.stack : String(err))); }
module.exports = { isApproved, isDue, publishDate, today, verifyRevokedNotLiveOnDomain };

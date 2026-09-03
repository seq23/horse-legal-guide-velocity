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
 * Usage: node _ops/validators/validate_admin_approval_reaches_live.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ensureExists, readJson, fail, ok } = require('./helpers');

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

function main() {
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
  ok(`Every approved, due editorial entry is live (${approvedDue.length} checked), and every revoked entry is confirmed down (${everRevokedFromLive.length} checked).`);
}

if (require.main === module) main();
module.exports = { isApproved, isDue, publishDate, today };

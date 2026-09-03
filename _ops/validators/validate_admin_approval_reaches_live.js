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

  if (gaps.length) {
    console.error('ADMIN_APPROVAL_NOT_LIVE_FAIL: approved, due editorial entries did not reach the live site:');
    for (const g of gaps) console.error(`- ${g}`);
    process.exit(1);
  }

  console.log(`ADMIN_APPROVAL_LIVE_COVERAGE: ${approvedDue.length} approved-and-due editorial entr${approvedDue.length === 1 ? 'y is' : 'ies are'} live, checked against ${backlog.length} total backlog entries.`);
  ok(`Every approved, due editorial entry is live (${approvedDue.length} checked).`);
}

if (require.main === module) main();
module.exports = { isApproved, isDue, publishDate, today };

#!/usr/bin/env node
/**
 * Guards against the defect class behind resolve_live_public_url() in
 * scripts/social/send_approved_content_email.py: a field read from a backlog
 * entry (entry.get("X")) that no code path in this repo has ever actually
 * written onto a backlog entry - dead since the day it was written, and
 * invisible for exactly that reason: nothing else in the pipeline needed the
 * field to exist, so a read that could never match anything produced no
 * error, no warning, just a function that quietly always returned None.
 * Confirmed 2026-09-03: that function read public_url/live_url/url/preview_url,
 * none of which scripts/build/write_editorial_pages.js or scripts/admin/_common.js
 * (the only writers of backlog-entry fields) ever assign - only live_slug is
 * real. The "go-live" notification email had therefore never fired for any
 * article this repo ever published.
 *
 * What this checks: for each {file, dataFile} pair in CHECKS, every
 * `entry.get("field")` read in `file` must name a field that either (a)
 * appears as a key on at least one record currently in `dataFile`, or (b) is
 * assigned by one of WRITER_FILES - checked separately because a real field
 * can be legitimately sparse in the CURRENT snapshot (live_slug only exists
 * on entries that are live right now, which can be zero) without being dead.
 *
 * Deliberately narrow rather than a repo-wide "any entry.get() anywhere"
 * scan: CHECKS and WRITER_FILES are a short, curated list. This exists to
 * guard the one confirmed defect and its exact shape, not to be a general
 * schema linter that would need much more care to avoid false positives on
 * every other dict this repo happens to call something called "entry".
 *
 * Usage: node _ops/validators/validate_backlog_field_accessors.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { fail, ok } = require('./helpers');

const ROOT = process.cwd();

const WRITER_FILES = [
  'scripts/admin/_common.js',
  'scripts/build/write_editorial_pages.js',
];

const CHECKS = [
  {
    file: 'scripts/social/send_approved_content_email.py',
    dataFile: 'data/system/editorial_backlog.json',
    pattern: /\bentry\.get\(\s*["']([a-zA-Z0-9_]+)["']/g,
  },
];

function knownBacklogFields(dataFile) {
  const fields = new Set();
  const dataPath = path.resolve(ROOT, dataFile);
  if (fs.existsSync(dataPath)) {
    const records = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    for (const record of Array.isArray(records) ? records : []) {
      for (const key of Object.keys(record || {})) fields.add(key);
    }
  }
  for (const rel of WRITER_FILES) {
    const p = path.resolve(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/\b(?:entry|e)\.([a-zA-Z0-9_]+)\s*=/g)) fields.add(m[1]);
    for (const m of src.matchAll(/\bdelete\s+(?:entry|e)\.([a-zA-Z0-9_]+)/g)) fields.add(m[1]);
  }
  return fields;
}

function main() {
  const failures = [];
  let checkedReads = 0;

  for (const check of CHECKS) {
    const known = knownBacklogFields(check.dataFile);
    if (!known.size) {
      failures.push(`${check.dataFile}: could not build a known-field list (missing, empty, or no writer file readable) - examined nothing.`);
      continue;
    }
    const p = path.resolve(ROOT, check.file);
    if (!fs.existsSync(p)) { failures.push(`${check.file}: file missing`); continue; }
    const src = fs.readFileSync(p, 'utf8');
    const seen = new Set();
    for (const m of src.matchAll(check.pattern)) seen.add(m[1]);
    if (!seen.size) {
      failures.push(`${check.file}: GATE_EXAMINED_NOTHING - no entry.get(...) reads found; this check has proven nothing about it.`);
      continue;
    }
    for (const field of seen) {
      checkedReads += 1;
      if (!known.has(field)) {
        failures.push(
          `${check.file}: reads entry.get("${field}") but no record in ${check.dataFile} has ever carried "${field}" as a key, ` +
          `and no known writer (${WRITER_FILES.join(', ')}) ever assigns it - this field looks dead, exactly like the ` +
          'resolve_live_public_url() bug this guards against.'
        );
      }
    }
  }

  if (failures.length) {
    console.error('BACKLOG_FIELD_ACCESSOR_FAIL: field(s) read from a backlog entry that nothing in this repo ever writes:');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }

  ok(`${checkedReads} backlog-entry field read(s) checked across ${CHECKS.length} file(s); every one corresponds to a field something in this repo actually writes.`);
}

if (require.main === module) main();
module.exports = { knownBacklogFields };

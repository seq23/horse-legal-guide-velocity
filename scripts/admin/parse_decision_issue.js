#!/usr/bin/env node
/**
 * Parses the fixed "Action: <kind>\nIDs: <space-separated entry_ids>" header
 * that scripts/release/build_site_release.js's /admin/ page writes into a
 * GitHub issue body (see buildDecisionIssueUrl in that file), and that
 * .github/workflows/admin-decision-issue.yml reads to apply the decision.
 *
 * Deliberately a fixed two-line header rather than free text: the issue body
 * is untrusted, publicly-editable input on a public repo, so the workflow
 * that consumes it must never interpret it as anything richer than this exact
 * shape.
 *
 * Usage: ISSUE_BODY_FILE=path/to/body.txt node scripts/admin/parse_decision_issue.js
 * Prints {"action":...,"script":...,"ids":[...]} to stdout on success, or
 * writes an error message to stderr and exits 1.
 */
'use strict';
const fs = require('fs');

const ACTION_TO_SCRIPT = {
  approve: 'scripts/admin/approve_many.js',
  reject: 'scripts/admin/reject_many.js',
  needs_revision: 'scripts/admin/mark_many_needs_revision.js',
};

function parseDecisionIssue(body) {
  const text = String(body || '').replace(/\r\n/g, '\n');
  const actionMatch = text.match(/^Action:\s*(\S+)\s*$/m);
  if (!actionMatch) throw new Error('No "Action: <approve|reject|needs_revision>" line found in the issue body.');
  const action = actionMatch[1].trim().toLowerCase();
  if (!ACTION_TO_SCRIPT[action]) {
    throw new Error(`Unknown action "${action}". Must be one of: ${Object.keys(ACTION_TO_SCRIPT).join(', ')}.`);
  }
  const idsMatch = text.match(/^IDs:\s*(.+)$/m);
  if (!idsMatch) throw new Error('No "IDs: <space-separated entry_id list>" line found in the issue body.');
  const ids = [...new Set(idsMatch[1].split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
  if (!ids.length) throw new Error('The "IDs:" line was present but named no entry IDs.');
  if (ids.length > 200) throw new Error('At most 200 IDs may be submitted at once.');
  for (const id of ids) {
    if (!/^[a-zA-Z0-9._:/-]{1,180}$/.test(id)) throw new Error(`Invalid entry ID: ${id}`);
  }
  return { action, script: ACTION_TO_SCRIPT[action], ids };
}

function main() {
  const file = process.env.ISSUE_BODY_FILE;
  if (!file) {
    process.stderr.write('ISSUE_BODY_FILE environment variable is required.');
    process.exit(1);
  }
  let body;
  try {
    body = fs.readFileSync(file, 'utf8');
  } catch (err) {
    process.stderr.write(`Could not read ${file}: ${err.message}`);
    process.exit(1);
  }
  try {
    const parsed = parseDecisionIssue(body);
    process.stdout.write(JSON.stringify(parsed));
  } catch (err) {
    process.stderr.write(String(err.message || err));
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { parseDecisionIssue, ACTION_TO_SCRIPT };

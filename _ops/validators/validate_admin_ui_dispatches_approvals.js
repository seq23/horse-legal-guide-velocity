#!/usr/bin/env node
/**
 * Rule 0 guard: /admin/'s decision buttons must be capable of actually
 * approving something, not just drafting an email nobody is required to send.
 *
 * Confirmed 2026-09-03: /admin/'s "Send approvals" button (sendDecision() in
 * scripts/release/build_site_release.js) only built a mailto: link. Clicking
 * it never called the server, so an owner approval taken there could never
 * change data/system/editorial_backlog.json or reach the live site - matching
 * both reported symptoms (status never changed in /admin, nothing went live).
 * The GitHub-authenticated dispatch endpoint the fix now calls
 * (/api/admin/action -> admin-bulk-content-actions.yml -> approve_many.js)
 * already existed and was already documented as available from /admin/ in
 * docs/runbooks/GITHUB_ADMIN_AUTH_SETUP.md's own verification checklist - it
 * was simply never wired to a button. This is a structural regression guard
 * for that wiring, checked directly against the built dist/admin/index.html
 * output rather than the source, so it fails if a future build stops emitting
 * it for any reason.
 *
 * Usage: node _ops/validators/validate_admin_ui_dispatches_approvals.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { fail, ok } = require('./helpers');

function main() {
  const file = path.resolve(process.cwd(), 'dist/admin/index.html');
  if (!fs.existsSync(file)) {
    fail('ADMIN_UI_APPROVAL_WIRING_FAIL: dist/admin/index.html does not exist. Run `npm run build` first; a gate that cannot read the built admin page has examined nothing.');
  }
  const html = fs.readFileSync(file, 'utf8');

  const required = [
    { marker: '/api/admin/action', why: 'a decision must be able to POST to the real GitHub-authenticated dispatch endpoint' },
    { marker: '/api/admin/github/session', why: 'the page must check GitHub sign-in before deciding whether a decision can actually publish' },
    { marker: 'approve_selected', why: 'the approve decision must map to the real admin-bulk-content-actions.yml action, not only an email draft' },
    { marker: 'adminSession', why: 'the send-decision handler must branch on a real session rather than always falling back to mailto' },
  ];

  const missing = required.filter((r) => !html.includes(r.marker));
  if (missing.length) {
    console.error('ADMIN_UI_APPROVAL_WIRING_FAIL: dist/admin/index.html no longer dispatches real approvals:');
    for (const m of missing) console.error(`- missing "${m.marker}": ${m.why}`);
    process.exit(1);
  }

  // The mailto fallback is allowed to remain (useful when no GitHub session is
  // present), but it must not be the ONLY path a signed-in reviewer can take -
  // i.e. the page must not unconditionally redirect to mailto: for a decision.
  if (!/if\s*\(\s*adminSession\s*&&\s*adminSession\.authenticated\s*\)/.test(html)) {
    fail('ADMIN_UI_APPROVAL_WIRING_FAIL: dist/admin/index.html has no conditional branch on an authenticated GitHub session; a decision cannot be told apart from an unauthenticated mailto-only request.');
  }

  ok('dist/admin/index.html wires decision buttons to the real GitHub-authenticated approval dispatch (checked 4 markers + 1 structural branch).');
}

if (require.main === module) main();

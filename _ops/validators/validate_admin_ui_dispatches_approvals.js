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
 *
 * The first fix attempt wired decisions to the GitHub-OAuth-gated
 * /api/admin/action endpoint /agency/ already uses - but a live check of
 * https://horselegalguide.com/api/admin/github/session on 2026-09-03 returned
 * provider_configured:false and /api/admin/github/login returned HTTP 500,
 * confirming that path's Cloudflare Pages secrets are not configured. A prior
 * PR (see docs/runbooks/GITHUB_ADMIN_AUTH_SETUP.md) had already removed that
 * exact control from /admin/ for that reason, guarded by
 * validate_github_admin_functions.js, which fails the build if /admin/
 * advertises it again while unconfigured. Reintroducing it would have
 * reproduced the same "advertises a capability that doesn't work" defect this
 * repo already fixed once.
 *
 * The real fix routes decisions through .github/workflows/admin-decision-issue.yml
 * instead: a decision opens a pre-filled GitHub issue (needs only a free
 * GitHub account, no unconfigured secret), which that workflow reads,
 * authorizes against the issue author's actual repo permission, and applies
 * with the same approve_many.js / reject_many.js / mark_many_needs_revision.js
 * admin-bulk-content-actions.yml already uses. This validator checks that
 * wiring is present in the built page and that the consuming workflow exists.
 *
 * Usage: node _ops/validators/validate_admin_ui_dispatches_approvals.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { fail, ok } = require('./helpers');

function main() {
  const adminFile = path.resolve(process.cwd(), 'dist/admin/index.html');
  if (!fs.existsSync(adminFile)) {
    fail('ADMIN_UI_APPROVAL_WIRING_FAIL: dist/admin/index.html does not exist. Run `npm run build` first; a gate that cannot read the built admin page has examined nothing.');
  }
  const html = fs.readFileSync(adminFile, 'utf8');

  const required = [
    { marker: '/issues/new', why: 'a decision must open a real GitHub issue-creation request, not only draft an email' },
    { marker: 'admin-decision', why: 'the opened issue must carry the label admin-decision-issue.yml filters on' },
    { marker: 'Action: ', why: 'the issue body must carry the fixed "Action: <kind>" header parse_decision_issue.js reads' },
    { marker: 'IDs: ', why: 'the issue body must carry the fixed "IDs: <ids>" header parse_decision_issue.js reads' },
    { marker: 'buildDecisionIssueUrl', why: 'the page must build the issue URL itself rather than relying on an unconfigured server endpoint' },
  ];
  const missing = required.filter((r) => !html.includes(r.marker));
  if (missing.length) {
    console.error('ADMIN_UI_APPROVAL_WIRING_FAIL: dist/admin/index.html no longer opens a real decision request:');
    for (const m of missing) console.error(`- missing "${m.marker}": ${m.why}`);
    process.exit(1);
  }

  // The two known-broken paths must not quietly return: mailto as the ONLY
  // control (the original bug), or the OAuth-gated action endpoint while it
  // stays unconfigured (the first fix attempt, caught by
  // validate_github_admin_functions.js's own inverted checks).
  if (!/window\.open\(buildDecisionIssueUrl/.test(html)) {
    fail('ADMIN_UI_APPROVAL_WIRING_FAIL: sendDecision() no longer opens the GitHub issue URL as the primary decision path.');
  }
  if (html.includes('/api/admin/action') || html.includes('x-hlg-admin-csrf')) {
    fail('ADMIN_UI_APPROVAL_WIRING_FAIL: dist/admin/index.html references the unconfigured OAuth action endpoint again; validate_github_admin_functions.js will also fail this for the same reason.');
  }

  const workflow = path.resolve(process.cwd(), '.github/workflows/admin-decision-issue.yml');
  if (!fs.existsSync(workflow)) {
    fail('ADMIN_UI_APPROVAL_WIRING_FAIL: .github/workflows/admin-decision-issue.yml is missing; the issue this page opens has nothing to consume it.');
  }
  const workflowSrc = fs.readFileSync(workflow, 'utf8');
  for (const marker of ['admin-decision', 'getCollaboratorPermissionLevel', 'parse_decision_issue.js']) {
    if (!workflowSrc.includes(marker)) {
      fail(`ADMIN_UI_APPROVAL_WIRING_FAIL: .github/workflows/admin-decision-issue.yml is missing expected marker "${marker}".`);
    }
  }

  const parser = path.resolve(process.cwd(), 'scripts/admin/parse_decision_issue.js');
  if (!fs.existsSync(parser)) {
    fail('ADMIN_UI_APPROVAL_WIRING_FAIL: scripts/admin/parse_decision_issue.js is missing; the issue-consuming workflow has nothing to parse the decision with.');
  }

  ok('dist/admin/index.html opens a real GitHub-issue decision request, and .github/workflows/admin-decision-issue.yml exists to apply it with an author-permission check.');
}

if (require.main === module) main();

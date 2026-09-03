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
    { marker: 'This will take down', why: '"revoke this one" must confirm and name a live article before taking it down, never as a silent side effect' },
    { marker: 'Revoke this one', why: 'the third decision option must say what it does ("Revoke this one"), not the unclear "Not this one"' },
  ];
  const missing = required.filter((r) => !html.includes(r.marker));
  if (missing.length) {
    console.error('ADMIN_UI_APPROVAL_WIRING_FAIL: dist/admin/index.html no longer opens a real decision request:');
    for (const m of missing) console.error(`- missing "${m.marker}": ${m.why}`);
    process.exit(1);
  }
  if (html.includes('Not this one')) {
    fail('ADMIN_UI_APPROVAL_WIRING_FAIL: dist/admin/index.html still contains "Not this one" - renamed to "Revoke this one" everywhere; the old, unclear phrase must not linger.');
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

  // Second surface, same defect class: scripts/build/write_draft_previews.js
  // renders one page per queued draft under dist/admin/drafts/, and each used
  // to carry its OWN independent "Your decision" card - a second, unnoticed
  // instance of the exact mailto-only stub /admin/'s queue page had. Checking
  // only the queue page (dist/admin/index.html, above) would have let that
  // second inert control ship silently forever. Examining zero preview pages
  // here (an empty dist/admin/drafts/) is itself a failure, not a pass.
  const previewFiles = fs.existsSync(path.resolve(process.cwd(), 'dist/admin/drafts'))
    ? fs.readdirSync(path.resolve(process.cwd(), 'dist/admin/drafts'), { recursive: true })
        .filter((f) => String(f).endsWith('index.html') && String(f) !== 'index.html')
        .map((f) => path.resolve(process.cwd(), 'dist/admin/drafts', f))
    : [];
  if (!previewFiles.length) {
    fail('ADMIN_UI_APPROVAL_WIRING_FAIL: GATE_EXAMINED_NOTHING - 0 per-draft preview pages found under dist/admin/drafts/. Run `npm run build` first; a gate that examines no preview pages has proven nothing about them.');
  }
  const previewFailures = [];
  // The owner reported this exact card wrong twice in production while the
  // generator source looked correct - a gap between "the template says X"
  // and "the deployed page renders X" that a build-time check on dist/ is
  // exactly positioned to close (dist/ is what actually ships). Each pair
  // names the property and why it must hold; a page missing any of them, or
  // still carrying a property it must NOT have, fails by name.
  const PREVIEW_REQUIRED = [
    { marker: 'Edit the content calendar in GitHub', why: 'the calendar-record edit link must be labelled for what it actually opens (schedule/status), not left as "Edit this draft"' },
    { marker: 'editorial_backlog.json', why: 'the calendar edit link must target the schedule/status record, not the draft markdown source' },
    { marker: 'id="executive-assistant"', why: 'the email fallback must be its own labelled, subordinate area, not a "No GitHub account?" line inside the decision card' },
    { marker: 'Executive assistant', why: 'the subordinate email-fallback area must be headed plainly, in the page\'s own heading style, not framed as a question' },
    { marker: 'Revoke this one', why: 'the third decision option must say what it does ("Revoke this one"), not the unclear "Not this one"' },
  ];
  const PREVIEW_FORBIDDEN = [
    { marker: 'Read the source markdown', why: 'this link was reported superfluous by the owner and must be deleted outright, not hidden or collapsed' },
    { marker: 'Edit this draft on GitHub', why: 'superseded by "Edit the content calendar in GitHub" - the old label must not still be present' },
    { marker: 'No GitHub account?', why: 'superseded by the labelled "Executive assistant" block - the old question-framed line must not still be present' },
    { marker: 'Not this one', why: 'renamed to "Revoke this one" everywhere - the old, unclear phrase must not linger anywhere on this page' },
  ];
  for (const file of previewFiles) {
    const previewHtml = fs.readFileSync(file, 'utf8');
    const rel = path.relative(process.cwd(), file);
    if (!previewHtml.includes('buildDecisionIssueUrl') || !previewHtml.includes('admin-decision') || !previewHtml.includes('This will take down')) {
      previewFailures.push(rel);
    }
    if (previewHtml.includes('/api/admin/action') || previewHtml.includes('x-hlg-admin-csrf')) {
      previewFailures.push(`${rel} (references the unconfigured OAuth action endpoint)`);
    }
    for (const { marker, why } of PREVIEW_REQUIRED) {
      if (!previewHtml.includes(marker)) previewFailures.push(`${rel} (missing "${marker}": ${why})`);
    }
    for (const { marker, why } of PREVIEW_FORBIDDEN) {
      if (previewHtml.includes(marker)) previewFailures.push(`${rel} (still contains "${marker}": ${why})`);
    }
  }
  if (previewFailures.length) {
    console.error(`ADMIN_UI_APPROVAL_WIRING_FAIL: ${previewFailures.length} issue(s) across ${previewFiles.length} per-draft preview page(s):`);
    for (const f of previewFailures.slice(0, 20)) console.error(`- ${f}`);
    process.exit(1);
  }

  // General property, stated once rather than one marker at a time: no
  // decision control anywhere on this admin surface may exist that this gate
  // never actually counted. A page that swapped every real data-decision
  // button for something else while still passing every marker check above
  // (each marker only needs to appear ONCE, anywhere in the file) would slip
  // through the checks above undetected. Count the controls themselves, on
  // every examined page, and hard-fail if the count is zero anywhere - a gate
  // that examines zero decision controls has proven nothing about them.
  const allFiles = [{ label: 'dist/admin/index.html', src: html }, ...previewFiles.map((f) => ({ label: path.relative(process.cwd(), f), src: fs.readFileSync(f, 'utf8') }))];
  const zeroControlPages = [];
  let totalControls = 0;
  for (const { label, src } of allFiles) {
    const count = (src.match(/data-decision="/g) || []).length;
    totalControls += count;
    if (count === 0) zeroControlPages.push(label);
  }
  if (zeroControlPages.length) {
    console.error(`ADMIN_UI_APPROVAL_WIRING_FAIL: GATE_EXAMINED_ZERO_CONTROLS - ${zeroControlPages.length} page(s) carry no data-decision control at all, so this gate proved nothing about them:`);
    for (const f of zeroControlPages.slice(0, 10)) console.error(`- ${f}`);
    process.exit(1);
  }
  if (totalControls === 0) {
    fail('ADMIN_UI_APPROVAL_WIRING_FAIL: GATE_EXAMINED_ZERO_CONTROLS - 0 decision controls found across every examined page.');
  }

  ok(`dist/admin/index.html and all ${previewFiles.length} per-draft preview page(s) open a real GitHub-issue decision request (${totalControls} decision control(s) examined, all routing through buildDecisionIssueUrl with a named take-down confirmation), and .github/workflows/admin-decision-issue.yml exists to apply it with an author-permission check.`);
}

if (require.main === module) main();

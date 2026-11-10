// validate:approved-content-email - the client's email address never sits in
// this public repo.
//
// Every repo is public: the client's address lives only in the
// APPROVED_CONTENT_EMAIL_TO repository secret. No file the approved-content
// email lane reads or writes may carry an address (the bot's noreply identity
// and example.com are the only exceptions), and the sent-state file records the
// recipient only as the label "client".
//
// Trimmed 10 Nov 2026 to this rule alone (hostile review of the validator cut):
// the claim-then-send ordering is covered by test/approved-content-email-*.test.js.
const fs = require('fs');
const path = require('path');
function fail(message) { console.error(`APPROVED_CONTENT_EMAIL_WORKFLOW_FAIL: ${message}`); process.exitCode = 1; }
function read(rel) { return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.resolve(process.cwd(), rel)); }
const workflow = '.github/workflows/approved-content-email.yml';
const script = 'scripts/social/send_approved_content_email.py';
const state = 'data/social/approved_content_email_state.json';
const gate = 'scripts/social/email_credential_gate.mjs';
const preview = 'reports/approved-content-email-preview.md';
const config = 'data/system/config.json';
const ADDRESS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
function addressesIn(text) {
  return (text.match(ADDRESS) || []).filter((a) => !a.endsWith('@users.noreply.github.com') && !a.endsWith('@example.com'));
}
let checked = 0;
for (const rel of [workflow, script, state, gate, preview, config]) {
  if (!exists(rel)) continue;
  checked += 1;
  const found = addressesIn(read(rel));
  if (found.length) fail(`${rel} carries ${found.length} email address(es); the recipient must come from secrets.APPROVED_CONTENT_EMAIL_TO only`);
}
// Rule 0: the workflow, script, state and gate must all be examined.
for (const rel of [workflow, script, state, gate]) if (!exists(rel)) fail(`${rel} missing; the address check cannot examine it`);
if (checked < 4) fail(`address check examined ${checked} files; expected the workflow, script, state and gate at least`);
let rows = 0;
if (exists(state)) {
  const parsed = JSON.parse(read(state));
  const recorded = [...(parsed.sent_log || []), ...(parsed.pending_send ? [parsed.pending_send] : [])];
  for (const row of recorded) { rows += 1; if (row.recipient && row.recipient !== 'client') fail(`${state} records a recipient other than "client"`); }
}
if (!process.exitCode) console.log(`Approved content email lane carries no address (${checked} files, ${rows} state rows).`);

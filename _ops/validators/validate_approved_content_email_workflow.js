const fs = require('fs');
const path = require('path');
function fail(message) { console.error(`APPROVED_CONTENT_EMAIL_WORKFLOW_FAIL: ${message}`); process.exitCode = 1; }
function read(rel) { return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.resolve(process.cwd(), rel)); }
const workflow = '.github/workflows/approved-content-email.yml';
const script = 'scripts/social/send_approved_content_email.py';
const state = 'data/social/approved_content_email_state.json';
const gate = 'scripts/social/email_credential_gate.mjs';
for (const rel of [workflow, script, state, gate]) if (!exists(rel)) fail(`${rel} missing`);
if (exists(workflow)) {
  const yaml = read(workflow);
  for (const phrase of [
    'Approved Content Email',
    'workflow_dispatch',
    'workflow_run',
    'Admin Bulk Content Actions',
    'Manual Publish',
    'claire@wisecovington.com',
    'scripts/social/send_approved_content_email.py',
    'secrets.SMTP_HOST',
    'secrets.SMTP_USERNAME',
    'secrets.SMTP_PASSWORD',
    'secrets.SMTP_FROM',
    'approved-content-email-preview',
    // The lane must gate delivery on the owner-held credential and say so by
    // name, never fail red for a secret nobody but the owner can supply, and
    // never quietly skip: the preview is still generated on the gated branch.
    'scripts/social/email_credential_gate.mjs',
    'EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL',
    "steps.email_gate.outputs.can_send == 'true'",
    "steps.email_gate.outputs.can_send != 'true'",
    // Claim-then-send: the claim reaches main before any mail goes, so a lost
    // state push can never send the same email twice (run 41071059217).
    '--claim',
    '--send-claimed',
    "steps.claim.outputs.claimed == 'true'",
    'bash scripts/ops/push_with_retry.sh'
  ]) {
    if (!yaml.includes(phrase)) fail(`${workflow} missing phrase: ${phrase}`);
  }
  const claimAt = yaml.indexOf('- name: Claim approved content email');
  const pushClaimAt = yaml.indexOf('- name: Push the claim before sending');
  const sendAt = yaml.indexOf('- name: Send the claimed approved content email');
  const recordAt = yaml.indexOf('- name: Commit sent-email state');
  if (!(claimAt >= 0 && claimAt < pushClaimAt && pushClaimAt < sendAt && sendAt < recordAt)) {
    fail(`${workflow} must run claim -> push claim -> send -> record, in that order`);
  }
  if (/python3 scripts\/social\/send_approved_content_email\.py(?![^\n]*(--send-claimed|"\$\{ARGS\[@\]\}"))/.test(yaml)) {
    fail(`${workflow} calls the send script outside the claim/send-claimed/preview steps`);
  }
}
if (exists(gate)) {
  const src = read(gate);
  for (const phrase of ['SMTP_PASSWORD', 'can_send', 'EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL', 'process.exit(0)']) {
    if (!src.includes(phrase)) fail(`${gate} missing phrase: ${phrase}`);
  }
}
if (exists(script)) {
  const src = read(script);
  for (const phrase of ['linkedin', 'twitter', 'instagram', 'claire@wisecovington.com', 'SMTP_HOST', 'approved_content_email_state.json', 'sent_entry_ids', 'resolve_live_public_url', 'dist_path_exists', 'skipped_not_live', 'pending_send', 'finalize_in_doubt_claim', 'IN_DOUBT_CLAIM_NOT_RESENT', 'send_claimed']) {
    if (!src.includes(phrase)) fail(`${script} missing phrase: ${phrase}`);
  }
  if (src.includes('smtp.gmail.com') || src.includes('SENDGRID_API_KEY')) fail(`${script} must not hard-code a vendor transport`);
  if (src.includes('/drafts/{date}/') && !src.includes('dist_path_exists')) fail(`${script} may generate draft URLs without live dist verification`);
}
if (exists(state)) {
  const parsed = JSON.parse(read(state));
  if (!Array.isArray(parsed.sent_entry_ids) || !Array.isArray(parsed.sent_log)) fail(`${state} malformed`);
}
if (!process.exitCode) console.log('Approved content email workflow OK');

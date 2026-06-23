const fs = require('fs');
const path = require('path');
function fail(message) { console.error(`APPROVED_CONTENT_EMAIL_WORKFLOW_FAIL: ${message}`); process.exitCode = 1; }
function read(rel) { return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.resolve(process.cwd(), rel)); }
const workflow = '.github/workflows/approved-content-email.yml';
const script = 'scripts/social/send_approved_content_email.py';
const state = 'data/social/approved_content_email_state.json';
for (const rel of [workflow, script, state]) if (!exists(rel)) fail(`${rel} missing`);
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
    'approved-content-email-preview'
  ]) {
    if (!yaml.includes(phrase)) fail(`${workflow} missing phrase: ${phrase}`);
  }
}
if (exists(script)) {
  const src = read(script);
  for (const phrase of ['linkedin', 'twitter', 'instagram', 'claire@wisecovington.com', 'SMTP_HOST', 'approved_content_email_state.json', 'sent_entry_ids', 'resolve_live_public_url', 'dist_path_exists', 'skipped_not_live']) {
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

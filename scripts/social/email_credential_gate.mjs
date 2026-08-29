#!/usr/bin/env node
/**
 * The delivery gate for the Approved Content Email lane.
 *
 * SMTP_HOST, SMTP_PORT, SMTP_USERNAME and SMTP_FROM are set in this repository's
 * secrets. SMTP_PASSWORD is not, and it belongs to the repo owner - nobody else
 * can supply it. send_approved_content_email.py correctly refuses to pretend it
 * sent anything without it and returns 2, so the scheduled lane has been the one
 * permanently red workflow on main.
 *
 * Red is the wrong signal for this. A missing owner-held credential is a decision
 * waiting on a person, exactly like a full draft queue, and this repo already has
 * a shape for that: scripts/cadence/draft_queue_gate.mjs measures the condition,
 * emits should_draft to $GITHUB_OUTPUT, prints the named reason and always exits
 * 0, and .github/workflows/drafts-refresh.yml gates the real work on that output
 * with a "Report why" step on the other branch. This is that same gate for the
 * credential.
 *
 * What it must never become is a silent no-op. When the credential is absent the
 * lane still builds, still regenerates the preview via --dry-run, and still says
 * EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL by name in the log. When the secret
 * is populated, can_send flips to true and the unmodified send path runs - the
 * delivery code is gated, never disabled.
 *
 * Usage: node scripts/social/email_credential_gate.mjs [--json]
 * Emits can_send=true|false and missing=<list> to $GITHUB_OUTPUT under Actions.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const JSON_ONLY = process.argv.includes('--json');

// Kept in step with REQUIRED_SMTP_VARS in scripts/social/send_approved_content_email.py.
const REQUIRED_SMTP_VARS = ['SMTP_HOST', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM'];
const missing = REQUIRED_SMTP_VARS.filter((name) => !process.env[name]);
const canSend = missing.length === 0;

const report = {
  generated_at: new Date().toISOString().slice(0, 10),
  required_secrets: REQUIRED_SMTP_VARS,
  missing_secrets: missing,
  can_send: canSend,
  status: canSend ? 'DELIVERY_ENABLED' : 'EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL',
  owner_action: canSend ? null : 'Add the missing secret(s) in repository settings; do not invent a value.',
};

fs.mkdirSync(path.join(root, 'reports/social'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/social/email-credential-gate.json'), JSON.stringify(report, null, 2) + '\n');

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `can_send=${canSend}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `missing=${missing.join(', ')}\n`);
}

if (JSON_ONLY) {
  console.log(JSON.stringify(report, null, 2));
} else if (canSend) {
  console.log('EMAIL CREDENTIAL GATE DELIVERY_ENABLED: every required SMTP secret is present; the send path will run.');
} else {
  console.log(`NAMED_STOP: EMAIL_DELIVERY_DISABLED_MISSING_CREDENTIAL - ${missing.join(', ')} is not set in this repository's secrets.`);
  console.log('The preview is still generated, but no mail can be delivered and none will be claimed as sent.');
  console.log('This is a successful run - an owner-held credential that nobody else can supply is a decision waiting on a person, not a broken build.');
  console.log('Add the missing secret(s) in repository settings; do not invent a value. Delivery resumes automatically on the next run.');
}
// Always zero. A missing owner-held secret needs a person, not a failed build.
process.exit(0);

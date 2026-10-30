// The approved-content email is claim-then-send, so a lost state push can never
// send the same email twice (30 Oct 2026, run 41071059217: GitHub 500 on the
// state push after the send step). These cases run the real script against a
// throwaway repo layout; none of them can reach a mail server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const script = path.resolve(__dirname, '..', 'scripts', 'social', 'send_approved_content_email.py');
const STATE_REL = path.join('data', 'social', 'approved_content_email_state.json');

function fixture(state) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-email-claim-'));
  fs.mkdirSync(path.join(dir, 'data', 'system'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data', 'social'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data', 'system', 'editorial_backlog.json'), JSON.stringify([
    { entry_id: 'entry-a', status: 'approved', title: 'Entry A' },
    { entry_id: 'entry-b', status: 'approved', title: 'Entry B' },
  ]));
  fs.writeFileSync(path.join(dir, STATE_REL), JSON.stringify(state || {
    sent_entry_ids: [], sent_log: [], approval_notified_entry_ids: [], revoke_notified_keys: [],
  }));
  return dir;
}

function run(dir, args) {
  const out = path.join(dir, 'github-output');
  fs.writeFileSync(out, '');
  // Port 1 on loopback refuses every connection: if anything tried to send,
  // it fails loudly instead of delivering.
  const result = spawnSync('python3', ['-I', script, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      GITHUB_OUTPUT: out,
      GITHUB_RUN_ID: 'test-run',
      SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USERNAME: 'u', SMTP_PASSWORD: 'p', SMTP_FROM: 'f@example.com',
    },
  });
  return { ...result, output: fs.readFileSync(out, 'utf8'), state: JSON.parse(fs.readFileSync(path.join(dir, STATE_REL), 'utf8')) };
}

test('--claim records what is due as pending_send and sends nothing', () => {
  const dir = fixture();
  const r = run(dir, ['--claim']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.output, /^claimed=true$/m);
  const claim = r.state.pending_send;
  assert.ok(claim, 'pending_send missing after --claim');
  assert.deepEqual(claim.newly_approved_entry_ids.sort(), ['entry-a', 'entry-b']);
  assert.equal(claim.count, 2);
  assert.match(claim.key, /^[0-9a-f]{16}$/);
  // Not yet notified: only the send records that.
  assert.deepEqual(r.state.approval_notified_entry_ids, []);
  assert.doesNotMatch(r.stdout, /Sent decision-notification email/);
});

test('the same notices always produce the same claim key', () => {
  const a = run(fixture(), ['--claim']).state.pending_send.key;
  const b = run(fixture(), ['--claim']).state.pending_send.key;
  assert.equal(a, b);
});

test('a claim whose outcome was never recorded is finalized and NOT resent', () => {
  // The run claimed (claim pushed), sent, then lost its final state push.
  const dir = fixture();
  const claimed = run(dir, ['--claim']).state;
  const r = run(dir, ['--claim']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /NAMED_STOP: IN_DOUBT_CLAIM_NOT_RESENT/);
  assert.match(r.stdout, /NAMED_STOP: NOTHING_TO_NOTIFY/);
  assert.doesNotMatch(r.output, /claimed=true/, 'the next run claimed the same email again');
  assert.equal(r.state.pending_send, undefined);
  assert.deepEqual(r.state.approval_notified_entry_ids.sort(), ['entry-a', 'entry-b']);
  const last = r.state.sent_log.at(-1);
  assert.equal(last.outcome, 'in_doubt_not_resent');
  assert.equal(last.key, claimed.pending_send.key);
});

test('a refused send releases the claim so the next run retries, and fails non-zero', () => {
  const dir = fixture();
  run(dir, ['--claim']);
  const r = run(dir, ['--send-claimed']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /NAMED_FAILURE: EMAIL_SEND_FAILED/);
  assert.equal(r.state.pending_send, undefined);
  assert.deepEqual(r.state.approval_notified_entry_ids, [], 'an undelivered email was recorded as sent');
  assert.equal(r.state.sent_log.length, 0);
});

test('--send-claimed with no claim sends nothing and fails non-zero', () => {
  const r = run(fixture(), ['--send-claimed']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /NAMED_FAILURE: NO_PENDING_CLAIM/);
});

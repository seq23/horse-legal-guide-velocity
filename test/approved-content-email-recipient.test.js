// The approved-content email goes to the client, and only to the client. The
// address lives in the APPROVED_CONTENT_EMAIL_TO repository secret, never in
// this public repo: a claim, the state file or the committed preview must not
// carry it, and an address planted in a claim must never become the To: line.
// SMTP is replaced by a recorder, so nothing here can reach a mail server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const script = path.resolve(__dirname, '..', 'scripts', 'social', 'send_approved_content_email.py');
const STATE_REL = path.join('data', 'social', 'approved_content_email_state.json');
const PREVIEW_REL = path.join('reports', 'approved-content-email-preview.md');
const CLIENT = 'client-inbox@example.test';
const PLANTED = 'someone-else@example.test';

// Runs the real script with smtplib.SMTP swapped for a recorder that logs every
// To: it is handed to sent.jsonl in the fixture directory.
const RECORDER = `
import json, runpy, smtplib, sys
class Recorder:
    def __init__(self, *a, **k): pass
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def starttls(self, *a, **k): pass
    def login(self, *a, **k): pass
    def send_message(self, msg):
        with open('sent.jsonl', 'a') as fh: fh.write(json.dumps({'to': msg['To']}) + '\\n')
smtplib.SMTP = Recorder
smtplib.SMTP_SSL = Recorder
script = sys.argv[1]
sys.argv = [script] + sys.argv[2:]
runpy.run_path(script, run_name='__main__')
`;

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-email-recipient-'));
  fs.mkdirSync(path.join(dir, 'data', 'system'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data', 'social'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data', 'system', 'editorial_backlog.json'), JSON.stringify([
    { entry_id: 'entry-a', status: 'approved', title: 'Entry A' },
  ]));
  fs.writeFileSync(path.join(dir, STATE_REL), JSON.stringify({
    sent_entry_ids: [], sent_log: [], approval_notified_entry_ids: [], revoke_notified_keys: [],
  }));
  return dir;
}

function run(dir, args, recipient) {
  const env = {
    PATH: process.env.PATH, GITHUB_RUN_ID: 'test-run',
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '587', SMTP_USERNAME: 'u', SMTP_PASSWORD: 'p', SMTP_FROM: 'f@example.com',
  };
  if (recipient !== undefined) env.APPROVED_CONTENT_EMAIL_TO = recipient;
  const result = spawnSync('python3', ['-I', '-c', RECORDER, script, ...args], { cwd: dir, encoding: 'utf8', env });
  const sentPath = path.join(dir, 'sent.jsonl');
  const sent = fs.existsSync(sentPath) ? fs.readFileSync(sentPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { ...result, sent };
}

test('the email goes to the client from the secret; no address is written, a planted one is ignored, no secret sends nothing', () => {
  // 1. Claim: state and preview name "the client", never the address.
  const dir = fixture();
  const claimed = run(dir, ['--claim'], CLIENT);
  assert.equal(claimed.status, 0, claimed.stderr);
  assert.equal(claimed.sent.length, 0, '--claim must send nothing');
  const stateText = fs.readFileSync(path.join(dir, STATE_REL), 'utf8');
  const previewText = fs.readFileSync(path.join(dir, PREVIEW_REL), 'utf8');
  assert.equal(JSON.parse(stateText).pending_send.recipient, 'client');
  assert.ok(!stateText.includes('@'), 'state must not carry an address');
  assert.ok(!previewText.includes(CLIENT), 'committed preview must not carry the address');

  // 2. Negative: an address planted in the claim never becomes the To: line.
  const state = JSON.parse(stateText);
  state.pending_send.recipient = PLANTED;
  fs.writeFileSync(path.join(dir, STATE_REL), JSON.stringify(state));
  const noSecret = run(dir, ['--send-claimed']);
  assert.notEqual(noSecret.status, 0);
  assert.match(noSecret.stderr, /RECIPIENT_SECRET_MISSING/);
  assert.deepEqual(noSecret.sent, [], 'without the secret nothing may be sent, not even to a planted address');

  // Re-claim (the refused send released the claim), plant again, send with the secret.
  fs.writeFileSync(path.join(dir, STATE_REL), JSON.stringify({
    sent_entry_ids: [], sent_log: [], approval_notified_entry_ids: [], revoke_notified_keys: [],
  }));
  assert.equal(run(dir, ['--claim'], CLIENT).status, 0);
  const again = JSON.parse(fs.readFileSync(path.join(dir, STATE_REL), 'utf8'));
  again.pending_send.recipient = PLANTED;
  fs.writeFileSync(path.join(dir, STATE_REL), JSON.stringify(again));
  const sent = run(dir, ['--send-claimed'], CLIENT);
  assert.equal(sent.status, 0, sent.stderr);
  assert.deepEqual(sent.sent.map((m) => m.to), [CLIENT], 'exactly one email, to the client only');
  assert.ok(!sent.stdout.includes(CLIENT), 'the log must not print the address');
  const after = fs.readFileSync(path.join(dir, STATE_REL), 'utf8');
  assert.ok(!after.includes('@'), 'recorded state must not carry an address');
  assert.equal(JSON.parse(after).sent_log.at(-1).recipient, 'client');
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const helper = path.join(repoRoot, 'scripts', 'ops', 'push_with_retry.sh');

function runPushCase(mode) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-push-retry-'));
  const binDir = path.join(tmp, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const countFile = path.join(tmp, 'push-count');
  const argsFile = path.join(tmp, 'push-args');
  fs.writeFileSync(countFile, '0');

  const fakeGit = `#!/usr/bin/env bash
set -u
if [ "\${1:-}" != "push" ]; then
  echo "unexpected git command: $*" >&2
  exit 99
fi
count="$(cat "$PUSH_COUNT_FILE")"
count=$((count + 1))
printf '%s' "$count" > "$PUSH_COUNT_FILE"
printf '%s\\n' "$*" >> "$PUSH_ARGS_FILE"
case "$PUSH_MODE" in
  internal_server_error_then_success)
    if [ "$count" -eq 1 ]; then
      echo "remote: Internal Server Error" >&2
      echo "! [remote rejected] main -> main (Internal Server Error)" >&2
      echo "error: failed to push some refs" >&2
      exit 1
    fi
    echo "Everything up-to-date"
    exit 0
    ;;
  network_then_success)
    if [ "$count" -eq 1 ]; then
      echo "fatal: unable to access repository: Could not resolve host: github.com" >&2
      exit 128
    fi
    exit 0
    ;;
  permission_denied)
    echo "remote: Permission to seq23/horse-legal-guide-velocity.git denied to github-actions[bot]." >&2
    echo "fatal: unable to access repository: The requested URL returned error: 403" >&2
    exit 128
    ;;
  *)
    echo "unknown PUSH_MODE=$PUSH_MODE" >&2
    exit 98
    ;;
esac
`;
  const gitPath = path.join(binDir, 'git');
  fs.writeFileSync(gitPath, fakeGit, { mode: 0o755 });

  const result = spawnSync('bash', [helper, 'origin', 'main'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      PUSH_MODE: mode,
      PUSH_COUNT_FILE: countFile,
      PUSH_ARGS_FILE: argsFile,
      PUSH_RETRY_ATTEMPTS: '3',
      PUSH_RETRY_DELAY_SECONDS: '0',
    },
  });

  return {
    ...result,
    pushCount: Number(fs.readFileSync(countFile, 'utf8')),
    pushArgs: fs.existsSync(argsFile) ? fs.readFileSync(argsFile, 'utf8').trim().split('\n') : [],
  };
}

test('retries a GitHub 500 and succeeds without changing push target', () => {
  const result = runPushCase('internal_server_error_then_success');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.pushCount, 2);
  assert.deepEqual(result.pushArgs, ['push origin main', 'push origin main']);
  assert.match(result.stderr, /transient git\/GitHub transport failure/);
  assert.match(result.stderr, /push succeeded on attempt 2\/3/);
});

test('retries a transient network failure', () => {
  const result = runPushCase('network_then_success');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.pushCount, 2);
});

test('does not retry permission or authentication failures', () => {
  const result = runPushCase('permission_denied');
  assert.equal(result.status, 128);
  assert.equal(result.pushCount, 1);
  assert.match(result.stderr, /403/);
  assert.match(result.stderr, /non-retryable git push failure/);
});

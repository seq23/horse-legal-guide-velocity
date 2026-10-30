#!/usr/bin/env bash
# The one way a workflow in this repo pushes a bot commit.
#
#   bash scripts/ops/push_with_retry.sh <remote> <refspec>
#
# Every workflow that commits to main calls this instead of a bare `git push`;
# test/workflow-push-helper.test.js fails red on any bare push left in
# .github/workflows. Two failures are retried, a bounded number of times with
# growing backoff:
#   - a transient GitHub/transport error (30 Oct 2026, Approved Content Email
#     run 41071059217: `remote: Internal Server Error` / `[remote rejected]`);
#   - a non-fast-forward rejection (main moved during the run): fetch the
#     target branch, rebase onto it, push again. A rebase conflict aborts the
#     rebase and fails at once - it is never resolved by guessing.
# Anything else (403, protected branch, hook declined) fails at once with git's
# own exit status. Every final failure prints one NAMED_FAILURE line with the
# cause and exits non-zero.
set -Eeuo pipefail

remote="${1-origin}"
refspec="${2-main}"
attempts="${PUSH_RETRY_ATTEMPTS:-4}"
delay_seconds="${PUSH_RETRY_DELAY_SECONDS:-3}"

if [ -z "$remote" ] || [ -z "$refspec" ]; then
  echo "push_with_retry: remote and refspec must be non-empty (got remote='${remote}' refspec='${refspec}')" >&2
  echo "NAMED_FAILURE: GIT_PUSH_FAILED cause=usage - no branch to push (detached HEAD?)" >&2
  exit 2
fi
if ! [[ "$attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "push_with_retry: PUSH_RETRY_ATTEMPTS must be a positive integer" >&2
  exit 2
fi
if ! [[ "$delay_seconds" =~ ^[0-9]+$ ]]; then
  echo "push_with_retry: PUSH_RETRY_DELAY_SECONDS must be a non-negative integer" >&2
  exit 2
fi

# The branch on the remote that the refspec updates: "main" -> main,
# "HEAD:main" -> main, "HEAD:refs/heads/main" -> main.
target_branch="${refspec##*:}"
target_branch="${target_branch#refs/heads/}"

is_transient_push_failure() {
  local output="$1"
  case "$output" in
    *"Internal Server Error"*|\
    *"HTTP 500"*|*"HTTP 502"*|*"HTTP 503"*|*"HTTP 504"*|\
    *"The requested URL returned error: 500"*|\
    *"The requested URL returned error: 502"*|\
    *"The requested URL returned error: 503"*|\
    *"The requested URL returned error: 504"*|\
    *"Could not resolve host"*|\
    *"Connection timed out"*|\
    *"Connection reset by peer"*|\
    *"Failed to connect"*|\
    *"TLS connect error"*|\
    *"RPC failed; HTTP 5"*|\
    *"remote end hung up unexpectedly"*)
      return 0
      ;;
  esac
  return 1
}

is_non_fast_forward() {
  local output="$1"
  case "$output" in
    *"(fetch first)"*|*"(non-fast-forward)"*|*"Updates were rejected because"*)
      return 0
      ;;
  esac
  return 1
}

backoff() {
  if [ "$delay_seconds" -gt 0 ]; then
    # 1x, 2x, 4x, ... the base delay.
    sleep $((delay_seconds * (1 << (attempt - 1))))
  fi
}

give_up() {
  local cause="$1" status="$2"
  echo "NAMED_FAILURE: GIT_PUSH_FAILED cause=${cause} remote=${remote} refspec=${refspec} attempt=${attempt}/${attempts}" >&2
  exit "$status"
}

attempt=1
while [ "$attempt" -le "$attempts" ]; do
  status=0
  push_output="$(git push "$remote" "$refspec" 2>&1)" || status=$?

  if [ -n "$push_output" ]; then
    printf '%s\n' "$push_output" >&2
  fi

  if [ "$status" -eq 0 ]; then
    if [ "$attempt" -gt 1 ]; then
      echo "push_with_retry: push succeeded on attempt ${attempt}/${attempts}" >&2
    fi
    exit 0
  fi

  if is_non_fast_forward "$push_output"; then
    cause="non_fast_forward"
  elif is_transient_push_failure "$push_output"; then
    cause="transient_server_error"
  else
    echo "push_with_retry: non-retryable git push failure; preserving exit status $status" >&2
    give_up "non_retryable" "$status"
  fi

  if [ "$attempt" -ge "$attempts" ]; then
    echo "push_with_retry: ${cause} persisted through ${attempts} attempts" >&2
    give_up "$cause" "$status"
  fi

  if [ "$cause" = "non_fast_forward" ]; then
    echo "push_with_retry: ${remote}/${target_branch} moved (non-fast-forward) on attempt ${attempt}/${attempts}; fetching and rebasing" >&2
    fetch_status=0
    fetch_output="$(git fetch "$remote" "$target_branch" 2>&1)" || fetch_status=$?
    if [ "$fetch_status" -ne 0 ]; then
      printf '%s\n' "$fetch_output" >&2
      if ! is_transient_push_failure "$fetch_output"; then
        give_up "fetch_failed" "$fetch_status"
      fi
    else
      rebase_status=0
      rebase_output="$(git rebase FETCH_HEAD 2>&1)" || rebase_status=$?
      if [ "$rebase_status" -ne 0 ]; then
        printf '%s\n' "$rebase_output" >&2
        git rebase --abort >&2
        echo "push_with_retry: rebase onto ${remote}/${target_branch} conflicted; aborted, nothing pushed" >&2
        give_up "rebase_conflict" 1
      fi
    fi
  else
    echo "push_with_retry: transient git/GitHub transport failure on attempt ${attempt}/${attempts}; retrying" >&2
  fi
  backoff
  attempt=$((attempt + 1))
done

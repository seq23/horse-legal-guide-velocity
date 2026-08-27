#!/usr/bin/env bash
set -Eeuo pipefail

remote="${1:-origin}"
branch="${2:-main}"
attempts="${PUSH_RETRY_ATTEMPTS:-4}"
delay_seconds="${PUSH_RETRY_DELAY_SECONDS:-3}"

if ! [[ "$attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "push_with_retry: PUSH_RETRY_ATTEMPTS must be a positive integer" >&2
  exit 2
fi
if ! [[ "$delay_seconds" =~ ^[0-9]+$ ]]; then
  echo "push_with_retry: PUSH_RETRY_DELAY_SECONDS must be a non-negative integer" >&2
  exit 2
fi

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

attempt=1
while [ "$attempt" -le "$attempts" ]; do
  set +e
  push_output="$(git push "$remote" "$branch" 2>&1)"
  status=$?
  set -e

  if [ -n "$push_output" ]; then
    printf '%s\n' "$push_output" >&2
  fi

  if [ "$status" -eq 0 ]; then
    if [ "$attempt" -gt 1 ]; then
      echo "push_with_retry: push succeeded on attempt ${attempt}/${attempts}" >&2
    fi
    exit 0
  fi

  if ! is_transient_push_failure "$push_output"; then
    echo "push_with_retry: non-retryable git push failure; preserving exit status $status" >&2
    exit "$status"
  fi

  if [ "$attempt" -ge "$attempts" ]; then
    echo "push_with_retry: transient git push failure persisted through ${attempts} attempts" >&2
    exit "$status"
  fi

  echo "push_with_retry: transient git/GitHub transport failure on attempt ${attempt}/${attempts}; retrying" >&2
  if [ "$delay_seconds" -gt 0 ]; then
    sleep $((delay_seconds * attempt))
  fi
  attempt=$((attempt + 1))
done

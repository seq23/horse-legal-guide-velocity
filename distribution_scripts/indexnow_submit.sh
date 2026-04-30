#!/usr/bin/env bash
set -euo pipefail

KEY="${INDEXNOW_KEY:-}"
KEY_LOCATION="${INDEXNOW_KEY_LOCATION:-}"
SITE_DOMAIN="${SITE_DOMAIN:-}"
PRIORITY_FILE="${1:-dist/indexnow-priority.txt}"
BATCH_FILE="${2:-dist/indexnow-batch.txt}"

if [[ -z "$KEY" || -z "$KEY_LOCATION" || -z "$SITE_DOMAIN" ]]; then
  echo "INDEXNOW env vars missing; skipping IndexNow submission."
  exit 0
fi

submit_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Missing $file; skipping."
    return 0
  fi
  mapfile -t URLS < <(grep -E '^https?://' "$file" || true)
  if [[ ${#URLS[@]} -eq 0 ]]; then
    echo "$file has no URLs; skipping."
    return 0
  fi
  local TMP
  TMP=$(mktemp)
  printf '%s\n' "${URLS[@]}" | python3 - <<'PY' "$TMP" "$SITE_DOMAIN" "$KEY" "$KEY_LOCATION"
import json, os, sys
out, site, key, key_location = sys.argv[1:5]
urls = [line.strip() for line in sys.stdin if line.strip()]
payload = {
  "host": site.replace("https://", "").replace("http://", "").rstrip("/"),
  "key": key,
  "keyLocation": key_location,
  "urlList": urls,
}
with open(out, "w", encoding="utf-8") as fh:
  json.dump(payload, fh)
PY
  curl -sS -X POST "https://api.indexnow.org/indexnow" \
    -H 'content-type: application/json' \
    --data-binary @"$TMP" || true
  rm -f "$TMP"
}

submit_file "$PRIORITY_FILE"
submit_file "$BATCH_FILE"
echo "IndexNow submission attempted (non-blocking)."

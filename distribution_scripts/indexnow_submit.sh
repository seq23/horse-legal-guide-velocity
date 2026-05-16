#!/usr/bin/env bash
set -euo pipefail

PRIORITY_FILE="${1:-.build/indexnow-priority.txt}"
BATCH_FILE="${2:-.build/indexnow-batch.txt}"
KEY="${INDEXNOW_KEY:-}"
SITE_DOMAIN="${SITE_DOMAIN:-https://horselegalguide.com}"
KEY_LOCATION="${INDEXNOW_KEY_LOCATION:-${SITE_DOMAIN%/}/indexnow.txt}"
ENDPOINT="${INDEXNOW_ENDPOINT:-https://api.indexnow.org/indexnow}"
DRY_RUN="${INDEXNOW_DRY_RUN:-}"
REPORT_DIR="_ops/reports"
REPORT_FILE="$REPORT_DIR/indexnow-submit-report.json"
# Durable report path: _ops/reports/indexnow-submit-report.json
mkdir -p "$REPORT_DIR"

host_from_site() {
  python3 - <<'PY' "$SITE_DOMAIN"
import sys
from urllib.parse import urlparse
raw = sys.argv[1].strip()
if not raw:
    print('')
else:
    if '://' not in raw:
        raw = 'https://' + raw
    print(urlparse(raw).netloc)
PY
}

HOST="$(host_from_site)"

write_report() {
  local status="$1"
  local priority_count="$2"
  local batch_count="$3"
  local failures_json="$4"
  local priority_status="$5"
  local batch_status="$6"
  python3 - <<'PY' "$REPORT_FILE" "$status" "$priority_count" "$batch_count" "$failures_json" "$priority_status" "$batch_status" "$HOST" "$SITE_DOMAIN" "$KEY_LOCATION" "$ENDPOINT" "$PRIORITY_FILE" "$BATCH_FILE" "$DRY_RUN"
import json, sys, datetime
(
  report_file, status, priority_count, batch_count, failures_json,
  priority_status, batch_status, host, site_domain, key_location, endpoint,
  priority_file, batch_file, dry_run
) = sys.argv[1:]
try:
    failures = json.loads(failures_json)
except Exception:
    failures = [failures_json] if failures_json else []
payload = {
    "repo": "horse-legal-guide-velocity",
    "host": host,
    "siteDomain": site_domain,
    "mode": "priority+batch",
    "submittedAt": datetime.datetime.now(datetime.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "endpoint": endpoint,
    "keyLocation": key_location,
    "priorityFile": priority_file,
    "batchFile": batch_file,
    "priorityCount": int(priority_count or 0),
    "batchCount": int(batch_count or 0),
    "priorityStatus": priority_status,
    "batchStatus": batch_status,
    "dryRun": bool(dry_run),
    "status": status,
    "failures": failures,
}
with open(report_file, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
    fh.write("\n")
PY
}

count_urls() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo 0
    return 0
  fi
  grep -E '^https?://' "$file" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' '
}

make_payload() {
  local file="$1"
  local out="$2"
  python3 - <<'PY' "$file" "$out" "$HOST" "$KEY" "$KEY_LOCATION"
import json, sys
file_path, out_path, host, key, key_location = sys.argv[1:]
urls = []
try:
    with open(file_path, encoding='utf-8') as fh:
        urls = [line.strip() for line in fh if line.strip().startswith(('http://', 'https://'))]
except FileNotFoundError:
    urls = []
payload = {"host": host, "key": key, "keyLocation": key_location, "urlList": urls}
with open(out_path, 'w', encoding='utf-8') as fh:
    json.dump(payload, fh)
PY
}

submit_one() {
  local label="$1"
  local file="$2"
  local count="$3"
  if [[ ! -f "$file" ]]; then
    echo "missing"
    return 0
  fi
  if [[ "$count" == "0" ]]; then
    echo "empty"
    return 0
  fi
  if [[ -n "$DRY_RUN" ]]; then
    echo "dry-run"
    return 0
  fi
  local payload response code
  payload="$(mktemp)"
  response="$(mktemp)"
  make_payload "$file" "$payload"
  code="$(curl -sS -o "$response" -w "%{http_code}" -X POST "$ENDPOINT" -H 'content-type: application/json' --data-binary @"$payload" || true)"
  rm -f "$payload" "$response"
  if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    echo "success:${code}"
  else
    echo "failed:${code:-curl_error}"
  fi
}

PRIORITY_COUNT="$(count_urls "$PRIORITY_FILE")"
BATCH_COUNT="$(count_urls "$BATCH_FILE")"
FAILURES='[]'

if [[ -z "$KEY" || -z "$HOST" || -z "$KEY_LOCATION" ]]; then
  FAILURES='["INDEXNOW_KEY, SITE_DOMAIN, or INDEXNOW_KEY_LOCATION missing; live submission skipped."]'
  write_report "skipped" "$PRIORITY_COUNT" "$BATCH_COUNT" "$FAILURES" "skipped" "skipped"
  echo "IndexNow skipped; wrote $REPORT_FILE"
  exit 0
fi

if [[ -z "$DRY_RUN" ]]; then
  if [[ -f "dist/indexnow.txt" ]]; then
    FILE_KEY="$(tr -d '[:space:]' < dist/indexnow.txt)"
    if [[ "$FILE_KEY" != "$KEY" ]]; then
      FAILURES='["dist/indexnow.txt does not match INDEXNOW_KEY; live submission skipped."]'
      write_report "failed" "$PRIORITY_COUNT" "$BATCH_COUNT" "$FAILURES" "skipped" "skipped"
      echo "IndexNow verification key mismatch; wrote $REPORT_FILE"
      exit 0
    fi
  else
    FAILURES='["dist/indexnow.txt missing; live submission skipped because IndexNow key verification would fail."]'
    write_report "failed" "$PRIORITY_COUNT" "$BATCH_COUNT" "$FAILURES" "skipped" "skipped"
    echo "IndexNow key file missing; wrote $REPORT_FILE"
    exit 0
  fi
fi

PRIORITY_STATUS="$(submit_one priority "$PRIORITY_FILE" "$PRIORITY_COUNT")"
BATCH_STATUS="$(submit_one batch "$BATCH_FILE" "$BATCH_COUNT")"
STATUS="success"
if [[ "$PRIORITY_STATUS" == failed:* || "$BATCH_STATUS" == failed:* ]]; then
  STATUS="partial"
  FAILURES='["One or more IndexNow POST attempts failed; see priorityStatus and batchStatus."]'
elif [[ "$PRIORITY_STATUS" == "dry-run" || "$BATCH_STATUS" == "dry-run" ]]; then
  STATUS="dry-run"
elif [[ "$PRIORITY_STATUS" == "missing" || "$BATCH_STATUS" == "missing" ]]; then
  STATUS="partial"
  FAILURES='["One or more IndexNow input files were missing."]'
elif [[ "$PRIORITY_STATUS" == "empty" && "$BATCH_STATUS" == "empty" ]]; then
  STATUS="skipped"
  FAILURES='["No URLs found in priority or batch files."]'
fi

write_report "$STATUS" "$PRIORITY_COUNT" "$BATCH_COUNT" "$FAILURES" "$PRIORITY_STATUS" "$BATCH_STATUS"
echo "IndexNow ${STATUS}; wrote $REPORT_FILE"
exit 0

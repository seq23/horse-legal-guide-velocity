# Horse Legal Guide Velocity — IndexNow Data Trace

## Purpose

This trace documents the new IndexNow workflow path added for Batch 2. It exists so an owner or VA can confirm exactly what happens after approved public pages are pushed to `main`.

## Trigger surface

```text
push to main
workflow_dispatch
```

Workflow file:

```text
.github/workflows/deploy-distribution.yml
```

## Runtime path

```text
GitHub Actions checkout
→ npm ci
→ npm run build
→ scripts/build/build_site.js
→ copies root indexnow.txt into dist/indexnow.txt
→ scripts/build/prepare_distribution_artifacts.js
→ reads dist/indexnow-priority.txt and dist/indexnow-batch.txt
→ writes .build/indexnow-priority.txt
→ writes .build/indexnow-batch.txt
→ writes .build/distribution-priority-urls.txt
→ writes .build/distribution-manifest.json
→ npm run validate:all
→ npm run validate:indexnow-workflow
→ distribution_scripts/indexnow_submit.sh .build/indexnow-priority.txt .build/indexnow-batch.txt
→ verifies INDEXNOW_KEY is present
→ verifies dist/indexnow.txt matches INDEXNOW_KEY before live submit
→ posts priority URL payload to https://api.indexnow.org/indexnow
→ posts batch URL payload to https://api.indexnow.org/indexnow
→ writes _ops/reports/indexnow-submit-report.json
→ optionally submits sitemaps to GSC without blocking IndexNow
→ optionally inspects priority URLs through GSC without blocking IndexNow
→ uploads .build and _ops/reports as GitHub Actions artifacts
```

## Inputs

```text
INDEXNOW_KEY                GitHub Actions secret for live submission
INDEXNOW_KEY_LOCATION       https://horselegalguide.com/indexnow.txt
SITE_DOMAIN                 https://horselegalguide.com
CANONICAL_DOMAIN            https://wisecovington.com
GSC_SITE_URL                sc-domain:horselegalguide.com
```

## Generated URL files

Canonical submit inputs:

```text
.build/indexnow-priority.txt
.build/indexnow-batch.txt
```

Source generation files:

```text
dist/indexnow-priority.txt
dist/indexnow-batch.txt
```

## Report file

```text
_ops/reports/indexnow-submit-report.json
```

The report records:

```text
repo
host
siteDomain
mode
submittedAt
endpoint
keyLocation
priorityFile
batchFile
priorityCount
batchCount
priorityStatus
batchStatus
dryRun
status
failures
```

## Manual publishing boundary

Draft refresh does not submit IndexNow.

Only approved public URLs that are already in the built `dist/` output are submitted from the push-based distribution workflow.

## GSC boundary

Google Search Console sitemap submission and URL inspection are optional and non-blocking. Missing GSC credentials must not prevent IndexNow submission.

The normal Search Console UI “Request indexing” action is not automated here.

## Validation path

```bash
npm run build
npm run validate:indexnow-workflow
INDEXNOW_DRY_RUN=1 INDEXNOW_KEY=dry-run ./distribution_scripts/indexnow_submit.sh .build/indexnow-priority.txt .build/indexnow-batch.txt
npm run validate:all
```

## Failure interpretation

If `_ops/reports/indexnow-submit-report.json` says:

```text
status: skipped
```

then the live key is missing.

If it says:

```text
status: failed
```

then inspect `failures`, `priorityStatus`, and `batchStatus`.

If it says:

```text
status: dry-run
```

then validation ran safely without live submission.

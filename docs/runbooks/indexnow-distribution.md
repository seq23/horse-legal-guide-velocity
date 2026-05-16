# Horse Legal Guide Velocity — IndexNow Distribution Runbook

## Purpose

This repo is a manual-publishing velocity artifact for `horselegalguide.com`. Manual approval controls what becomes public. Once approved public URLs are built and pushed to `main`, the distribution lane submits those public URLs to IndexNow and writes a proof report.

## Public submission rule

Draft refresh does not submit IndexNow.

Public push to `main` does submit IndexNow because the build output only contains approved public surfaces.

## Workflow

Primary workflow:

```text
.github/workflows/deploy-distribution.yml
```

Trigger:

```text
push to main
workflow_dispatch
```

Runtime sequence:

```text
checkout
→ npm ci
→ npm run build
→ npm run validate:all
→ distribution_scripts/indexnow_submit.sh .build/indexnow-priority.txt .build/indexnow-batch.txt
→ optional GSC sitemap submit
→ optional GSC priority URL inspection
→ upload .build and _ops/reports artifacts
```

## IndexNow inputs

Canonical submit inputs:

```text
.build/indexnow-priority.txt
.build/indexnow-batch.txt
```

These are generated during `npm run build` by `scripts/build/prepare_distribution_artifacts.js`.

## Required secret

GitHub Actions secret:

```text
INDEXNOW_KEY
```

The public verification file is:

```text
https://horselegalguide.com/indexnow.txt
```

The repo root `indexnow.txt` is copied into `dist/indexnow.txt` during build.

## Report

The submit script always writes:

```text
_ops/reports/indexnow-submit-report.json
```

The report records:

- repo
- host
- endpoint
- key location
- priority file
- batch file
- priority URL count
- batch URL count
- dry-run status
- priority submit status
- batch submit status
- failures

## Dry run

Use this for safe local verification:

```bash
INDEXNOW_DRY_RUN=1 INDEXNOW_KEY=dry-run ./distribution_scripts/indexnow_submit.sh .build/indexnow-priority.txt .build/indexnow-batch.txt
```

## GSC boundary

Google Search Console sitemap submission and URL Inspection are optional and non-blocking. Missing GSC credentials must not prevent IndexNow from running.

The normal GSC UI “Request indexing” button is not automated here. Priority URLs can be inspected and queued for manual re-indexing if needed.

## Validation

Run:

```bash
npm run validate:indexnow-workflow
```

This validator confirms:

- deploy distribution workflow exists
- workflow runs on push to `main`
- workflow builds and validates before submitting
- workflow submits `.build` priority and batch URL files
- workflow uploads `.build` and `_ops/reports`
- submit script writes `_ops/reports/indexnow-submit-report.json`
- public signal workflow uses fetch/rebase/push handling

## Failure handling

If IndexNow submission fails, inspect:

```text
_ops/reports/indexnow-submit-report.json
```

Common causes:

- missing `INDEXNOW_KEY` secret
- `dist/indexnow.txt` missing
- `dist/indexnow.txt` does not match `INDEXNOW_KEY`
- empty priority/batch files
- network/API response failure

Do not bypass validation by deleting the workflow. Fix the reported cause and rerun.

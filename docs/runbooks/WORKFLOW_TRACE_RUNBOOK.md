# Workflow Trace Runbook

## Purpose

Workflow trace proves that workflow YAML, referenced npm scripts, required local files, and expected artifacts are wired before a ZIP is delivered.

It is local-equivalent proof. It is not live GitHub Actions proof.

## Commands

```bash
npm run ops:trace-workflows
npm run validate:workflow-trace
```

## Current workflow lanes

- `admin-bulk-content-actions.yml` — owner bulk approval/rejection/publish-date actions.
- `build.yml` — manual build artifact lane.
- `deploy-distribution.yml` — deployment/distribution and indexing submission.
- `drafts-refresh.yml` — generation, self-heal, prevalidation, quality reports, admin refresh.
- `public-signal-processing.yml` — public/social signal ingestion; preserve this lane.
- `publish.yml` — publish approved + due content only.
- `sitemap-indexing.yml` — manual indexing utility.
- `validate.yml` — repository validation.

## Required trace outputs

- `data/admin/workflow_health.json`
- `data/admin/signal_ingestion_status.json`
- `data/admin/signal_trace_summary.json`
- `reports/workflow-trace/*.json`

## Public/social signal ingestion must remain wired

Preserve this pipeline:

```text
collect:signals
→ normalize:signals
→ map:signals
→ report:ingestion
```

Relevant commands:

```bash
npm run collect:signals
npm run normalize:signals
npm run map:signals
npm run report:ingestion
npm run ingest:manual
```

## Truth boundary

This trace proves local structure and artifacts. It does not prove:

- live GitHub Actions passed;
- live GSC submission passed;
- live IndexNow submission passed;
- live deployed runtime passed.

Those must run after the ZIP is applied, committed, and pushed.

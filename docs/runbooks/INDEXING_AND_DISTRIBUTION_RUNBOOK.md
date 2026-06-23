# Indexing and Distribution Runbook

## Purpose

Distribution moves validated public pages into sitemap, IndexNow, and indexing workflows. It does not approve editorial content.

## Commands

```bash
npm run build
npm run build:distribution
npm run validate:distribution
npm run validate:indexnow-workflow
npm run validate:all
```

## Workflow lanes

- `deploy-distribution.yml` — deployment/distribution and indexing submission lane.
- `sitemap-indexing.yml` — manual indexing utility retained as a narrow operator tool.

## Required artifacts

- `.build/indexnow-priority.txt`
- `.build/indexnow-batch.txt`
- `.build/distribution-priority-urls.txt`
- `.build/distribution-manifest.json`
- `sitemap.xml`
- `dist/sitemap.xml`

## Live proof boundary

Local validation proves the files exist and are structurally correct. Live GSC/IndexNow submission requires GitHub/live workflow execution after apply, commit, and push.

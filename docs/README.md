# Horse Legal Guide Velocity — Operator Docs

This repo is an **LLM citation velocity system** for Horse Legal Guide. It is not the main user browsing site. Its job is to create structured, citation-ready equine legal education pages, then route people to Wise Covington.

Main destination: `https://wisecovington.com`

## Start here

1. `docs/OPERATOR_QUICKSTART.md` — short daily operating guide.
2. `docs/SYSTEM_OVERVIEW.md` — what this repo is, what it is not, and how the pieces fit together.
3. `docs/runbooks/ADMIN_PANEL_RUNBOOK.md` — how to use `/admin/`.
4. `docs/runbooks/CONTENT_PIPELINE_RUNBOOK.md` — generate, self-heal, prevalidate, approve, publish.
5. `docs/runbooks/WORKFLOW_TRACE_RUNBOOK.md` — workflow health and local-equivalent proof.
6. `docs/runbooks/CITATION_VELOCITY_RUNBOOK.md` — SEO/AEO/GEO/LLM citation requirements.
7. `docs/runbooks/WISE_COVINGTON_ROUTING_RUNBOOK.md` — firm/contact routing rules.
8. `docs/runbooks/INDEXING_AND_DISTRIBUTION_RUNBOOK.md` — sitemap, IndexNow, and distribution workflow.
9. `docs/HOSTILE_REVIEW_REPORT.md` — hostile review findings and repairs.

## Current admin password reminder

`ChangeThisAdminPassword123!`

This is a convenience reminder per owner instruction. The `/admin/` page is a static-page gate, not real authentication. Do not store real production secrets in this repo.

## Main validation commands

```bash
npm run content:self-heal
npm run content:prevalidate
npm run build
npm run validate:all
```

## Local proof boundary

This repo can prove local structure, generated artifacts, validators, and workflow trace files inside a local/container environment. It cannot prove live GitHub Actions, live GSC, live IndexNow, or deployed Cloudflare runtime until the ZIP is applied, committed, pushed, and the live workflows run.

## Archived legacy docs

Older fragmented docs were moved to:

`docs/archive/2026-06-23-pre-hostile-review/`

Use the new runbooks first. The archive is retained only for continuity/history.

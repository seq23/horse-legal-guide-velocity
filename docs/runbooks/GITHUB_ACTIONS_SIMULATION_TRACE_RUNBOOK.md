# GitHub Actions Simulation Trace Runbook

## Purpose

Before applying a ZIP to the real GitHub repository, run a local simulated GitHub Actions data trace to catch command, artifact, workflow, and dashboard wiring errors.

This is not a live GitHub Actions pass. It is a pre-apply safety trace.

## Command

```bash
npm run ops:simulate-github-actions
npm run validate:github-actions-trace
```

## What it checks

- Every workflow YAML exists under `.github/workflows/`.
- Every expected workflow lane has a trace report.
- Key local-equivalent commands have already been validated in the working tree.
- Required workflow artifacts exist.
- Public/social signal ingestion status is surfaced.
- IndexNow and GSC lanes are marked as dry-run/local-only until real secrets and live GitHub Actions run.

## Output files

- `data/admin/github_actions_trace.json`
- `reports/github-actions-simulation/summary.json`
- `reports/github-actions-simulation/<workflow>.json`

## Expected status before ZIP delivery

Allowed:

- `passed`
- `passed_with_warnings`

Not allowed:

- `failed`

Warnings are expected for live-only paths such as:

- IndexNow submission
- GSC sitemap submission
- GSC URL inspection
- public/social signal collection in a network-limited local environment

## After applying the ZIP

Run live GitHub Actions in this order:

1. Validate Repo
2. Public Signal Processing
3. Draft Queue Refresh
4. Manual Publish, if needed
5. Deploy Distribution
6. Sitemap And Indexing, if needed

Live proof is not complete until GitHub Actions runs in the real repo.

# Hostile Review — GitHub Actions Trace and SEO/AEO/GEO Dashboard

## Scope

This review covered:

- all current GitHub Actions workflow lanes;
- local-equivalent workflow command trace;
- public/social signal ingestion behavior;
- `/admin/seo/` dashboard measurement quality;
- schema/internal-link/report wiring;
- dashboard truth boundaries.

## Findings repaired

### 1. Public signal workflow total runtime was too short

The workflow used `SIGNAL_SOURCE_TIMEOUT_MS=7000`, and the throttle treated that as total collection runtime. With sequential source collection and delays, later sources could hit `Throttle runtime exceeded`.

Repair:

- added `SIGNAL_COLLECTION_RUNTIME_MS` support to `scripts/social/throttle.js`;
- set `SIGNAL_COLLECTION_RUNTIME_MS: "90000"` in `public-signal-processing.yml`;
- kept `SIGNAL_SOURCE_TIMEOUT_MS` as the per-source timeout.

### 2. Signal health was too optimistic

The previous admin signal status could say healthy as long as stored signal traces existed, even when fresh local collection returned zero new signals.

Repair:

- `scripts/ops/trace_workflows.js` now inspects `data/community/collection_status.json`;
- dashboard surfaces zero-fresh-signal and zero-Reddit warnings;
- stored signal corpus still preserves the pipeline when live collection is degraded.

### 3. `/admin/seo/` was not measuring enough real generated health

The dashboard leaned too heavily on manifest scores.

Repair:

- `scripts/quality/generate_seo_dashboard.js` now measures rendered `dist/**/*.html`;
- reads `dist/sitemap.xml` and `dist/sitemap-pages.xml`;
- scans rendered titles, descriptions, canonicals, JSON-LD, Article schema, BreadcrumbList schema, internal links, Wise Covington routing, content atoms, workflow trace, and signal ingestion;
- writes real `schema_audit.json` and `internal_link_report.json`.

### 4. GitHub Actions trace did not have a durable admin report

Repair:

- added `scripts/ops/simulate_github_actions.js`;
- added `scripts/ops/validate_github_actions_trace.js`;
- added package scripts:
  - `ops:simulate-github-actions`
  - `validate:github-actions-trace`
- writes `data/admin/github_actions_trace.json` and `reports/github-actions-simulation/`.

## Current known warnings

These are warnings, not hard fails:

- duplicate title groups detected in rendered pages;
- duplicate meta description groups detected;
- two rendered public pages have weak internal linking;
- local public/social signal simulation collected zero fresh signals due environment/source limitations;
- IndexNow/GSC proof remains live-only after apply.

## Truth boundary

This pass proves local structure, rendered dashboard health, local-equivalent workflow data trace, and artifact presence.

It does not prove live GitHub Actions, live GitHub secrets, live GSC, live IndexNow, or deployed runtime behavior.

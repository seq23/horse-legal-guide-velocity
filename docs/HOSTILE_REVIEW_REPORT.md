# Hostile Review Report — 2026-06-23

## Scope

Hostile review of the prior Horse Legal Guide Velocity baseline ZIP after the admin/content/SEO/AEO/GEO/workflow upgrade.

## Findings and repairs

### 1. Admin password was not operator-visible

The prior pass preserved only the SHA-256 hash in config. That validated, but it did not satisfy the owner requirement to keep the password visible.

Repair:

- verified the original password against the existing hash;
- preserved the original hash;
- added visible password reminder in `/admin/`;
- added password reminder in the browser prompt;
- documented that this is convenience-only, not real authentication.

Original password retained:

```text
ChangeThisAdminPassword123!
```

### 2. Workflow GitHub links were incomplete in `/admin/`

The prior pass traced workflows, but most admin workflow rows could show disabled action buttons because the admin page looked for mismatched workflow keys.

Repair:

- workflow trace now emits a `github_url` for every workflow;
- `/admin/` uses `github_url` directly;
- `/admin/seo/` also exposes workflow action links;
- workflow trace validator remains the local-equivalent proof gate.

### 3. Documentation was fragmented

The prior pass added features faster than it simplified docs. Operators had too many scattered documents.

Repair:

- archived older fragmented top-level docs under `docs/archive/2026-06-23-pre-hostile-review/`;
- created simplified `docs/README.md`;
- added focused runbooks for admin, content pipeline, workflow trace, citation velocity, Wise Covington routing, and indexing/distribution.

### 4. `/admin/` instructions were not robust enough

The prior admin page gave controls, but it did not explain the whole owner flow on-page.

Repair:

- added Admin Password and Operating Instructions section;
- added daily owner flow;
- added approval blockers;
- added warning-only rules;
- added approve-all-eligible command generation;
- added stronger workflow/signal guidance.

## Validation required after repair

```bash
npm run build
npm run validate:all
npm run ops:trace-workflows
npm run validate:workflow-trace
```

## Live proof boundary

This hostile review is local/container proof only. Live GitHub Actions and deployed runtime still require post-apply execution.

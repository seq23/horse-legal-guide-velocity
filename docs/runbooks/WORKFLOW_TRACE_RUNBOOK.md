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

The repository currently has **15 production workflows**. This list is the owner-facing automation inventory; it must stay one-to-one with `.github/workflows/`.

- `admin-bulk-content-actions.yml` — manual owner bulk approval/rejection/publish-date actions; may write editorial state after authenticated owner dispatch.
- `admin-maintenance.yml` — manual authenticated maintenance/self-heal/prevalidation lane; may write maintenance outputs but does not authorize approval-state changes.
- `agency-search-monitor.yml` — scheduled/manual GSC, Bing, live-route, query-intelligence, and remediation monitoring; writes evidence/state snapshots.
- `approved-content-email.yml` — manual approved-content email/social-copy notification lane; does not approve content.
- `build.yml` — manual build artifact lane; build/proof only.
- `deploy-distribution.yml` — distribution/indexing submission lane; provider-gated and non-authoritative for approval.
- `drafts-refresh.yml` — scheduled generation, self-heal, prevalidation, admin refresh, build, approved-only safety assertion, and commit of pending-draft/evidence state.
- `editorial-continuity.yml` — weekly unattended continuity sidecar; replenishes **pending** runway, rebuilds, runs the independent approved-only output assertion, validates, and can push generated/evidence state to `main`.
- `page-remediation.yml` — owner-approved existing-page remediation with separate approval/apply gates.
- `public-signal-processing.yml` — scheduled public/social signal ingestion and evidence refresh; rebuilds, runs approved-only output assertion, validates, and can push generated/evidence state.
- `publish.yml` — manual publish lane; builds approved + due content only and runs approved-only output assertion before distribution.
- `query-intelligence.yml` — provider-fed query recommendation lane; can admit owner-selected work into the pending review path only.
- `query-page-repair.yml` — owner-approved query-page repair lane with bounded apply behavior.
- `sitemap-indexing.yml` — manual sitemap/indexing utility.
- `validate.yml` — push/PR/manual repository gate; runs behavioral publish-safety tests, authority-modernization validation, and the primary validation suite.

**Manual-publishing invariant:** any workflow that rebuilds public output must preserve `review_status === "approved"` eligibility and pass `npm run validate:publish-safety` before a generated public-output commit can proceed.

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

## Protected-core baseline maintenance

`npm run protected-editorial-core:refresh` is an explicit owner/maintenance action used only after a reviewed source-baseline change. It refreshes protected file hashes and editorial identity hashes from the current approved source. It is never run automatically by validation or publishing workflows; `validate:protected-editorial-core` remains the fail-closed release check.

Protected editorial **identity** means durable source identity (`entry_id`, content type/cadence, source page/cluster/query). Routine editorial operations are deliberately mutable: scheduling dates, titles/slugs/paths created by bounded uniqueness repair, notes, quality scores, review state, and publish state must not trigger a protected-core failure. This keeps the validator fail-closed on source substitution while allowing the repo's native quality and scheduling workflows to operate.

## Main-writer serialization

Every GitHub Actions workflow that commits/pushes repository state uses the shared `horse-legal-guide-main-writer` concurrency group with `cancel-in-progress: false`. This serializes admin actions, continuity, draft refresh, search monitoring, distribution receipts, and notification-state commits so valid runs cannot race each other on `main`. Read-only build/validation workflows remain outside the writer lock.

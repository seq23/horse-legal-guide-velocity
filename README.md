# Wise Covington Equine Law Velocity

This repository is the **velocity artifact repo** for Wise Covington PLLC.

It is **not** the canonical site. The canonical site remains:

- https://wisecovington.com
- Velocity domain: https://horselegalguide.com

This repo exists to:

- capture long-tail equine law query demand
- publish neutral educational answer surfaces
- preserve community-style phrasing without fabricating sentiment
- feed qualified traffic and authority signals to the canonical site

## Operating rules

- Publishing mode is **manual**.
- Nothing goes live without approval.
- Every live page must include the approved footer disclaimer line.
- Every live page must link to the full Disclaimer and Privacy Policy pages.
- This repo must never compete with the canonical site on branded or conversion intent.

## Build

```bash
npm run validate:preflight
npm run build
npm run publish:mode
npm run validate:all
```

## Authority-scale truth boundary

The `100,000` authority-scale figure is a deterministic **fanout/opportunity-ID space** used to stress-test and organize planning intelligence. It is not 100,000 curated article opportunities, a page quota, a citation count, or an observed search/LLM outcome. Semantically actionable work is represented only by the downstream candidate/recommendation ledgers after clustering, deduplication, ownership, risk, and evidence gates.

## Packaging

Package from the true repo root as a baseline snapshot ZIP after validation.


## Content system layer

This repo now includes a manual-review content system with a yearly editorial backlog, a content calendar, generated draft files under `content/drafts/generated/`, and a lightweight static `/admin/` review page.

## Approval-gated operations

- `/admin/` preserves the existing review and command-generation method and adds optional GitHub-authenticated workflow buttons.
- `/agency/` is a private GitHub-authenticated GSC, Bing, live-search, query-intelligence, and remediation dashboard.
- Provider-fed opportunities can create pending drafts only.
- Existing-page remediation requires separate owner approval and apply operations.

Setup:

- `docs/runbooks/GITHUB_ADMIN_AUTH_SETUP.md`
- `docs/runbooks/AGENCY_SEARCH_PROVIDER_SETUP.md`
- `docs/runbooks/OWNER_APPROVED_REMEDIATION_RUNBOOK.md`


## Validator mode truth boundary

`validate:foundation:audit` softens only validators implemented through the shared `createReport()` helper. Legacy validators that call `fail()` or set a non-zero exit code directly remain blocking in both audit and enforce modes. Therefore **audit mode is not a globally non-blocking validation pass**. `validate:foundation:enforce` remains the authoritative blocking foundation mode.

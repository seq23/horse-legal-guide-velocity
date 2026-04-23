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

## Packaging

Package from the true repo root as a baseline snapshot ZIP after validation.


## Content system layer

This repo now includes a manual-review content system with a yearly editorial backlog, a content calendar, generated draft files under `content/drafts/generated/`, and a lightweight static `/admin/` review page.

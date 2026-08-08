# Horse Legal Guide — External Search Intelligence + Owner-Gated Self-Healing Repair Artifact

## Full intended system
Horse Legal Guide actively measures a governed legal-query panel, observes live Google-grounded search sources, compares actual surfaced competitor pages, combines that evidence with GSC/Bing/IndexNow state, diagnoses missing/wrong-page/cannibalization outcomes, prepares finished bounded repairs, and retests after deployment. The client remains the authority for publication and substantive live legal-page changes.

## Implemented in this snapshot
- Added a deterministic 30-query measurement panel drawn from the native query universe across legal clusters.
- Added Gemini Google Search grounding with explicit `rank_verified:false`; source attribution accounts for Google grounding redirect URLs and domain titles.
- Added direct competitor-page structure observation from actual grounded citations.
- Replaced dormant/fake-shaped PAA/SERP behavior with truthful provider-gated adapters and per-source health states.
- Replaced placeholder GSC sitemap/inspection wrappers with real authenticated GSC API operations and durable receipts.
- Preserved the existing real IndexNow implementation and distinguishes live success from dry-run evidence.
- Added provider health and machine-readable external-action truth ledgers.
- Joined active observations with GSC/Bing into query diagnostics and provider opportunities.
- Added automatic finished query-driven patch preparation using only already-approved Horse Legal Guide answer content; competitor snippets are not copied or used as legal authority.
- Added separate owner approve/reject/apply workflow for query-driven live-page repairs, with GitHub-authenticated additive controls.
- Added post-deployment retest states (`observed_after_repair` / `still_missing_after_repair`).
- Added active query tests, competitor evidence, provider truth, and query-repair controls to the private `/agency/` page.
- Added observed external evidence into the existing authority-velocity governor while preserving `editorial_release_velocity: UNCHANGED_EXISTING_CLIENT_SYSTEM`.
- Added hard structural contracts for provider truth and the query → competitor → diagnosis → owner-approved repair loop.
- Existing `/admin/` generated surface is byte-for-byte unchanged from the approved source snapshot.
- All 300 editorial items remain pending; `auto_approve=false`, `auto_publish_approved_due=false`, `legal_review_required=true`.

## Not implemented / not claimed
- No live provider secret values are included.
- No live Gemini/GSC/Bing/IndexNow success is claimed from this artifact alone.
- No Google/Bing ranking or indexation result is guaranteed.
- No query-driven live legal-page patch is pre-approved or applied in this artifact.

## Required runtime secrets
Configure outside the repository: `GEMINI_API_KEY`, GSC credentials, `BING_SITE_URL`, `BING_WEBMASTER_API_KEY`, `INDEXNOW_KEY`, and the existing GitHub admin/OAuth secrets.

## Validation boundary
This artifact is structurally checked only. The local updater remains authoritative for full repo validation, commit, push, deployment, and provider activation.

# Horse Legal Guide — Phase 1 Truth and Uniqueness Foundation

## Full intended system

Horse Legal Guide remains a client-controlled, manual-approval legal-content system. Automation may measure, draft, repair, validate, and recommend, but it may not approve or publish content or mutate existing live legal pages without explicit client action.

## Implemented in this snapshot

1. Fresh rendered-page uniqueness measurement on every release build.
2. Shared similarity engine for titles, descriptions, rendered body content, intent overlap, and page-family reporting.
3. Fresh SEO dashboard fingerprinted to the current rendered build so stale clean scores cannot survive a release.
4. Owner-review consolidation ledger for existing live-page overlap.
5. Automatic draft differentiation before approval eligibility:
   - detect substantial similarity;
   - deterministically rewrite the draft using a distinct legal-analysis angle;
   - recheck against the current public corpus and earlier repaired drafts;
   - keep bounded repair receipts and similarity evidence;
   - expose only a final approval-eligible draft to the client.
6. Manual approval and manual publication preserved.
7. Validator reconciliation so warning-level existing-page overlap is reported truthfully without silently changing live pages.
8. Static report links available from the existing `/admin/seo/` surface without redesigning `/admin/`.

## Current measured state

- Public rendered pages: 560
- Indexable pages measured: 556
- Duplicate-title groups: 79
- Duplicate-description groups: 4
- High-similarity live-page pairs: 251
- Intent-overlap pairs: 198
- Owner-review clusters: 71
- Drafts checked: 300
- Drafts automatically differentiated: 234
- Draft uniqueness failures: 0
- Approval-eligible drafts after repair: 300
- Drafts automatically approved: 0
- Drafts automatically published: 0
- Existing live pages automatically changed: 0

## Approval boundary

All 300 backlog items remain `pending`. A draft must pass uniqueness self-healing and prevalidation before it can become approval-eligible, but approval remains an explicit client decision. Publication remains manual. Existing live pages are only measured and placed in an owner-review ledger.

## Not implemented in this snapshot

- No `/admin/` redesign.
- No GitHub authentication or one-click mutation controls.
- No `/agency/` route.
- No GSC Search Analytics connector.
- No Bing Webmaster Tools connector.
- No provider-fed query intelligence.
- No redirects, canonical changes, `noindex` changes, URL removals, or rewrites of existing live pages.
- No automatic approval or publication.

## Remaining phases

- Phase 2: additive GitHub-authenticated admin controls while preserving the current admin method.
- Phase 3: GSC, Bing, and private `/agency/` monitoring.
- Phase 4: provider-fed query intelligence and review-gated live-page proposals.
- Phase 5: owner-approved remediation of existing page overlap.

## Validation

`npm run validate:all` passed after a clean rebuild, including manual-mode enforcement, review flow, uniqueness, self-heal, prevalidation, public surfaces, internal links, canonical protection, distribution, workflow trace, and automation-mode contracts.

## Artifact status

STRUCTURALLY CHECKED — LOCAL UPDATER VALIDATION, COMMIT, PUSH, AND DEPLOYMENT REQUIRED.

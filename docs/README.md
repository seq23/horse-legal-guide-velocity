# Wise Covington Velocity Docs

This folder is the onboarding and operations library for the Horse Legal Guide velocity repo.

## Start here
1. `CONTENT_OPERATING_SYSTEM.md`
2. `VA_ONBOARDING.md`
3. `APPROVAL_AND_PUBLISHING.md`
4. `WORKFLOWS.md`
5. `FAILURE_HANDLING.md`

## Repo purpose
- This repo is the velocity/supporting site for `wisecovington.com`.
- It is LLM-first and query-capture-first.
- It is not the canonical site and should not compete with the canonical site.
- Publishing mode is manual.

## Critical distinction: evergreen vs scheduled content
This repo has **two different content systems**.

### 1. Evergreen content families already in the repo
These are part of the standing site structure and are not managed through the editorial approval queue:
- FAQ
- Scenario
- Comparison

These already exist in source content folders and build into the public site structure:
- `content/faq/`
- `content/scenarios/`
- `content/comparisons/`

They are part of the repo's evergreen knowledge surface.

### 2. Scheduled editorial backlog requiring approval
These are calendar-driven draft items that live in the year-end backlog and must be approved before publish:
- insight
- article
- whitepaper
- deep_authority

These are generated into the drafts system and reviewed through `/admin`.

## Current editorial state
- All scheduled editorial backlog items are currently `pending`.
- Insights are **not approved**.
- FAQ / scenario / comparison are **not** approval-queue content types in the current repo model.
- FAQ / scenario / comparison still exist as evergreen site content families.

## Rule for VAs and reviewers
If you are looking in `/admin`, you are looking at the **scheduled editorial backlog**, not the full evergreen site.
Do not assume a content family is missing from the site just because it does not appear in `/admin`.

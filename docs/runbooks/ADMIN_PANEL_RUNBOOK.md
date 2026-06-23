# Admin Panel Runbook

## Purpose

`/admin/` is the owner cockpit for the Horse Legal Guide velocity site. It previews generated articles, displays quality/citation/routing health, links to GitHub edit locations, and generates safe approval/rejection/publish-date commands.

It is not a real CMS. Repository state changes happen through scripts, GitHub edits, or GitHub Actions.

## Password

`ChangeThisAdminPassword123!`

This is intentionally visible in the admin UI and docs so the operator does not lose it. It is not real authentication. Do not store actual production secrets here.

## Sections

1. **Mission** — confirms the repo goal: LLM citation velocity and routing to Wise Covington.
2. **Admin password and operating instructions** — password reminder, daily flow, approval blockers, warning-only items.
3. **Summary cards** — totals, warnings, hard fails, citation health, routing health.
4. **Bulk action control** — select visible/pending/eligible/warnings/hard fails and generate commands.
5. **Filters** — search by title, cluster, query, status, quality state.
6. **SEO/AEO/GEO and citation health** — links to `/admin/seo/`.
7. **Workflow and signal health** — shows local workflow traces and GitHub workflow links.
8. **Article queue** — preview cards with edit/action links.

## Individual article actions

Each article card includes:

- Edit Content in GitHub
- Edit Metadata in GitHub
- Open Bulk Action Workflow
- Open Published/Preview Page
- copy approve command
- copy reject command
- copy needs-revision command
- copy publish-date command

## Bulk approval

Use only when selected articles are approval eligible.

Approval eligible means:

- self-heal passed;
- prevalidation passed;
- legal safety passed;
- data atom present;
- Wise Covington routing present;
- no hard fails.

## Bulk rejection

Use when a group should not publish. Rejection preserves traceability; it should not delete the draft.

## Needs revision

Use for content that may still be useful but needs judgment, rewrite, stronger atom, routing fix, or legal-safety review.

## Publish dates

Set publish dates only after content is approved or intentionally scheduled for review. Publishing still requires approved + due state.

## Safe static-site boundary

If a button opens GitHub or generates a command, it is safe. If a button appears to mutate status directly without GitHub/workflow/script backing, that is invalid and must be fixed.

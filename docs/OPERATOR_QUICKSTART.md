# Operator Quickstart

## Admin password

`ChangeThisAdminPassword123!`

This is intentionally visible in the admin UI and docs so the operator does not lose it. It is not real authentication. The SHA-256 hash in `data/system/config.json` was preserved and still matches this password.

## Daily review flow

1. Open `/admin/`.
2. Enter the password shown above.
3. Check the top summary cards.
4. Open the **LLM Citation Velocity Dashboard** at `/admin/seo/` if anything is below target.
5. Filter the article queue by pending, approval eligible, warnings, missing data atom, or missing routing.
6. Preview individual cards.
7. Use **Edit Content in GitHub** for copy/content changes.
8. Use **Edit Metadata in GitHub** for status/date/metadata changes.
9. Select one or more articles.
10. Generate a command or open the GitHub workflow.
11. Approve, reject, mark needs revision, or set publish dates.
12. Publish only approved + due content.

## What blocks approval

- Hard fails.
- Missing data atom.
- Missing Wise Covington routing.
- Failed self-heal.
- Failed prevalidation.
- Legal-safety issue.
- Invented attorney/contact information.

## What is warning-only

- Word count outside the preferred range.
- Metadata could be sharper.
- Humanization/cadence warning.
- Optional schema/internal-link improvement.
- Freshness recommendation.

## Main commands

```bash
npm run content:self-heal
npm run content:prevalidate
npm run content:quality-report
npm run admin:manifest
npm run build
npm run validate:all
```

## Bulk commands

```bash
npm run admin:approve-many -- <entry_id> <entry_id>
npm run admin:reject-many -- <entry_id> <entry_id>
node scripts/admin/mark_many_needs_revision.js <entry_id> <entry_id>
node scripts/admin/set_publish_date_many.js YYYY-MM-DD <entry_id> <entry_id>
node scripts/admin/clear_publish_date_many.js <entry_id> <entry_id>
npm run admin:approve-all-eligible
```

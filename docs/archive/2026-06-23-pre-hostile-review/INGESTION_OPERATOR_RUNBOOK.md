# Ingestion Operator Runbook

Status: active
Audience: Owner + Day-0 VA

## VA workflow

1. Open a public source.
2. Confirm it is not a login-only/private group page.
3. Copy the URL.
4. Copy the title or question phrasing.
5. Add a short excerpt only if needed. Keep it under 300 characters.
6. Add the item to `data/community/manual_import.json`.
7. Run `npm run ingest:manual`.
8. Review `data/community/ingestion_report.json`.
9. Send the report to Owner for approval.

## Owner workflow

1. Review promoted queries.
2. Approve or reject new page creation.
3. Approve or reject new source domains.
4. Block any source that feels private, copied, or legally risky.

## Commands

```text
npm run collect:signals
npm run normalize:signals
npm run map:signals
npm run report:ingestion
npm run validate:ingestion
npm run validate:all
```

## Recovery

If validation fails, do not publish. Fix the flagged source record, remove the unsafe item, rerun ingestion, rerun validation, then rebuild.

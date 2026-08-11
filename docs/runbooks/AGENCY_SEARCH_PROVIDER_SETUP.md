# GSC, Bing, and `/agency/` setup

## Truth boundary

The repository contains provider clients, workflows, snapshots, and a private `/agency/` dashboard. Live provider success is not proven until the workflows run with real account credentials.

Provider failures degrade to warning snapshots. They do not approve content, publish content, or authorize live-page remediation.

## Google Search Console

Preferred GitHub Actions secrets:

- `GSC_SITE_URL=sc-domain:horselegalguide.com`
- `GSC_SERVICE_ACCOUNT_JSON` containing the complete service-account JSON document

Alternative secrets:

- `GSC_SERVICE_ACCOUNT_EMAIL`
- `GSC_PRIVATE_KEY`

A short-lived `GSC_ACCESS_TOKEN` is also supported for testing but is not the preferred scheduled configuration.

Grant the service-account email access to the Search Console property. The monitor collects:

- Current and previous performance totals
- Top queries
- Top pages
- Query/page pairs
- Daily rows
- Submitted sitemaps
- A bounded sample of URL Inspection results

## Bing Webmaster Tools

Required GitHub Actions secrets:

- `BING_SITE_URL=https://horselegalguide.com/`
- `BING_WEBMASTER_API_KEY`

The monitor collects:

- Site recognition
- Rank and traffic statistics
- Query statistics
- Crawl statistics

## Workflow

`Agency Search Monitor` runs daily and can also be dispatched from `/agency/` or GitHub Actions.

It refreshes:

1. GSC, Bing, and live-route snapshots.
2. Provider-fed query opportunities.
3. The owner-review remediation queue.
4. The private agency report.
5. Validation and durable evidence artifacts.

## Private dashboard

Route: `/agency/`

Access requires an authenticated, allowlisted GitHub admin session. The route is `noindex,nofollow` and excluded from public sitemaps.

## Source implementation status

The GSC and Bing clients, scheduled workflow, snapshot schema, dashboard integration, and provider-truth fallbacks are already implemented in source. The remaining activation is external account configuration, not a new code phase.

After secrets are provisioned, dispatch **Agency Search Monitor** once and verify:

```text
data/agency/gsc_snapshot.json status = connected/ok with real metrics
data/agency/bing_snapshot.json status = connected/ok with real provider rows
```

If credentials are absent or rejected, snapshots must remain `not_connected`/degraded and must never be represented as live measurement proof.

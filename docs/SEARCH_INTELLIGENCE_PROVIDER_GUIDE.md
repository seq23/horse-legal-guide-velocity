# Search Intelligence Provider Guide

## Purpose
Horse Legal Guide actively measures a small governed query panel, compares live grounded-search evidence with Google Search Console/Bing evidence, observes competing public pages, and prepares bounded repairs. This measurement layer never changes the existing editorial publication cadence.

## Truth boundary
- Gemini Google Search grounding is a live web/search observation source. It may show which sources are cited/surfaced; it is **not** recorded as literal organic rank.
- Google Search Console is the source of truth for Horse Legal Guide Google clicks, impressions, CTR, average position, sitemap state, and URL Inspection results.
- URL Inspection reports Google index/crawl status. It does not force indexing.
- Bing Webmaster data is stored separately from Google data.
- IndexNow success requires a real HTTP submission receipt. Dry runs never count as live success.
- Competitor pages are used for public structure/topic-gap observation only. Competitor text is not copied and is not legal authority.

## Required secrets
Configure only in GitHub Actions / runtime secret storage. Never commit values:
- `GEMINI_API_KEY`
- `GSC_SITE_URL`
- one GSC auth mode: `GSC_SERVICE_ACCOUNT_JSON` OR `GSC_SERVICE_ACCOUNT_EMAIL` + `GSC_PRIVATE_KEY` OR short-lived `GSC_ACCESS_TOKEN`
- `BING_SITE_URL`
- `BING_WEBMASTER_API_KEY`
- `INDEXNOW_KEY`

## Client approval boundary
Scheduled workflows may search, compare, diagnose, prepare finished page patches, repair unpublished drafts, and retest. A substantive live legal-page patch remains blocked until the owner approves that specific repair. Approval and apply are separate workflow operations and both produce receipts.

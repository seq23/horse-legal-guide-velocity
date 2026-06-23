# Horse Legal Guide — Client Quick Guide

## What this site does

Horse Legal Guide is an educational content site designed to help Wise Covington become more discoverable in search engines, AI answer engines, and large language model tools such as ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews.

The main Wise Covington site remains the primary law firm site. Horse Legal Guide supports it by publishing structured, plain-English educational pages around equine legal questions and routing readers back to Wise Covington when they may need legal help.

More approved, useful content creates more pages for search engines and LLMs to crawl, understand, summarize, and potentially cite. No one can guarantee an AI citation, but a larger library of clear, well-structured content creates more chances for citation and discovery over time.

## Admin links

- Admin review panel: `https://horselegalguide.com/admin/`
- AEO / SEO / GEO dashboard: `https://horselegalguide.com/admin/seo/`
- Main Wise Covington site: `https://wisecovington.com`

Admin password:

`ChangeThisAdminPassword123!`

This is a convenience gate, not a secure client portal. Do not enter confidential client facts, privileged information, or private legal matter details into this static system.

## How to use the admin panel

1. Open `https://horselegalguide.com/admin/`.
2. Use the password shown on the landing page to unlock the review panel.
3. Review the count tiles at the top: Pending, Approval eligible, Approved, Needs revision, Rejected, Warnings, and Hard fails.
4. Use the filters instead of searching by title. You can filter by status, quality, content type, cluster, sort order, and rows per page.
5. Select one or more rows and generate an approve, reject, needs revision, or publish-date command.
6. Use the article links to edit content or metadata in GitHub.
7. After edits or approval changes, rebuild and validate before publishing.

## What the statuses mean

When editing metadata manually, open the article’s metadata link, find the matching `entry_id`, and update both `status` and `review_status`.

| Decision | Change `status` to | Change `review_status` to | Optional field |
|---|---|---|---|
| Approve | `approved` | `approved` | Add `publish_date` if scheduling |
| Reject | `rejected` | `rejected` | Add `rejection_reason` if helpful |
| Needs revision | `needs_revision` | `needs_revision` | Add `revision_reason` if helpful |
| Schedule | `approved` | `approved` | Set `publish_date` to `YYYY-MM-DD` |

The preferred path is to use the generated commands or GitHub workflow so `data/system/editorial_backlog.json` and `data/system/content_calendar.json` stay synchronized.

## What to approve

Approve content when it is accurate, educational, safe, useful, and clearly routes legal matters back to Wise Covington.

Mark content as needs revision when it is close but needs edits.

Reject content when it should not be published.

Hard fails should not be approved until fixed. Warnings are review notes; they are not always blockers.

## What the dashboard does

The AEO / SEO / GEO dashboard at `/admin/seo/` tracks citation-readiness, schema, metadata, internal linking, answer structure, workflow health, Wise Covington routing, and generated issue groups.

I will use this dashboard over the next year+ to keep the site maintained, monitor publishing health, and identify improvements that can increase the chance of search and LLM discovery.

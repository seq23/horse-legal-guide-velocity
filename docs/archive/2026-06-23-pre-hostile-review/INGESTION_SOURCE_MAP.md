# Ingestion Source Map

Status: active
Audience: Owner + Day-0 VA

## Purpose

This repo ingests public question signals, not copied community content. The source stack is governed by `data/ingestion/source_registry.json` and `data/system/query_source_policy.json`.

## Approved source order

1. Reddit — Tier 1
2. Equestrian forums — Tier 1
3. Google People Also Ask / approved SERP provider — Tier 1
4. SERP competitor research — Tier 1
5. YouTube — Tier 2
6. Instagram — Tier 2
7. Quora — Tier 2

Facebook Groups are removed and may not be used.

## Data allowed

Allowed: URL, title/question, created date if available, score/comment count if available, short excerpt under 300 characters, source key, cluster, mapped slug.

Disallowed: full threads, full comments, private messages, usernames for targeting, login-only content, profile enrichment, phone numbers, emails, addresses, medical/financial/private details, copied answer bodies.

## Source addition rule

A new source may be added only after Owner approval and only if it is public, legally accessible, not login-only, and compatible with the storage limits above.

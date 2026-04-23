# VA ONBOARDING

## What this repo is
This repo is the Horse Legal Guide velocity site for Wise Covington.
It supports `wisecovington.com` and should not compete with it.

## First thing to understand
This repo has **two different content systems**.
If you do not understand this distinction, you will get confused.

### A. Evergreen content families already in the repo
These are standing site content families and are not the normal approval-queue content.
Current evergreen families:
- FAQ
- Scenario
- Comparison

These live in:
- `content/faq/`
- `content/scenarios/`
- `content/comparisons/`

### B. Scheduled editorial backlog requiring approval
These are calendar-driven draft items reviewed through `/admin`.
Current editorial backlog types:
- insight
- article
- whitepaper
- deep_authority

## What you do
- Review pending scheduled editorial content in `/admin`
- Approve or reject content using the approved workflow
- Escalate anything legally nuanced or strange
- Do not change compliance language casually

## What you do not do
- Do not rewrite disclaimer or privacy text
- Do not override validation rules
- Do not publish rejected or failed drafts
- Do not add aggressive CTA language
- Do not make the site sound like a sales page
- Do not assume missing `/admin` entries mean missing site content

## Safe workflow
1. Open `/admin`
2. Review pending scheduled editorial items
3. Approve safe backlog content types in batch when instructed
4. Escalate anything that feels off
5. If you need to confirm evergreen content, inspect the evergreen folders directly

## Current editorial calendar types
- insight
- article
- whitepaper
- deep_authority

## Bulk approval examples
- `node scripts/admin/approve_by_type.js insight`
- `node scripts/admin/approve_by_type.js article`

## Escalate if
- a page sounds like legal advice
- the tone feels corporate or harsh
- the content appears thin or repetitive
- the page seems off-brand for equestrians

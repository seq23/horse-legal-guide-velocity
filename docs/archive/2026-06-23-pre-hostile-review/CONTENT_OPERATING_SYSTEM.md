# CONTENT OPERATING SYSTEM — WISE COVINGTON VELOCITY

## 1. Content system overview
This repo runs on **two parallel content layers**:

### Evergreen content layer
This is the standing site knowledge base already stored in the repo.
It is not scheduled through the editorial calendar.
It is not the normal approval-queue system.

Current evergreen families:
- FAQ
- Scenario
- Comparison

These live in:
- `content/faq/`
- `content/scenarios/`
- `content/comparisons/`

They build directly into the site structure and exist to maintain baseline query coverage.

### Scheduled editorial backlog layer
This is the calendar-driven draft system that requires approval before publish.
It is reviewed in `/admin`.

Current scheduled editorial types:
- insight
- article
- whitepaper
- deep_authority

These are generated into `content/drafts/generated/` and tracked in:
- `data/system/editorial_backlog.json`
- `data/system/content_calendar.json`

## 2. Current state
- Draft backlog exists through 2026-12-31.
- Drafts are generated and validated at creation time.
- Publish mode is manual.
- Approved content does not go live until the publish workflow runs.
- All scheduled editorial backlog entries are currently `pending`.
- Insights are **not approved**.

## 3. How content moves
### Evergreen content
Evergreen content is repo-native content already in place.
It is maintained as part of the evergreen site surface.
It does **not** move through the standard editorial approval queue.

### Scheduled editorial content
1. Draft generated
2. Draft validated at creation time
3. Draft appears in approval queue if reviewable
4. Draft is approved or rejected
5. Publish workflow builds approved content into live output

## 4. Approval methods
These commands apply to the **scheduled editorial backlog**, not to evergreen repo families.

### Approve one
`node scripts/admin/approve_one.js <entry_id>`

### Reject one
`node scripts/admin/reject_one.js <entry_id>`

### Approve by type
`node scripts/admin/approve_by_type.js <content_type>`

Examples:
- `node scripts/admin/approve_by_type.js insight`
- `node scripts/admin/approve_by_type.js article`
- `node scripts/admin/approve_by_type.js whitepaper`
- `node scripts/admin/approve_by_type.js deep_authority`

### Approve by filter
`node scripts/admin/approve_by_filter.js <field> <value>`

## 5. What happens when content fails
Hard-fail drafts do not enter the normal approval path.
They are routed to revision.

Hard-fail conditions:
- below 80% of floor
- no internal links
- no canonical routing block

Warnings stay in backend/dev surfaces only. They are hidden from `/admin`.

## 6. Publish rule
Only content that is both:
- approved
- not validation-fail

can be published.

This rule applies to the scheduled editorial backlog.

## 7. Team operating rule
The team should treat `/admin` as the review surface for the **scheduled editorial backlog**.
Do not use `/admin` to judge whether evergreen FAQ / scenario / comparison content exists in the repo.

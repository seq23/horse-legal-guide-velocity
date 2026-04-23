# APPROVAL AND PUBLISHING

## Approval vs publishing
Approval does not equal publishing.
Approval updates draft metadata.
Publishing requires the publish workflow to run.

## Important distinction
Approval in this repo applies to the **scheduled editorial backlog**.
It does not govern the evergreen FAQ / scenario / comparison families already stored in the repo.

## Evergreen content families
These are standing repo content families:
- FAQ
- Scenario
- Comparison

They are not normal approval-queue types in the current repo model.

## Scheduled editorial backlog types
These do require approval:
- insight
- article
- whitepaper
- deep_authority

## Approval states
- pending
- approved
- rejected

## Validation states
- pass
- warning (hidden from `/admin`)
- fail

A draft can publish only if:
- review status is approved
- generation validation is not fail

## Quick commands
### Approve one
`node scripts/admin/approve_one.js <entry_id>`

### Reject one
`node scripts/admin/reject_one.js <entry_id>`

### Approve all of a type
`node scripts/admin/approve_by_type.js insight`

### Approve by filter
`node scripts/admin/approve_by_filter.js content_type article`

## Current state
- All scheduled editorial backlog items are currently pending.
- Insights are not approved.
- FAQ / scenario / comparison are evergreen site content families, not approval-queue backlog types.

## To publish approved content
Run the publish workflow or the equivalent local build/publish path.
Publishing is still manual.

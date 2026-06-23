# WORKFLOWS

## drafts-refresh.yml
Purpose:
- regenerate scheduled editorial drafts
- run draft-time validation
- refresh admin view

This workflow does not publish content.

## publish.yml
Purpose:
- locate approved scheduled editorial drafts
- run final publish validation
- build live output

This workflow should only publish content that is approved and not validation-fail.

## Important distinction
These workflows are primarily about the **scheduled editorial backlog**.
They are not the source of truth for whether evergreen FAQ / scenario / comparison content exists in the repo.

## Operational rule
Draft generation and draft validation happen before approval.
Final publish validation happens again at publish time as a safety gate.

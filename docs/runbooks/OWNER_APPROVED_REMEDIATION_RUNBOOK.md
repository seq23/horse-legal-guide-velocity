# Owner-approved existing-page remediation

## Non-negotiable rule

The system may detect overlap and recommend actions automatically. It may not apply a live-page search control or patch without explicit owner approval.

Draft duplicate problems are handled separately: pending drafts self-heal automatically before client review. Existing published legal pages do not.

## Two-gate flow

1. **Approve** a proposal with one explicit action.
2. **Apply** that already-approved proposal in a separate operation.

Supported actions:

- `noindex_keep_llm`
- `canonical_to_primary`
- `redirect_to_primary`
- `differentiate_patch`

`differentiate_patch` additionally requires a reviewed `patch_plan` before application.

## Evidence

- Queue: `data/remediation/remediation_queue.json`
- Applied controls: `data/remediation/applied_search_controls.json`
- Reports: `reports/remediation/`
- Workflow artifacts: `Owner Approved Page Remediation`
- Authenticated action receipts: `data/admin/action_receipts/`

## Safe use

1. Refresh the queue.
2. Review the candidate primary and every member URL.
3. Check GSC/Bing traffic before consolidating an existing page.
4. Approve one action.
5. Run a dry run.
6. Apply the approved proposal.
7. Review the build and validation output.
8. Verify the deployed canonical, robots, redirect, sitemap, and destination behavior.

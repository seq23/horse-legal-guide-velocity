# Citation Recommendation Workflow

This document defines the Phase 11 operating system for future citation-agent or PDF recommendation waves.

## Objective

Turn future recommendation sets into a deterministic execution pipeline instead of manual sorting.

## Intake flow

1. Add or import recommendations into `data/recommendations/incoming_recommendations.json`.
2. Keep every item normalized around:
   - recommendation id
   - source
   - status
   - severity
   - confidence
   - target type
   - target
   - recommendation type
   - summary
   - suggested action
3. Run:

   ```bash
   node scripts/recommendations/process_recommendations.js
   ```

4. Review the generated lane reports under `reports/`.

## Lanes

- `page_patch_queue` → safe page-local patch lane
- `system_fix_queue` → renderer / template / routing / family-level work
- `validator_backlog` → validation hardening work
- `cluster_gap_backlog` → new support-page or cluster-completeness work

## Batch logic

Recommendations are grouped into execution batches so that repeated work lands together.

Examples:
- quick-answer upgrades
- compare verdict upgrades
- scenario triage upgrades
- validator compare family
- cluster sale gaps

## Recommended execution order

1. page-local patches that deliver immediate wins
2. system/family fixes that remove repeated defects
3. validator upgrades that lock the quality gains in place
4. cluster gap work that expands support depth

## Outputs

The workflow generator writes:
- `reports/recommendation_patch_queue.json`
- `reports/recommendation_system_queue.json`
- `reports/recommendation_validator_backlog.json`
- `reports/recommendation_cluster_gap_backlog.json`
- `reports/recommendation_execution_batches.json`
- `reports/recommendation_normalized_intake.json`

## Validation

Run:

```bash
node _ops/validators/validate_recommendation_workflow.js
```

This confirms that:
- intake fields are complete
- target types and recommendation types map correctly
- every recommendation lands in exactly one lane
- every recommendation is assigned to a batch

## Operating principle

Future recommendation waves should be processed like this:

recommendations in
→ normalize
→ classify
→ batch
→ execute by lane
→ validate
→ rebuild
→ include in next cumulative baseline

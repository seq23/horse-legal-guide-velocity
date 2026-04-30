# Round 2 Stabilization Rules

This phase locks the repo against drifting back into the weakest pre-upgrade patterns.

## What is now enforced

- Compare pages must contain a decision scaffold, not a general educational summary.
- Scenario pages must contain a triage scaffold with evidence and next-move logic.
- FAQ quick answers must open directly enough for extraction and not lean on soft hedge openings.
- Banned generic scaffold language from the pre-upgrade family audit must not reappear in stabilized families.

## Validator surface

- `validate:family-scaffold`
- `validate:compare-contract`
- `validate:scenario-contract`
- `validate:faq-opening`

These validators are part of `validate:all` and are intended to make future PDF-driven changes safer by catching regression into generic answer language.

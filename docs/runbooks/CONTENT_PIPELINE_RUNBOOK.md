# Content Pipeline Runbook

## Core lifecycle

```text
GENERATE
→ SELF-HEAL
→ PREVALIDATE
→ SCORE
→ QUEUE FOR APPROVAL
→ APPROVE / REJECT / NEEDS REVISION
→ PUBLISH IF APPROVED + DUE
```

A draft is not complete just because a file exists. Future content is complete only after self-heal and prevalidation pass.

## Commands

```bash
npm run generate:drafts
npm run content:self-heal
npm run content:prevalidate
npm run content:quality-report
npm run admin:manifest
npm run build
npm run validate:all
```

## Self-heal repairs

Self-heal may fix:

- missing direct answer block;
- missing title/meta;
- weak intro;
- missing data atom;
- missing internal links;
- missing FAQ where appropriate;
- missing disclaimer;
- missing Wise Covington routing block;
- missing schema metadata;
- repeated boilerplate;
- generic cadence;
- missing practical next-step block.

Self-heal may not fabricate:

- legal cases;
- statutes;
- attorney quotes;
- state-specific legal conclusions;
- fake statistics;
- fake citations;
- fake contact details;
- fake credentials.

## Prevalidation hard blockers

- missing file;
- malformed frontmatter;
- invalid status;
- invalid publish date;
- unresolved template token;
- missing legal disclaimer;
- missing data atom on approval-eligible content;
- missing Wise Covington routing on approval-eligible content;
- legal-safety issue;
- invented attorney/contact detail.

## Warning-only issues

- word count outside the preferred band;
- title/meta could be sharper;
- repeated cadence;
- optional schema/internal-link improvement;
- freshness note.

## Word count policy

Word count is advisory only. It may create warnings and lower a score. It must not hard-fail approval, build, or publishing unless the file is blank or corrupted.

## Content atoms

Every approval-eligible article needs a defensible data atom:

- comparison table;
- decision tree;
- clause map;
- checklist;
- risk matrix;
- scenario matrix;
- named framework;
- question script;
- state variance note;
- source-signal synthesis from real ingested data.

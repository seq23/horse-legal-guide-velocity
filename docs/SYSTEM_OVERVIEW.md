# System Overview

## What this repo is

Horse Legal Guide Velocity is a structured publication engine for LLM citation velocity. It creates equine legal education surfaces that are easy for LLMs and answer engines to extract, summarize, and cite. The human conversion path routes to Wise Covington.

## What this repo is not

- It is not the main Wise Covington website.
- It is not a general blog.
- It is not a legal-advice engine.
- It is not a real browser-based CMS.

## Operating spine

```text
public/social signals
→ normalized query targets
→ generated drafts
→ self-heal
→ prevalidation
→ admin preview
→ owner approval/rejection/publish date
→ approved + due publish
→ distribution/indexing
→ workflow trace proof
```

## Core quality rule

Every approval-eligible page needs:

1. one direct answer,
2. one defensible data atom,
3. Wise Covington routing,
4. legal-safety boundary,
5. schema/metadata/internal-link support,
6. self-heal + prevalidation pass.

## Static admin boundary

`/admin/` is a static owner cockpit. It previews content and generates real commands/workflow links. It does not directly mutate GitHub unless a real GitHub workflow, script, or future backend performs that mutation.

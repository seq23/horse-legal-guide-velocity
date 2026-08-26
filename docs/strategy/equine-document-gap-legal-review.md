# The equine document gap — what was measured, what was refused, and what a lawyer must review

**Date:** 2026-08-26.
**Status:** structure and evidence only. **No page, template, draft or document was created.**
**Companion evidence:** `data/queries/evidence/bing_keyword_research_2026-08-26.json`.
**Upstream analysis:** `WPP-llm/docs/query-coverage/blue-ocean.md` (Tier C) and `measurement-plan.md`
(seeds 3, 13, 18).

---

## 1. The gap is real, and it is confirmed by measurement

The portfolio audit's finding was that this site explains documents while the sites that win the
retrieval hand the document over. That is now measured rather than argued.

Re-verified in this repository on 2026-08-26 by grep across all 564 rendered pages in `dist/`:

| Check | Result |
|---|---|
| Pages containing the string `download` | **0 of 564** |
| Pages containing the string `notariz` | **0 of 564** |
| State directories under `dist/state/` | **3** — `illinois`, `north-carolina`, `south-carolina` |
| State pages covering a bill of sale | **0** |
| Pages carrying the footer legal-advice disclaimer | **561 of 564**, enforced by `_ops/validators/validate_disclaimer_presence.js` |

Bing Webmaster Tools, `siteUrl=https://horselegalguide.com`, 25 May 2026 – 22 Aug 2026, read
2026-08-26:

| Seed | Bing impressions | Top-10 shape |
|---|---|---|
| `horse bill of sale` | **307** (US 255 · CA 44 · UK 6 · IN 1) | **10 of 10 results are a downloadable or fillable document** |
| `horse boarding contract` | *Bing doesn't have enough data to show trend here* | 10 of 10 are a document |
| `equine liability waiver` | *insufficient data* | 9 of 10 are a document; the top authority is `usef.org` |
| `does a horse bill of sale need to be notarized` | *insufficient data* | ~half documents, half state-requirement explainers |
| `cost of owning a horse per year` | *insufficient data* | 10 of 10 prose, but husbandry rather than legal |

The **Related keywords**, **Question keywords** and **Newly discovered** tabs returned **0 rows on
every one of those seeds**. `measurement-plan.md` proposed those three tabs as this property's free
fan-out and blue-ocean source. For this property they are empty. Tier C of `blue-ocean.md` is
therefore still unpriced, and nothing on it clears a demand gate today.

---

## 2. What was refused, and why

### 2.1 No document, template, or fillable form was produced

`horse bill of sale` is the only equine query with measured demand, and its SERP is entirely
documents. Closing that gap on its own terms means publishing a horse bill of sale. That was
refused for three independent reasons, any one of which is sufficient:

1. **A bill of sale's content is jurisdictional.** Whether it must be notarised, whether a brand
   inspection or transfer certificate is required, whether a Coggins/EIA test result must accompany
   transfer, and what a warranty disclaimer must say to be enforceable, all vary by state. Stating
   any of that without citing the governing statute or an authoritative source, with a link and a
   date, is prohibited by the operating instruction this work was done under — and it is the actual
   harm: a reader relies on it and their transfer fails or their disclaimer does not hold.
2. **The 50-state variant pattern is the exact failure this portfolio already has.** `blue-ocean.md`
   and `fan-out-coverage.md` both establish that 156 of 564 pages here already carry a duplicate
   title *and* h1 while self-canonicalising. Producing 50 state documents from one template with the
   state name swapped would add a second, larger, and legally dangerous mirror layer.
3. **This repository is frozen.** See §3.

### 2.2 No new page and no new draft was created

`data/cadence/policy.json` sets `new_pages_per_week: 0` with the note *"Client repo. Publishing is
client-approved only."* `docs/strategy/publishing-cadence.md` independently requires a measured
query before any new page. The measurement in §1 does not produce one that this site can serve in
the shape the SERP rewards.

`reports/cadence/cadence-gate.json` already warns `library_over_ceiling: 560 pages against a ceiling
of 130`. 430 pages here cannot be kept current at declared refresh capacity. Adding to that number
while it is 4.3× over ceiling makes the maintainable fraction smaller, not the site bigger.

### 2.3 Nothing in `dist/` was touched

`dist/` is published client-approved output under a content freeze.
`dist/editorial-publishing-state.json` reports `live_count: 0` with an empty `live_entries` array,
and all 300 records in `data/admin/editorial_manifest.json` are `status: "pending"` with
`publish_date: null`, `live_slug: null` and `public_url: null`. `dist/insights/` contains only an
`index.html` — no draft is rendered. The boundary is therefore unambiguous: the 564 pages in
`dist/` are published, and the 300 markdown files in `content/drafts/generated/` are unpublished
proposals awaiting client approval. Neither set was modified.

---

## 3. Two defects on published pages that this freeze prevents fixing

Recorded here so they are not lost. **Both are on frozen, client-approved output and were not
touched.** Both need client agreement before repair.

1. **The FAQPage schema on the highest-value bill-of-sale page is malformed.** On
   `dist/faq/what-should-be-included-in-a-horse-bill-of-sale/`, three of four FAQ answers share one
   identical boilerplate string, one "question" is a truncated fragment
   (*"Should Be Included in a Horse Bill of Sale"*), and another is grammatically broken. This is
   emitted as structured data on **346 files**. Malformed FAQ entities are worse than absent ones:
   they are what an answer engine extracts.
2. **The `/reference/` mirror layer self-competes on the same query.** 263 of 564 pages (47%) sit
   under `/reference/`, and 78 of them duplicate a topic page's title *and* h1 while canonicalising
   to themselves. For the bill-of-sale question specifically, `dist/faq/…` and
   `dist/reference/what-should-be-included-in-a-horse-bill-of-sale/` are two URLs asking the engine
   to choose. The `/reference/` twin is the thinner one.

Fixing (2) is the highest benefit-to-effort change available on this property and requires no new
content at all.

---

## 4. What a lawyer must review before any equine document ships

If the client wants to close the document gap — and the measurement says that is the only way to
contest the one query with demand — the following must be settled by a licensed attorney **before**
any artifact is drafted. This is the scope of work, not a draft of it.

### 4.1 Threshold questions

1. **Who is the publisher of record, and in which states is the reviewing attorney licensed?**
   `dist/` already routes to a named firm. A document published under a legal-information site's
   name is a different exposure from an explainer, and unauthorised-practice-of-law rules differ by
   state.
2. **Is the artifact a form or a checklist?** A checklist of what a bill of sale should address
   carries materially less risk than a fillable instrument, and — per the SERP in §1 — will not win
   the query. The client must choose knowingly between the two, not have the choice made for them
   by a content programme.
3. **What is the malpractice/E&O position** on a downloadable instrument distributed at scale to
   unidentified users in unknown jurisdictions?

### 4.2 Per-state legal questions that must each carry a citation

No state-specific assertion may ship without the governing statute or an authoritative state agency
source, quoted, linked, and dated. For each state the client wants to cover:

1. **Notarisation.** Is a notarised signature required, permitted, or irrelevant for a private
   transfer of a horse? Cite the statute.
2. **Equine Activity Liability Act.** Does the state have one; what is its citation; what is the
   *exact* statutory warning language; where must it be posted and in what type size; and must it
   appear in contracts as well as on signage? The existing pages
   `dist/liability/does-my-contract-need-statutory-warning-language/` and
   `dist/liability/what-happens-if-i-do-not-post-the-required-sign/` make claims in this area and
   should be re-checked against the statute during the same review.
3. **Health and movement paperwork.** Certificate of veterinary inspection and EIA/Coggins
   requirements for sale and for interstate movement — state agriculture department source, with
   the date checked.
4. **Brand inspection / transfer certificate.** Required in some western states for change of
   ownership; identify which, with the citing authority.
5. **Sales tax on a private horse sale**, and any agricultural exemption.
6. **UCC Article 2 application and "as is" disclaimers.** Whether a horse is "goods", and what
   language is required for a warranty disclaimer to be conspicuous and enforceable in that state.
7. **Agister's / stablemen's lien** — the statutory basis for the claim already made on
   `dist/boarding/can-a-boarding-barn-sell-a-horse-for-unpaid-bills/`, per state.

### 4.3 Mandatory conditions on any artifact that does ship

1. A prominent, above-the-fold notice — not only the existing footer line — stating that the
   document is not legal advice, creates no attorney-client relationship, and that requirements vary
   by state.
2. A named reviewing attorney, their bar jurisdiction, and a review date on the artifact itself.
3. A stated review cadence, and an owner. A stale legal form is worse than none.
4. **No state variant may be generated by substitution.** A state version exists only where §4.2 has
   been answered for that state with citations. If that yields three states, the artifact covers
   three states and says so.
5. Every jurisdictional claim carries its statute citation, link, and the date it was checked,
   visible on the page.

---

## 5. Recommendation

**Do not build equine pages. Repair the ones that exist, once the client lifts the freeze.**

In priority order:

1. Resolve the 78 `/reference/` duplicate pairs — canonicalise the twin to its topic page or delete
   it. 156 pages, one mechanical change, no new content, removes 27.7% of the site's
   self-competition.
2. Fix the FAQPage boilerplate emitted on 346 files, starting with the bill-of-sale page.
3. Commission the §4 legal review as a discrete, scoped engagement. Only after it returns does the
   question of a document become answerable.
4. Re-run the §1 Bing seeds after (1) and (2) land. The Question and Newly-discovered tabs are empty
   at this property's current visibility; they may not stay empty once the mirror layer stops
   splitting the site's own signal.

Reviewed: 2026-08-26.

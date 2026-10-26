# horse-legal-guide-velocity

Equine-law citation-velocity site for **horselegalguide.com**. It publishes educational
equine-law pages that route real matters to the canonical firm site, Wise Covington PLLC.

Repo authority and the terminal entry points live in [`AGENTS.md`](AGENTS.md). Operating
procedure is in [`RUNBOOK.md`](RUNBOOK.md). Read both before changing anything here.

## Nothing paid

**Nothing paid.** No model call in this repository may cost money. Owner policy, 11 Oct 2026:
*"nothing should be paid … cut the probes and make them free."*

- Every model request goes through `scripts/llm/free_router.js` / `.py`, the only code allowed to
  call a model. It sends `provider.max_price = 0`, reads `usage.cost` back, and throws
  `FREE_ROUTER_COST_VIOLATION` on any non-zero cost.
- `config/llm_routing.json` pins an ordered $0/$0 model list with a committed pricing snapshot,
  `policy.max_cost_usd: 0` and `paid_fallback: false`.
- The one paid lane, `paid-citation-probe.yml`, has no schedule and refuses with
  `NAMED_STOP: PAID_PROBE_DISABLED_BY_OWNER_POLICY` unless `confirm_paid` is passed by hand.
- A missing or dead key is a named stop that exits 0, never a paid fallback.

The full accounting of what was paid, what it costs now and how free is enforced is in
[`docs/cost/zero-paid-llm.md`](docs/cost/zero-paid-llm.md).

**This is not a wish: `npm run validate:zero-paid-llm` reads this file.** It fails red if the
policy heading and assertion above are weakened or removed, if
`docs/cost/zero-paid-llm.md` goes missing, or if any script, config or workflow drifts off the
free router.

## Nothing waits on the owner

A finding becomes an action with a measurement and an automatic fallback, never a question and
never a "waiting on the owner" stop. Make the call from the data, ship it, log why, measure, and
switch if the measurement says so. The only thing that may stop is a secret or an account the
owner alone holds, and that stops as a **named stop** a human can read — green and
self-explaining, never a silent exit and never a red `main`.

## Before you push

Run the repo's own gates, in one batch:

```bash
npm run build && npm run validate:seo-aeo-geo && npm run validate:seo-hygiene && npm test
```

`npm run validate:all` is the full gate the CI workflow runs. Rule 0 applies to every stage here:
no validator may exit 0 having examined nothing — each one hard-fails on zero items.

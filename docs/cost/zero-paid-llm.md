# Zero paid LLM calls

Owner instruction, 11 Oct 2026: "nothing should be paid … cut the probes and make them free."

## What was paid, and what it is now

| Call site | Ran | Model / provider | What it did | Now |
|---|---|---|---|---|
| `scripts/llm_citation_probe.mjs` in `agency-search-monitor.yml` | daily 14:17 UTC | OpenRouter (grounded/web) | asked 25 queries, checked whether answers cite us | **Off.** Probe lane: `paid-citation-probe.yml`, dispatch only, `confirm_paid` |
| `scripts/search/live_query_observer.js` via `npm run search:cycle` (`agency-search-monitor.yml`, `query-intelligence.yml`) | daily + on dispatch | OpenRouter web plugin on `openai/gpt-4o-mini`, then Gemini grounding | watched which sources search answers cite for 30 panel queries | **Off.** Records `DISABLED_BY_OWNER_POLICY` (healthy named stop); runs only in `paid-citation-probe.yml` |
| `scripts/queries/score_discovery_gap.mjs` | daily | none (scores probe output) | scored the probe's window | moved with the probe, so it never scores a stale window |
| `scripts/community/adapters/google_paa_adapter.js` in `public-signal-processing.yml` | weekdays 13:30 UTC | Gemini `gemini-flash-lite-latest` with Google Search grounding | People-Also-Ask-style demand questions | **Free.** $0 models via the free router; rows are labelled `free_model_suggested_query_demand`, not live grounded |

Validators that expected observations: `validate_discovery_gap.js` was brittle (it required the scorer and probe in the scheduled monitor) and was rewritten to follow them into the probe lane, now also requiring the probe to run before the scorer. `validate_live_query_loop.js` was strengthened: it now also requires the observer's owner-policy gate and a healthy blackout report for it.

## How free is enforced

- `config/llm_routing.json`: ordered $0/$0 model list, pricing snapshot (fetched 2026-10-11 from the unauthenticated `https://openrouter.ai/api/v1/models`), `policy.max_cost_usd: 0`, `paid_fallback: false`.
- `scripts/llm/free_router.*`: the only code allowed to call a model. Every request carries `provider.max_price = 0` (OpenRouter refuses paid endpoints), `usage.cost` is read back and a non-zero cost throws `FREE_ROUTER_COST_VIOLATION` (the run fails). Every call prints `FREE_LLM_RECEIPT {...}` with `outcome`, `model`, `cost_usd`, `key_label` and `key_info` (label, limit, usage, is_free_tier, limit_remaining from `GET /api/v1/auth/key`; never the key).
- Named stops, exit 0: `FREE_ROUTER_NO_KEY`, `OPENROUTER_KEY_DISABLED_OR_INVALID` ("OpenRouter key disabled or invalid; free routing needs an enabled key with a $0 limit"), `NO_FREE_MODEL_ANSWERED`. There is no paid fallback.
- Paid probe lanes call `paidProbeGate()` and stop with `PAID_PROBE_DISABLED_BY_OWNER_POLICY` unless `CONFIRM_PAID=true`, which only `.github/workflows/paid-citation-probe.yml` sets, and only when dispatched with `confirm_paid: true` (default false). That workflow has no schedule.
- Guard: `validate_zero_paid_llm.js` (registered in the repo validation chain). It fails on a non-$0 model or undated snapshot, any script calling a provider outside the router, a probe lane with a schedule or without `confirm_paid`, a scheduled workflow passing a non-router model key or naming a paid model, or `OPENROUTER_API_KEY` given to a step that runs no registered free-router consumer. Each check was proven to fail once against a mutated copy.

## Free models (ordered fallback)

1. `nvidia/nemotron-3-ultra-550b-a55b:free` (1M ctx)
2. `nvidia/nemotron-3-super-120b-a12b:free` (262k ctx)
3. `google/gemma-4-31b-it:free` (262k ctx)
4. `openrouter/free` ($0-only meta-router, last resort)


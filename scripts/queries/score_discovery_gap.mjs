#!/usr/bin/env node
/**
 * Close the discovery gap: score the evidence file by something that was
 * actually observed, rather than leaving 62 measured queries unranked for the
 * only two things that decide whether a page is worth writing.
 *
 * The gap
 * -------
 * `scripts/queries/ingest_gsc_evidence.py` did its job: all 60 queries Search
 * Console reports for this property are in `data/queries/evidence/evidence_queries.json`,
 * tiered T1 with a correctly-named `impressions_90d`. What none of them carried
 * was any read on whether the query is winnable, or on whether the searcher is
 * anywhere near submitting a form. So the atlas could rank by demand and nothing
 * else, and `data/queries/query_universe.json` (129 page targets) had no measured
 * signal to prioritise against at all.
 *
 * What this adds
 * --------------
 *   OPENNESS. `scripts/llm_citation_probe.mjs` in grounded mode asks an answer
 *   engine a real question and reads back the hosts the answer was built from.
 *   Which hosts occupy an answer is a measurement. A query whose answer is
 *   assembled out of forum threads is winnable by a real page; one assembled out
 *   of .gov or an established legal publisher is not.
 *
 *   LEAD INTENT. The vertical is lead-gen - the page earns nothing until someone
 *   submits the form - so every row is tiered by how close the searcher is to
 *   doing that.
 *
 * What it does not add
 * --------------------
 * No search volume. There is no live paid keyword source on this account, and a
 * modelled figure would be indistinguishable in the file from the Semrush-measured
 * ones already in it. Rows are scored on openness and intent, not on a number
 * nobody measured.
 *
 * `data/queries/evidence/bing_keyword_research_2026-08-26.json` is NOT merged.
 * Those rows are T2a and their unit is Bing Webmaster impressions - a third unit,
 * and neither `search_volume` nor `impressions_90d`. A T2a row with
 * `demand_basis: "none"` is refused by `scripts/atlas/validate_query_atlas.mjs`,
 * correctly: that validator only permits absent demand on T3. The file stays
 * separate, exactly as its own note asks, until someone decides what unit it
 * should be joined on. That is a decision, not a code change.
 *
 * Usage
 * -----
 *   npm run queries:discovery-gap
 *
 * Wired into .github/workflows/agency-search-monitor.yml, immediately after the
 * grounded citation probe that produces the observations it reads. Guarded by
 * _ops/validators/validate_discovery_gap.js (npm run validate:discovery-gap).
 *
 * Run it, run the grounded probe, run it again: the first pass is a no-op on an
 * unprobed row, the second attaches what the probe observed. A row the probe has
 * not reached is `UNMEASURED`, never a zero.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (p, fb) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return fb; } };
const write = (p, v) => { fs.mkdirSync(path.join(ROOT, path.dirname(p)), { recursive: true }); fs.writeFileSync(path.join(ROOT, p), JSON.stringify(v, null, 2) + '\n'); };

const EVIDENCE = 'data/queries/evidence/evidence_queries.json';
const GSC = 'data/agency/gsc_snapshot.json';
const OBSERVATIONS = 'data/signals/llm_citation_observations.json';

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- lead intent
//
// Word boundaries throughout. `\bfee` alone matches "feel"; `\bfees?\b` does not.
// Every pattern was checked against the actual query list rather than assumed.
const T1_LOCAL_READY = [
  /\bnear me\b/,
  /\bopen now\b/,
  /\bin[- ]network\b/,
  /\bin [a-z]+(?: [a-z]+)?,? (?:al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b/,
];
const T2_COST_IN_MARKET = [
  /\bhow much\b/, /\bcosts?\b/, /\bprice(?:s|d|ing)?\b/, /\bfees?\b/,
  /\bdoes insurance cover\b/, /\bcovered by insurance\b/, /\bworth it\b/,
  /\bout of pocket\b/, /\bcheap(?:est|er)?\b/, /\baffordable\b/,
];
const T3_SELECTION = [
  /\bhow to (?:choose|compare|find|pick|select)\b/, /\bred flags?\b/, /\bvs\.?\b/,
  /\bversus\b/, /\bwhich is better\b/, /\bwhat to ask\b/, /\bquestions to ask\b/,
  /\bcompare\b/, /\bdifference between\b/, /\bbest\b/,
];

function leadIntentTier(query) {
  const q = norm(query);
  if (T1_LOCAL_READY.some((re) => re.test(q))) return 'T1_LOCAL_READY';
  if (T2_COST_IN_MARKET.some((re) => re.test(q))) return 'T2_COST_IN_MARKET';
  if (T3_SELECTION.some((re) => re.test(q))) return 'T3_SELECTION';
  return 'T4_INFORMATIONAL';
}

// -------------------------------------------------------------------- openness
//
// Computed only from hosts an answer engine actually cited. The two host lists
// are definitional, not estimates: membership is a property of the host, decided
// once and written down, so the same observation always scores the same.
const PLATFORM_HOSTS = new Set([
  'reddit.com', 'quora.com', 'youtube.com', 'facebook.com', 'instagram.com',
  'tiktok.com', 'pinterest.com', 'linkedin.com', 'medium.com', 'x.com',
  'twitter.com', 'yelp.com', 'wikihow.com', 'answers.com', 'tripadvisor.com',
  'nextdoor.com', 'stackexchange.com', 'stackoverflow.com', 'substack.com',
]);
const isPlatform = (h) => PLATFORM_HOSTS.has(h) || [...PLATFORM_HOSTS].some((p) => h.endsWith(`.${p}`));
const isInstitutional = (h) => /\.(gov|edu|mil)$/.test(h) || h === 'wikipedia.org' || h.endsWith('.wikipedia.org');

const OPENNESS_METHOD = {
  input: 'cited_hosts from a grounded run of scripts/llm_citation_probe.mjs (OpenRouter web plugin, engine=parallel, mode=turbo)',
  formula: 'openness_score = clamp(0.5 + 0.5*platform_share - 0.5*institutional_share, 0, 1)',
  platform_share: 'share of distinct cited hosts that are user-generated or aggregator platforms',
  institutional_share: 'share of distinct cited hosts on .gov/.edu/.mil or wikipedia',
  verdicts: {
    HELD_BY_US: 'the engine already cited one of our own domains - not an opportunity, a position to defend',
    OPEN: 'openness_score >= 0.6 - the answer is assembled from platforms and no authoritative page owns it',
    CONTESTED: '0.4 <= openness_score < 0.6',
    HELD: 'openness_score < 0.4 - institutions or established publishers occupy the answer',
    UNMEASURED: 'the probe has not answered for this query; NOT a zero and never to be read as one',
  },
  not_measured: 'search volume, keyword difficulty, organic rank. None are inferable from a citation observation and none are written.',
};

function occupancyFor(query, observationsByQuery, prior) {
  const obs = observationsByQuery.get(norm(query));
  // `data/signals/llm_citation_observations.json` is a ROLLING record: the probe
  // caps itself at 25 queries per run (`--limit 25` in
  // .github/workflows/agency-search-monitor.yml, LIMIT default 25 in
  // scripts/llm_citation_probe.mjs) and this script reads only the newest
  // grounded run. So a query measured last week is simply not in this week's
  // run. Overwriting a real measurement with UNMEASURED because the window
  // rolled past it destroys the only openness reading this repo has - replaying
  // one real 25-observation run over the 62 scored rows wiped 37 of them.
  // A measurement that has aged is carried forward and marked stale, never
  // downgraded to "we never looked".
  const carry = (reason) => (prior && prior.reason === 'GROUNDED_CITATION_OBSERVATION')
    ? { ...prior, stale: true, stale_reason: reason }
    : { verdict: 'UNMEASURED', reason, openness_score: null, cited_hosts: [], observed_at: (obs && obs.observed_at) || null, engine: (obs && obs.engine) || null };
  if (!obs) return carry('NO_GROUNDED_OBSERVATION_IN_CURRENT_WINDOW');
  // A FAILED observation is not evidence that the earlier successful one was
  // wrong. Keep the reading, mark it stale.
  if (obs.status !== 'observed') return carry('PROVIDER_ERROR');
  const hosts = [...new Set(obs.cited_domains || [])];
  const ours = obs.cited_ours || [];
  if (!hosts.length) return carry('PROVIDER_ANSWERED_WITHOUT_RETRIEVING');
  const platform = hosts.filter(isPlatform).length / hosts.length;
  const institutional = hosts.filter(isInstitutional).length / hosts.length;
  const score = Math.max(0, Math.min(1, 0.5 + 0.5 * platform - 0.5 * institutional));
  const verdict = ours.length ? 'HELD_BY_US' : score >= 0.6 ? 'OPEN' : score >= 0.4 ? 'CONTESTED' : 'HELD';
  return {
    verdict, reason: 'GROUNDED_CITATION_OBSERVATION',
    openness_score: Number(score.toFixed(3)),
    platform_share: Number(platform.toFixed(3)),
    institutional_share: Number(institutional.toFixed(3)),
    distinct_cited_hosts: hosts.length,
    cited_hosts: hosts, cited_ours: ours,
    observed_at: obs.observed_at, engine: obs.engine,
    stale: false,
  };
}

// -------------------------------------------------------- blue-ocean gate
//
// "Not cited" is NOT the same as "open ground". An openness_score is a statement
// about WHO the engine cited, not about whether those citations were about this
// query in this vertical. Queries carrying no equine anchor give the engine
// nothing to anchor retrieval to and it answers from whatever is nearest:
// "standard training agreement" came back as Australian horse-racing registry
// and Ontario government forms and the UK institute of chartered accountants;
// "guides and instructors insurance" came back as British Cycling and a UK
// mountain-training body. Scoring that noise as openness and calling the query
// OPEN is a false blue-ocean signal.
//
// This gate is ADDITIVE. It rewrites no verdict already in the evidence file; it
// records, per row, whether the openness reading describes ground this property
// can actually contest.
const EQUINE_ANCHOR = /\b(horses?|equine|equestrian|stables?|barns?|boarding|riding|riders?|farriers?|vet|veterinary|usef|ushja|fei|pony|ponies|foals?|mares?|stallions?|geldings?|breeding|dressage|eventing|jumper|showing|racing)\b/;
const LOCATION_ANCHOR = /\b(near me|wellington|ocala|aiken|lexington|florida|fl|kentucky|ky|north carolina|nc|south carolina|sc|virginia|va|texas|tx|california|ca|local|in my state|by state)\b/;
const BRAND_TOKEN = /\bhorse ?legal ?guide\b/;

function blueOceanEligibility(row) {
  const q = norm(row && row.query);
  if (!q) return { eligible: false, reason: 'EMPTY_QUERY' };
  if (BRAND_TOKEN.test(q)) {
    return { eligible: false, reason: 'BRAND_OR_PERSON_NAME_NAVIGATIONAL', note: 'Navigational query for this property\'s own name. Whoever the engine cites for it is not competitive ground.' };
  }
  if (!EQUINE_ANCHOR.test(q) && !LOCATION_ANCHOR.test(q)) {
    return { eligible: false, reason: 'NO_SERVICE_OR_LOCATION_ANCHOR', note: 'No equine or location term, so the engine has nothing to anchor retrieval to and its citation set does not describe this property\'s competitive ground.' };
  }
  const verdict = row && row.occupancy && row.occupancy.verdict;
  if (verdict === 'HELD_BY_US') return { eligible: false, reason: 'ALREADY_HELD_BY_US' };
  return { eligible: true, reason: verdict === 'OPEN' ? 'OPEN_WITH_ANCHORED_OBSERVATION' : (verdict || 'UNMEASURED') };
}

// ------------------------------------------------------------------ the merge
const before = JSON.stringify(read(EVIDENCE, null));
const doc = read(EVIDENCE, null);
if (!doc) { console.error(`score_discovery_gap: missing ${EVIDENCE}`); process.exit(1); }
const byQuery = new Map((doc.queries || []).map((q) => [norm(q.query), q]));

// Search Console phrasing this repo has not ingested yet. Normally zero, because
// scripts/queries/ingest_gsc_evidence.py already runs on cadence; the join is
// here so a snapshot that arrives between ingests is not silently dropped.
const gsc = read(GSC, {});
const gscUsable = gsc.status === 'ok';
let added = 0;
if (gscUsable) {
  const impressions = new Map();
  for (const r of [...(gsc.top_queries || []), ...(gsc.query_page || [])]) {
    const term = String(r.keys?.[0] || '').trim();
    if (!term) continue;
    const key = norm(term);
    const prior = impressions.get(key) || { query: term, impressions: 0, clicks: 0 };
    // top_queries and query_page report the same impressions at different
    // granularity. Take the maximum rather than the sum, which would double-count.
    prior.impressions = Math.max(prior.impressions, Number(r.impressions || 0));
    prior.clicks = Math.max(prior.clicks, Number(r.clicks || 0));
    impressions.set(key, prior);
  }
  const range = gsc.date_range || {};
  for (const [key, row] of impressions) {
    if (byQuery.has(key)) continue;
    byQuery.set(key, {
      query: row.query,
      evidence_tier: 'T1',
      source_type: 'gsc_search_analytics',
      impressions: row.impressions,
      clicks: row.clicks,
      target_domain: 'horselegalguide.com',
      measured_window_days: 90,
      measured_start: range.start_date || range.startDate || null,
      measured_end: range.end_date || range.endDate || null,
      keyword_difficulty: null,
      weak_incumbent_score: null,
      intent_method: 'not_derived',
      serp_features: [],
      vertical: 'equine',
      cpc_usd: null,
      paid_competition: null,
      competitor_ranking_url: 'NO_DATA',
      // No keyword tool was consulted, so there is no market volume. Impressions
      // are this domain's own demand and live under their own name.
      search_volume: null,
      impressions_90d: row.impressions,
      demand_basis: 'impressions_90d',
      volume_sources: {},
      volume_conflict: false,
      discovery_pass: 'discovery-gap-2026-08',
    });
    added++;
  }
}

// ----------------------------------------------------------------- the scoring
const observations = read(OBSERVATIONS, { runs: [] });
const grounded = (observations.runs || []).filter((r) => r.mode === 'grounded');
const latest = grounded[grounded.length - 1] || null;
const observationsByQuery = new Map();
for (const o of latest?.observations || []) observationsByQuery.set(norm(o.query), o);

let scored = 0;
for (const row of byQuery.values()) {
  row.lead_intent_tier = leadIntentTier(row.query);
  row.lead_intent_method = 'regex_classifier_on_query_string, scripts/queries/score_discovery_gap.mjs';
  row.occupancy = occupancyFor(row.query, observationsByQuery, row.occupancy);
  if (row.occupancy.openness_score !== null) scored++;
  row.blue_ocean_eligible = blueOceanEligibility(row);
}

// Sort within unit, never across it - the same rule ingest_gsc_evidence.py applies.
doc.queries = [...byQuery.values()].sort((a, b) => (
  (a.search_volume !== null ? 0 : 1) - (b.search_volume !== null ? 0 : 1)
  || -((a.search_volume || a.impressions_90d || 0) - (b.search_volume || b.impressions_90d || 0))
  || a.query.localeCompare(b.query)
));

doc.discovery_gap_pass = {
  at: new Date().toISOString(),
  by: 'scripts/queries/score_discovery_gap.mjs',
  why: '62 measured queries carried demand and nothing else. Demand says how many people ask; it does not say whether the answer is winnable or whether the asker is near a form. Both of those are now recorded.',
  expansion_sources: [`${GSC} (live Search Console snapshot) - joined for phrasing not yet ingested`],
  refused_sources: [
    'data/queries/evidence/bing_keyword_research_2026-08-26.json - T2a in a third unit (Bing Webmaster impressions). A T2a row with demand_basis "none" is refused by scripts/atlas/validate_query_atlas.mjs, correctly. Left separate pending a deliberate unit decision, as its own note asks.',
    'data/queries/query_universe.json - page targets derived from existing content, not observed phrasing. Not evidence.',
    'any modelled or estimated search volume - no live paid keyword source exists on this account.',
  ],
  lead_intent_classifier: {
    T1_LOCAL_READY: 'near me / open now / in <City ST> / in-network',
    T2_COST_IN_MARKET: 'how much / cost / price / fee / does insurance cover / worth it / out of pocket',
    T3_SELECTION: 'how to choose|compare|find / red flags / vs / difference between / which is better / what to ask / best',
    T4_INFORMATIONAL: 'everything else - definitions, lists, process explanations',
    note: 'Word-boundary anchored. `\\bfees?\\b` deliberately does not match "feel".',
  },
  openness_method: OPENNESS_METHOD,
  rolling_window_policy: {
    source: OBSERVATIONS,
    why: 'The probe caps itself at 25 queries per run and only the newest grounded run is read, so most scored rows have no observation in any given window. A row whose observation has rolled out keeps its last reading with stale:true and a stale_reason; it is never downgraded to UNMEASURED, which would read as "we never looked".',
    stale_reasons: {
      NO_GROUNDED_OBSERVATION_IN_CURRENT_WINDOW: 'measured before, not in the newest grounded run',
      PROVIDER_ERROR: 'the newest run reached the provider and failed; the earlier reading stands',
      PROVIDER_ANSWERED_WITHOUT_RETRIEVING: 'the newest run answered from model memory with no citations; the earlier reading stands',
    },
  },
  blue_ocean_gate: {
    by: 'blueOceanEligibility in this script, written to queries[].blue_ocean_eligible',
    why: 'An openness reading is a statement about WHO the engine cited, not about whether those citations were about this query in this vertical. Queries with no equine or location anchor return whatever is nearest - Australian racing registries, UK cycling bodies, contractor insurance SaaS - and treating that as open ground is a false blue-ocean signal. The gate is additive: it rewrites no occupancy verdict.',
    refusal_reasons: ['BRAND_OR_PERSON_NAME_NAVIGATIONAL', 'NO_SERVICE_OR_LOCATION_ANCHOR', 'ALREADY_HELD_BY_US', 'EMPTY_QUERY'],
  },
  counts: {
    total_queries: doc.queries.length,
    added_this_pass: added,
    with_openness_reading: scored,
    carried_forward_stale: doc.queries.filter((q) => q.occupancy && q.occupancy.stale).length,
    blue_ocean_eligible: doc.queries.filter((q) => q.blue_ocean_eligible && q.blue_ocean_eligible.eligible).length,
    blue_ocean_refused: doc.queries.filter((q) => q.blue_ocean_eligible && !q.blue_ocean_eligible.eligible).length,
  },
};

// Build determinism: the pass timestamp is the only field that moves on a no-op
// run. Bumping it on every run would make a scheduled job commit a diff that
// says nothing changed. Keep the previous timestamp when nothing else moved.
const priorAt = (() => { try { return JSON.parse(before).discovery_gap_pass?.at || null; } catch { return null; } })();
if (priorAt) {
  const a = JSON.parse(before); const b = JSON.parse(JSON.stringify(doc));
  if (a.discovery_gap_pass) a.discovery_gap_pass.at = null;
  if (b.discovery_gap_pass) b.discovery_gap_pass.at = null;
  if (JSON.stringify(a) === JSON.stringify(b)) doc.discovery_gap_pass.at = priorAt;
}
write(EVIDENCE, doc);

const tiers = {}; const verdicts = {};
for (const q of doc.queries) {
  tiers[q.lead_intent_tier] = (tiers[q.lead_intent_tier] || 0) + 1;
  verdicts[q.occupancy.verdict] = (verdicts[q.occupancy.verdict] || 0) + 1;
}
console.log(`[discovery-gap] ${doc.queries.length} evidence queries (+${added} this pass), ${scored} with an openness reading.`);
console.log(`  lead intent: ${Object.entries(tiers).sort().map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`  occupancy:   ${Object.entries(verdicts).sort().map(([k, v]) => `${k}=${v}`).join(' ')}`);
const stale = doc.queries.filter((q) => q.occupancy && q.occupancy.stale).length;
const refused = doc.queries.filter((q) => q.blue_ocean_eligible && !q.blue_ocean_eligible.eligible).length;
console.log(`  carried forward stale: ${stale} (readings kept, not overwritten with UNMEASURED)`);
console.log(`  blue-ocean refused:    ${refused} (openness read from citations that do not describe this property's ground)`);

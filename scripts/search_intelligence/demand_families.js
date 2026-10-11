'use strict';
/**
 * Demand families: the strengthening selection rule, in one place.
 *
 * Pattern copied from local-guides-generator scripts/search_intelligence/
 * demand_families.js (impressions-weighted rule), adapted to this site's routes.
 * Read by build_loop.js (writes demand_families.json) and by
 * _ops/validators/validate_search_intelligence.js, which recomputes the families
 * from the committed export and fails on any drift, so the rule cannot differ
 * between the writer and the check.
 *
 * A family is (intent, landing page): rows of the 28-day Search Console export
 * (query x page) whose intent (demand_intents.json) is the same and that land on
 * the same page.
 *
 * A family qualifies for strengthening when
 *   (a) a page in it has >= 2 impressions at average position <= 15 (page-level
 *       rows of the same export: pages that already rank), OR
 *   (b) it is one of the site's top 5 families by 28-day impressions and its
 *       impression-weighted position is <= 95 (pages Google already tests for
 *       real demand).
 * A qualifying family is strengthened on its landing page only when the page's
 * intent matches the family's intent and the page is a single-answer page (home,
 * topic hub or leaf page; section indexes are lists, not answers). Everything
 * else records the reason.
 */
const { FILES, readJson, norm, round1, routeOf } = require('./lib');

const RULE = Object.freeze({ top_n: 5, max_weighted_position: 95, ranking_position: 15, ranking_min_impressions: 2, pending_max_days: 7 });
const INDEX_ROUTES = new Set(['/insights/', '/articles/', '/faq/', '/compare/', '/reference/', '/hubs/', '/authority/', '/coverage/', '/scenario/', '/whitepapers/', '/templates/']);

function loadIntents(lexicon = readJson(FILES.intents, null)) {
  if (!lexicon || !Array.isArray(lexicon.intents) || !lexicon.intents.length) throw new Error(`${FILES.intents}: intents[] is required`);
  return { siteHead: lexicon.site_head_intent, intents: lexicon.intents.map((i) => ({ ...i, re: new RegExp(i.pattern) })) };
}
function classify(text, lex) {
  const t = norm(text);
  const hit = lex.intents.find((i) => i.re.test(t));
  return hit ? hit.intent : null;
}
function pageKind(route) {
  if (route === '/') return 'home';
  if (INDEX_ROUTES.has(route) || /^\/(insights|articles|whitepapers|templates|authority)\/\d{4}-\d{2}-\d{2}\/$/.test(route)) return 'index';
  if (/^\/hubs\/[^/]+\/$/.test(route)) return 'hub';
  if (/^\/(disclaimer|privacy-policy)\/$/.test(route)) return 'policy';
  return 'page';
}
function pageIntent(route, lex) {
  const kind = pageKind(route);
  if (kind === 'home') return lex.siteHead;
  if (kind === 'index' || kind === 'policy') return kind;
  return classify(route.replace(/[-/]/g, ' '), lex) || `topic:${route.split('/')[1]}`;
}

/**
 * Deterministic: same export + same strengthening ledger = same families.
 * ledger: { pages: [{ route, family, strengthened_on }] } ; today: YYYY-MM-DD
 */
function computeFamilies(exp, ledger, lex, today) {
  const byPage = new Map((exp.by_page || []).map((r) => [routeOf(r.keys[0]), r]));
  const strengthened = new Map((ledger && ledger.pages || []).map((p) => [p.route, p]));
  const pending = new Map((ledger && ledger.pending || []).map((p) => [p.family, p]));
  const fams = new Map();
  for (const r of exp.by_query_page || []) {
    if (!(r.impressions > 0)) continue;
    const route = routeOf(r.keys[1]);
    const pIntent = pageIntent(route, lex);
    const intent = classify(r.keys[0], lex) || pIntent;
    const key = `${intent} ${route}`;
    if (!fams.has(key)) fams.set(key, { intent, page: route, page_kind: pageKind(route), page_intent: pIntent, rows: [] });
    fams.get(key).rows.push({ query: r.keys[0], impressions: r.impressions, clicks: r.clicks, position: round1(r.position) });
  }
  const head = (intent) => (lex.intents.find((i) => i.intent === intent) || {}).head_term || intent;
  const list = [...fams.values()].map((f) => {
    const impressions = f.rows.reduce((a, r) => a + r.impressions, 0);
    const weighted = round1(f.rows.reduce((a, r) => a + r.impressions * r.position, 0) / impressions);
    const queries = f.rows.slice().sort((a, b) => b.impressions - a.impressions || a.position - b.position || a.query.localeCompare(b.query));
    const pr = byPage.get(f.page);
    return {
      family: `${head(f.intent)} @ ${f.page}`, intent: f.intent, head_term: head(f.intent), page: f.page, page_kind: f.page_kind, page_intent: f.page_intent,
      impressions, clicks: f.rows.reduce((a, r) => a + r.clicks, 0), weighted_position: weighted, best_position: Math.min(...f.rows.map((r) => r.position)),
      page_impressions: pr ? pr.impressions : 0, page_position: pr ? round1(pr.position) : null,
      top_query: queries[0].query, query_count: queries.length, queries
    };
  }).sort((a, b) => b.impressions - a.impressions || a.weighted_position - b.weighted_position || a.family.localeCompare(b.family));

  list.forEach((f, i) => {
    f.rank = i + 1;
    const ranking = f.page_impressions >= RULE.ranking_min_impressions && f.page_position != null && f.page_position <= RULE.ranking_position;
    const demand = f.rank <= RULE.top_n && f.weighted_position <= RULE.max_weighted_position;
    f.basis = [ranking && 'ranking_page', demand && 'top_demand'].filter(Boolean);
    f.qualifies = f.basis.length > 0;
    if (!f.qualifies) {
      f.status = 'not_qualified';
      f.reason = f.rank > RULE.top_n
        ? `rank ${f.rank} of ${list.length} by impressions; landing page at ${f.page_position ?? 'no'} position with ${f.page_impressions} page impressions (needs <= ${RULE.ranking_position} with >= ${RULE.ranking_min_impressions})`
        : `weighted position ${f.weighted_position} > ${RULE.max_weighted_position}`;
      return;
    }
    if (f.page_kind === 'index' || f.page_kind === 'policy') {
      f.status = 'no_answer_page'; f.reason = `lands on ${f.page}, a ${f.page_kind} page that lists other pages; no single-answer page there serves "${f.head_term}"`; return;
    }
    if (f.intent !== f.page_intent) {
      f.status = 'intent_mismatch'; f.reason = `query intent ${f.intent} vs page intent ${f.page_intent}; strengthening ${f.page} for it would blur the page. A new page for it is a content-lane decision (the query is now measured, so the publishing freeze lets it through).`; return;
    }
    const done = strengthened.get(f.page);
    if (done && (done.families || []).includes(f.family)) { f.status = 'strengthened'; f.reason = `${FILES.strengthening} entry for ${f.page}, applied at build`; f.strengthened_on = done.strengthened_on; return; }
    const since = (pending.get(f.family) || {}).qualified_on || today;
    const age = Math.round((new Date(today) - new Date(since)) / 86400000);
    f.status = 'pending_strengthening'; f.qualified_on = since;
    f.reason = `qualified on ${since} (${age} day(s) ago); no ${FILES.strengthening} entry yet. Allowed for ${RULE.pending_max_days} days, then the validator fails.`;
  });
  return list;
}

function buildDocument(exp, ledger, lex, today) {
  const families = computeFamilies(exp, ledger, lex, today);
  const count = (s) => families.filter((f) => f.status === s).length;
  return {
    schema_version: '1.0', gsc_window: `${exp.start_date}..${exp.end_date}`, gsc_collected_at: exp.collected_at,
    rule: `A family is (intent from demand_intents.json, landing page) over the 28-day query x page export. It qualifies if (a) its landing page has >= ${RULE.ranking_min_impressions} impressions at position <= ${RULE.ranking_position}, or (b) it is in the top ${RULE.top_n} families by impressions with impression-weighted position <= ${RULE.max_weighted_position}. A qualifying family is strengthened on its landing page when that page is a single-answer page whose intent matches; otherwise the reason is recorded. A qualifying family may sit in pending_strengthening for at most ${RULE.pending_max_days} days.`,
    thresholds: RULE,
    family_count: families.length, qualifying_count: families.filter((f) => f.qualifies).length,
    status_counts: { strengthened: count('strengthened'), pending_strengthening: count('pending_strengthening'), intent_mismatch: count('intent_mismatch'), no_answer_page: count('no_answer_page'), not_qualified: count('not_qualified') },
    top_families: families.filter((f) => f.rank <= RULE.top_n).map((f) => ({ rank: f.rank, family: f.family, impressions: f.impressions, weighted_position: f.weighted_position, status: f.status })),
    families
  };
}

module.exports = { RULE, loadIntents, classify, pageKind, pageIntent, computeFamilies, buildDocument };

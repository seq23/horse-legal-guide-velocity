#!/usr/bin/env node
'use strict';
/**
 * Daily, after the collectors: rebuild everything that is a function of the
 * committed export.
 *   target_query_set.json         measured-only targets (target_query_set.js)
 *   demand_families.json          impressions-weighted families (demand_families.js)
 *   strengthening_ledger.json     what was strengthened when, what is pending since when, what was skipped and why
 *   consolidation_candidates.json thin zero-impression pages and their hub (list only)
 * Exit 1 when the export is missing: a loop with no truth must not look green.
 */
const { FILES, readJson, writeJson, isoDate } = require('./lib');
const { buildTargetQuerySet } = require('./target_query_set');
const { loadIntents, buildDocument } = require('./demand_families');
const { buildConsolidation } = require('./consolidation');

function buildLedger(strengthening, families, prevLedger, today) {
  const prevSkipped = new Map(((prevLedger && prevLedger.skipped) || []).map((s) => [`${s.family}|${s.status}`, s]));
  return {
    schema_version: '1.0', updated_on: today, gsc_window: families.gsc_window,
    rule: 'pages: strengthened pages with the date each was strengthened (from strengthening.json). pending: qualifying families with no strengthening yet and the date each first qualified. skipped: qualifying families that are not strengthened, with the reason and the date first recorded.',
    pages: (strengthening.pages || []).map((p) => ({ route: p.route, families: p.families, strengthened_on: p.strengthened_on, title: p.title, faq_queries: p.faq.map((f) => f.query), facts: p.facts.length })),
    pending: families.families.filter((f) => f.status === 'pending_strengthening').map((f) => ({ family: f.family, page: f.page, qualified_on: f.qualified_on, impressions: f.impressions })),
    skipped: families.families.filter((f) => f.qualifies && f.status !== 'strengthened' && f.status !== 'pending_strengthening').map((f) => ({
      family: f.family, page: f.page, status: f.status, reason: f.reason, impressions: f.impressions, weighted_position: f.weighted_position,
      recorded_on: (prevSkipped.get(`${f.family}|${f.status}`) || {}).recorded_on || today
    }))
  };
}

function main() {
  const exp = readJson(FILES.export, null);
  if (!exp || !exp.by_query_page) { console.error(`search loop: ${FILES.export} is missing; run collect_gsc.js with GSC_SERVICE_ACCOUNT_JSON set.`); return 1; }
  const today = isoDate(new Date());
  const history = readJson(FILES.history, { queries: [] });
  const targets = buildTargetQuerySet(exp, history);
  writeJson(FILES.targets, targets);
  const prevLedger = readJson(FILES.ledger, { pages: [], pending: [] });
  const strengthening = readJson(FILES.strengthening, { pages: [] });
  const ledgerForRule = { pages: (strengthening.pages || []).map((p) => ({ route: p.route, families: p.families, strengthened_on: p.strengthened_on })), pending: prevLedger.pending || [] };
  const families = buildDocument(exp, ledgerForRule, loadIntents(), today);
  writeJson(FILES.families, families);
  writeJson(FILES.ledger, buildLedger(strengthening, families, prevLedger, today));
  const consolidation = buildConsolidation(exp, readJson(FILES.coverage, null));
  writeJson(FILES.consolidation, consolidation);
  console.log(`search loop: ${targets.target_count} targets ${JSON.stringify(targets.targets_by_source)} (${targets.dropped_count} unmeasured dropped); ${families.family_count} families, ${families.qualifying_count} qualifying ${JSON.stringify(families.status_counts)}; ${consolidation.candidate_count} consolidation candidates`);
  for (const p of families.families.filter((f) => f.status === 'pending_strengthening')) console.log(`::warning title=Family awaiting strengthening::${p.family} qualified on ${p.qualified_on}`);
  return 0;
}

module.exports = { buildLedger };
if (require.main === module) process.exitCode = main();

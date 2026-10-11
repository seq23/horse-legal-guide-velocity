'use strict';
/**
 * Publishing freeze: the content lane publishes no NEW page until its query has
 * a measured number (a target in target_query_set.json, which only holds
 * measured queries).
 *
 * Flag: data/system/config.json `search_publishing_freeze` (true = on).
 * Grandfathered: what was live when the freeze was switched on
 * (data/search_intelligence/publish_freeze.json); those pages stay live.
 * Held pages are not lost: every build re-decides, so a held page publishes on
 * the first build after its query gains a measured number. The holds are
 * written to data/search_intelligence/publish_holds.json on every build.
 *
 * Read by BOTH publishers: scripts/build/write_editorial_pages.js (daily
 * editorial lane) and scripts/build/build_site.js (page-target lane).
 * validate_search_intelligence.js proves the flag reaches both.
 */
const { FILES, readJson, writeJson, norm } = require('./lib');

function loadFreeze() {
  const cfg = readJson('data/system/config.json', {});
  const freeze = readJson(FILES.freeze, { grandfathered: {} });
  const targets = readJson(FILES.targets, { targets: [] });
  const measured = new Map((targets.targets || []).map((t) => [t.query_norm, t]));
  return {
    enabled: cfg.search_publishing_freeze === true,
    grandfathered: { editorial: new Set((freeze.grandfathered || {}).editorial || []), page_targets: new Set((freeze.grandfathered || {}).page_targets || []) },
    measured
  };
}

/** lane: 'editorial' | 'page_targets'; id: entry_id or slug; queries: candidate query strings. */
function decide(state, lane, id, queries) {
  if (!state.enabled) return { publish: true, basis: 'freeze_off' };
  if (state.grandfathered[lane] && state.grandfathered[lane].has(id)) return { publish: true, basis: 'grandfathered_live' };
  for (const q of queries.filter(Boolean)) {
    const t = state.measured.get(norm(q));
    if (t) return { publish: true, basis: 'measured', query: q, source: t.source, number: t.number, unit: t.unit };
  }
  return { publish: false, basis: 'held_unmeasured', reason: `no measured number for ${JSON.stringify(queries.filter(Boolean)[0] || id)} in ${FILES.targets}` };
}

function recordHolds(lane, holds) {
  const doc = readJson(FILES.holds, { schema_version: '1.0', lanes: {} });
  doc.lanes = doc.lanes || {};
  doc.lanes[lane] = { held_count: holds.length, held: holds };
  doc.rule = 'Pages the publishing freeze is holding. Each publishes on the first build after its query has a measured number in target_query_set.json.';
  doc.total_held = Object.values(doc.lanes).reduce((a, l) => a + l.held_count, 0);
  writeJson(FILES.holds, doc);
}

module.exports = { loadFreeze, decide, recordHolds };

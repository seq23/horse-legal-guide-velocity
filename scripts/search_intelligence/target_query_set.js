'use strict';
/**
 * Target query set from MEASURED demand only.
 *
 * A target exists only when something measured it, and it carries that source
 * and number:
 *   gsc_export            query row in the 28-day Search Console export (number: impressions, 28d)
 *   gsc_history           query that has left the window (number: last measured 28-day impressions)
 *   gsc_90d_evidence      T1 row in data/queries/evidence/evidence_queries.json (number: impressions over 90d)
 *   semrush_volume        T2b row there (number: modelled monthly searches)
 *   bing_keyword_research seed in data/queries/evidence/bing_keyword_research_*.json (number: Bing impressions)
 * A query measured by several sources is one target; the first source above is
 * its primary and every measurement is listed. Units are never summed.
 * A candidate with no number is DROPPED and listed under `dropped` with the
 * reason (including every page-target query the site wrote for itself that no
 * provider has measured).
 */
const fs = require('fs');
const path = require('path');
const { FILES, ROOT, readJson, norm, round1, routeOf } = require('./lib');

const PRECEDENCE = ['gsc_export', 'gsc_history', 'gsc_90d_evidence', 'semrush_volume', 'bing_keyword_research'];

function buildTargetQuerySet(exp, history, opts = {}) {
  const evidence = opts.evidence || readJson('data/queries/evidence/evidence_queries.json', { queries: [] });
  const bingFiles = opts.bingFiles || fs.readdirSync(path.join(ROOT, 'data/queries/evidence')).filter((f) => /^bing_keyword_research_.*\.json$/.test(f)).sort().map((f) => ({ file: `data/queries/evidence/${f}`, doc: readJson(`data/queries/evidence/${f}`, {}) }));
  const pageTargets = opts.pageTargets || readJson('data/queries/page_targets.json', []);
  const byQuery = new Map();
  const dropped = [];
  const add = (query, m) => {
    const k = norm(query);
    if (!k) return;
    if (!(typeof m.number === 'number' && m.number > 0)) { dropped.push({ query, source: m.source, reason: m.why || 'no positive measured number' }); return; }
    if (!byQuery.has(k)) byQuery.set(k, { query, query_norm: k, measurements: [] });
    byQuery.get(k).measurements.push(m);
  };
  const bestPage = new Map();
  for (const r of exp.by_query_page || []) {
    const k = norm(r.keys[0]);
    if (!bestPage.has(k) || r.impressions > bestPage.get(k).impressions) bestPage.set(k, { route: routeOf(r.keys[1]), impressions: r.impressions });
  }
  const win = `${exp.start_date}..${exp.end_date}`;
  for (const r of exp.by_query || []) add(r.keys[0], { source: 'gsc_export', file: FILES.export, number: r.impressions, unit: 'google_impressions_28d', window: win, clicks: r.clicks, position: round1(r.position) });
  for (const h of (history && history.queries) || []) {
    if (h.in_current_window) continue;
    add(h.query, { source: 'gsc_history', file: FILES.history, number: h.last_impressions, unit: 'google_impressions_28d', window: h.last_seen_window, position: h.last_position });
  }
  for (const q of evidence.queries || []) {
    if (q.evidence_tier === 'T1') add(q.query, { source: 'gsc_90d_evidence', file: 'data/queries/evidence/evidence_queries.json', number: q.impressions_90d ?? q.impressions, unit: 'google_impressions_90d', window: `${q.measured_start}..${q.measured_end}`, position: q.average_position ?? null });
    if (typeof q.search_volume === 'number') add(q.query, { source: 'semrush_volume', file: 'data/queries/evidence/evidence_queries.json', number: q.search_volume, unit: 'modelled_monthly_searches', window: q.search_volume_source || 'semrush' });
    else if (q.evidence_tier === 'T2b') dropped.push({ query: q.query, source: 'semrush_volume', reason: 'T2b row with no search_volume number' });
  }
  for (const { file, doc } of bingFiles) {
    for (const s of doc.seeds || []) {
      add(s.query, { source: 'bing_keyword_research', file, number: typeof s.impressions === 'number' ? s.impressions : null, unit: 'bing_impressions', window: doc.window, why: `Bing returned ${JSON.stringify(s.impressions)} (below its reporting floor; not a measured number)` });
    }
  }
  const targets = [...byQuery.values()].map((t) => {
    t.measurements.sort((a, b) => PRECEDENCE.indexOf(a.source) - PRECEDENCE.indexOf(b.source));
    const p = t.measurements[0];
    const page = bestPage.get(t.query_norm);
    return { query: t.query, query_norm: t.query_norm, source: p.source, number: p.number, unit: p.unit, window: p.window, landing_page: page ? page.route : null, measurements: t.measurements };
  }).sort((a, b) => PRECEDENCE.indexOf(a.source) - PRECEDENCE.indexOf(b.source) || b.number - a.number || a.query_norm.localeCompare(b.query_norm));
  const measured = new Set(targets.map((t) => t.query_norm));
  const seen = new Set();
  for (const p of pageTargets) {
    for (const q of [p.primary_query, ...(p.supporting_queries || [])]) {
      const k = norm(q);
      if (!k || measured.has(k) || seen.has(k)) continue;
      seen.add(k);
      dropped.push({ query: q, source: 'page_targets', page: p.slug, reason: 'site-authored phrasing; no Search Console row, no measured volume' });
    }
  }
  const bySource = {};
  for (const t of targets) bySource[t.source] = (bySource[t.source] || 0) + 1;
  return {
    schema_version: '1.0', gsc_window: win, gsc_collected_at: exp.collected_at,
    measurement_rule: 'Every target carries a source and a positive measured number with its unit. Unmeasured candidates are dropped with the reason. Units are never summed or compared across sources.',
    precedence: PRECEDENCE, target_count: targets.length, targets_by_source: bySource,
    dropped_count: dropped.length, dropped_by_source: dropped.reduce((a, d) => ({ ...a, [d.source]: (a[d.source] || 0) + 1 }), {}),
    targets, dropped
  };
}

module.exports = { buildTargetQuerySet, PRECEDENCE };

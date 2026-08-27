#!/usr/bin/env node
/**
 * Read the `publishable` flag in data/authority_scale/query_atlas.json and say
 * which publishable queries have nothing pointed at them.
 *
 * Why this exists: the atlas already scores every evidence-backed query and
 * stamps each one `publishable: true|false`. Before this, nothing in the
 * repository read that field. `atlas:build` wrote it, `validate:query-atlas`
 * checked the file's shape, and no build step, validator, draft generator or
 * report ever asked the question the flag exists to answer - which publishable
 * demand is uncovered. The highest-scoring query in the whole atlas
 * (`horse boarding contract`, rank_score 192) had no page and no queued draft,
 * and nothing in the pipeline was capable of noticing.
 *
 * What it reads:
 *   data/authority_scale/query_atlas.json  - the flag, the score, the evidence
 *   data/queries/page_targets.json         - what the site actually renders
 *   data/reference/incoming_candidates.json- the reference surface
 *   data/system/editorial_backlog.json     - what is queued but unapproved
 *
 * What it writes:
 *   data/authority_scale/publishable_coverage.json
 *
 * What it does NOT do: publish, approve, or queue anything. It reports. Turning
 * an uncovered query into a draft stays a deliberate act, and turning a draft
 * into a page stays the client's decision.
 *
 * A note on `volume` in the atlas. For T1 entries sourced from
 * gsc_search_analytics, `volume` is this domain's own impression count over the
 * measured window, not market search volume - several of those entries carry
 * `superseded_tier: "T2b"`, meaning a keyword-tool volume was replaced by an
 * impression count under the same field name. rank_score is computed from that
 * field, so a term with real market volume that this domain has barely been
 * shown for scores as though it were tiny. That is why coverage here is
 * reported by rank_score AND by evidence tier and source, rather than by score
 * alone, and why the report records the source of every number it prints.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel, fallback = null) => {
  const p = path.resolve(ROOT, rel);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (value) => new Set(norm(value).split(' ').filter(Boolean));

/** A query is covered when some surface is aimed at it, not merely near it. */
function coverageFor(query, surfaces) {
  const q = norm(query);
  const qt = tokens(query);
  if (!q) return null;
  let best = null;
  for (const surface of surfaces) {
    for (const phrase of surface.phrases) {
      const p = norm(phrase);
      if (!p) continue;
      let score = 0;
      let how = '';
      if (p === q) { score = 1; how = 'exact'; }
      else if (p.includes(q)) { score = 0.9; how = 'phrase contained in target'; }
      else {
        const pt = tokens(phrase);
        const shared = [...qt].filter((t) => pt.has(t)).length;
        const ratio = qt.size ? shared / qt.size : 0;
        if (ratio === 1) { score = 0.8; how = 'all query terms present'; }
        else if (ratio >= 0.75) { score = 0.5; how = `${shared}/${qt.size} query terms present`; }
      }
      if (score && (!best || score > best.score)) best = { ...surface, score, how, matched_on: phrase };
    }
  }
  return best && best.score >= 0.8 ? best : null;
}

function main() {
  const atlas = read('data/authority_scale/query_atlas.json');
  if (!atlas || !Array.isArray(atlas.queries)) {
    throw new Error('build_publishable_coverage: data/authority_scale/query_atlas.json missing or has no queries[]');
  }

  const surfaces = [];
  for (const target of read('data/queries/page_targets.json', [])) {
    if (target.review_status !== 'approved') continue;
    surfaces.push({ kind: 'published_page', id: target.slug || target.page_id, status: 'live', phrases: [target.title, target.source_query_title, target.page_id, target.slug].filter(Boolean) });
  }
  for (const candidate of read('data/reference/incoming_candidates.json', [])) {
    surfaces.push({ kind: 'reference_page', id: candidate.slug || candidate.id, status: 'live', phrases: [candidate.title, candidate.query, candidate.slug].filter(Boolean) });
  }
  for (const entry of read('data/system/editorial_backlog.json', [])) {
    const targeted = (entry.target_queries || []).map((t) => t.query);
    surfaces.push({
      kind: 'queued_draft',
      id: entry.entry_id,
      status: entry.status || 'pending',
      phrases: [...targeted, entry.source_query_title, entry.title].filter(Boolean)
    });
  }

  const publishable = atlas.queries.filter((q) => q.publishable === true);
  const rows = publishable.map((q) => {
    const hit = coverageFor(q.query, surfaces);
    return {
      query: q.query,
      rank_score: q.rank_score ?? null,
      evidence_tier: q.evidence_tier || null,
      source_type: q.source_type || null,
      // `volume` was removed because one field held two incompatible quantities:
      // modelled monthly search volume on keyword-tool rows, and this domain's own
      // impressions on GSC rows. Reading `q.volume ?? null` here did not throw once
      // the key was gone -- it silently produced null for every row, which is exactly
      // what validate_atlas_units check 5 exists to catch.
      //
      // The two quantities are carried separately now and never collapsed.
      search_volume: q.search_volume ?? null,
      search_volume_source: q.search_volume_source || null,
      impressions_90d: q.impressions_90d ?? null,
      demand_basis: q.demand_basis || null,
      keyword_difficulty: q.keyword_difficulty ?? null,
      intent: q.intent || null,
      covered_by: hit ? { kind: hit.kind, id: hit.id, status: hit.status, how: hit.how, matched_on: hit.matched_on } : null,
      covered: Boolean(hit),
      live: Boolean(hit && hit.status === 'live')
    };
  }).sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));

  const uncovered = rows.filter((r) => !r.covered);
  const queuedOnly = rows.filter((r) => r.covered && !r.live);

  const report = {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    reads: 'data/authority_scale/query_atlas.json#queries[].publishable',
    policy: atlas.policy || null,
    note: 'Reporting surface only. Nothing here approves, queues or publishes anything; the publishable flag marks a query as eligible to be written against, never as cleared to go live.',
    atlas_queries_total: atlas.queries.length,
    publishable_total: publishable.length,
    covered_total: rows.length - uncovered.length,
    covered_by_live_page: rows.filter((r) => r.live).length,
    covered_by_queued_draft_only: queuedOnly.length,
    uncovered_total: uncovered.length,
    highest_uncovered_rank_score: uncovered.length ? uncovered[0].rank_score : null,
    queries: rows
  };

  const out = path.resolve(ROOT, 'data/authority_scale/publishable_coverage.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Publishable coverage: ${report.publishable_total} publishable atlas queries; ${report.covered_by_live_page} covered by a live page, ${report.covered_by_queued_draft_only} by a queued draft only, ${report.uncovered_total} uncovered.`);
  if (uncovered.length) {
    console.log('Highest-scoring uncovered publishable queries:');
    for (const row of uncovered.slice(0, 10)) {
      console.log(`  ${String(row.rank_score).padStart(6)}  ${row.query} (${row.evidence_tier}, KD ${row.keyword_difficulty ?? 'n/a'})`);
    }
  }
  return report;
}

main();

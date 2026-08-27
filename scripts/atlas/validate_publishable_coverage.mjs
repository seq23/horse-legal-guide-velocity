#!/usr/bin/env node
/**
 * Guard the one thing the coverage report exists to prevent: the `publishable`
 * flag going back to being written and never read.
 *
 * Hard fails are structural only - the report is missing, stale relative to the
 * atlas, or does not account for every publishable query. Uncovered demand is
 * reported by name and does not fail the build, because whether to write
 * against a query is an editorial decision and whether to publish it is the
 * client's. A validator that failed on uncovered demand would be asserting an
 * authority it does not have.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => {
  const p = path.resolve(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

const errors = [];
const atlas = read('data/authority_scale/query_atlas.json');
const report = read('data/authority_scale/publishable_coverage.json');

if (!atlas) errors.push('data/authority_scale/query_atlas.json missing');
if (!report) errors.push('data/authority_scale/publishable_coverage.json missing - run `npm run atlas:coverage`');

if (atlas && report) {
  const publishable = atlas.queries.filter((q) => q.publishable === true).map((q) => q.query);
  const reported = new Set((report.queries || []).map((q) => q.query));
  if (report.publishable_total !== publishable.length) {
    errors.push(`report covers ${report.publishable_total} publishable queries but the atlas now has ${publishable.length} - report is stale`);
  }
  for (const query of publishable) {
    if (!reported.has(query)) errors.push(`publishable atlas query absent from the coverage report: ${query}`);
  }
  for (const row of report.queries || []) {
    // Coverage claimed against a draft must not be mistaken for coverage that
    // is live. Anything reported as live has to name a live surface.
    if (row.live && (!row.covered_by || row.covered_by.status !== 'live')) {
      errors.push(`${row.query} is reported live without a live surface`);
    }
    if (row.covered_by && row.covered_by.kind === 'queued_draft' && row.live) {
      errors.push(`${row.query} claims live coverage from an unapproved draft`);
    }
  }
}

const uncovered = (report?.queries || []).filter((q) => !q.covered);
const queuedOnly = (report?.queries || []).filter((q) => q.covered && !q.live);

console.log(JSON.stringify({
  ok: errors.length === 0,
  check: 'atlas-publishable-coverage',
  reads: 'data/authority_scale/query_atlas.json#queries[].publishable',
  publishable_total: report?.publishable_total ?? null,
  covered_by_live_page: report?.covered_by_live_page ?? null,
  covered_by_queued_draft_only: queuedOnly.length,
  uncovered_total: uncovered.length,
  top_uncovered: uncovered.slice(0, 10).map((q) => ({ query: q.query, rank_score: q.rank_score, evidence_tier: q.evidence_tier, keyword_difficulty: q.keyword_difficulty })),
  queued_not_live: queuedOnly.slice(0, 20).map((q) => ({ query: q.query, rank_score: q.rank_score, draft: q.covered_by?.id, status: q.covered_by?.status })),
  note: 'Uncovered demand is reported, never failed on: writing against a query is an editorial decision and publishing it is the client\'s.',
  errors
}, null, 2));

if (errors.length) process.exit(1);

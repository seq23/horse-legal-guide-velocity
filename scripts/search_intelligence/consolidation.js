'use strict';
/**
 * Consolidation candidates: thin, zero-impression sitemap pages and the hub each
 * would fold into. A LIST ONLY: nothing here redirects, noindexes or deletes a
 * page. It is the decision input once index coverage shows which of them Google
 * crawled and declined.
 *
 * Candidate: a sitemap leaf page (not home, hub, index or policy) with 0
 * impressions in the 28-day export, fewer than THIN_WORDS words of visible
 * text in its built HTML, and no impressions on any query row either.
 * Its hub is the /hubs/<cluster>/ page its page target files it under.
 */
const fs = require('fs');
const path = require('path');
const { FILES, ROOT, readJson, routeOf, sitemapUrls } = require('./lib');
const { pageKind } = require('./demand_families');

const THIN_WORDS = 800;

function visibleWords(html) {
  const main = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, ' ');
  return (main.replace(/<[^>]+>/g, ' ').match(/[A-Za-z0-9'’-]+/g) || []).length;
}

function buildConsolidation(exp, coverage, opts = {}) {
  const distDir = opts.distDir || path.join(ROOT, 'dist');
  const urls = opts.urls || sitemapUrls(distDir);
  const pageTargets = opts.pageTargets || readJson('data/queries/page_targets.json', []);
  const clusterOf = new Map(pageTargets.map((p) => [p.slug, p.cluster]));
  const impressions = new Map();
  for (const r of [...(exp.by_page || []), ...(exp.by_query_page || []).map((q) => ({ keys: [q.keys[1]], impressions: q.impressions }))]) {
    const route = routeOf(r.keys[0]);
    impressions.set(route, (impressions.get(route) || 0) + r.impressions);
  }
  const cov = new Map(((coverage && coverage.urls) || []).map((u) => [routeOf(u.url), u.coverageState]));
  const rows = [];
  for (const url of urls) {
    const route = routeOf(url);
    if (pageKind(route) !== 'page') continue;
    if ((impressions.get(route) || 0) > 0) continue;
    const file = path.join(distDir, route.replace(/^\//, ''), 'index.html');
    if (!fs.existsSync(file)) continue;
    const words = visibleWords(fs.readFileSync(file, 'utf8'));
    if (words >= THIN_WORDS) continue;
    const cluster = clusterOf.get(route) || (route.startsWith('/reference/') ? null : null);
    const hub = cluster ? `/hubs/${cluster}/` : (route.startsWith('/reference/') ? '/reference/' : null);
    rows.push({ route, word_count: words, impressions_28d: 0, coverage_state: cov.get(route) || 'NOT_INSPECTED', fold_into: hub, fold_basis: cluster ? `page target cluster ${cluster}` : 'no page target; section index' });
  }
  rows.sort((a, b) => a.word_count - b.word_count || a.route.localeCompare(b.route));
  const byHub = {};
  for (const r of rows) byHub[r.fold_into || 'none'] = (byHub[r.fold_into || 'none'] || 0) + 1;
  return {
    schema_version: '1.0', status: 'LIST_ONLY_NO_REDIRECTS', gsc_window: `${exp.start_date}..${exp.end_date}`, coverage_collected_at: coverage ? coverage.collected_at : null,
    rule: `Sitemap leaf pages with 0 impressions in the 28-day export and fewer than ${THIN_WORDS} visible words in the built page. Nothing is redirected or removed by this file.`,
    thin_word_threshold: THIN_WORDS, sitemap_url_count: urls.length, candidate_count: rows.length, candidates_by_hub: byHub, candidates: rows
  };
}

module.exports = { buildConsolidation, visibleWords, THIN_WORDS };

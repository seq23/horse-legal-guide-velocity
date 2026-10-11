#!/usr/bin/env node
'use strict';
/**
 * Daily: rolling 28-day Search Console truth + query history + sitemap registration.
 *
 * Writes (data/search_intelligence/):
 *   gsc_search_analytics_export.json  raw rows: totals, by_query, by_page, by_query_page
 *   gsc_truth.json                    totals and per-page/per-query truth built ONLY from that export
 *   gsc_query_history.json            every query ever seen; a query leaving the window is kept
 *   gsc_sitemaps.json                 sitemaps.list before/after, submit only when missing
 *
 * Window: 28 days ending 3 days ago (Search Console's data lag).
 * No credential, 401/403 (owner grant) or 429 (quota): NAMED STOP, exit 0, the
 * previous files are left untouched so a secretless run never blanks evidence.
 * Any other failure: exit 1.
 */
const { FILES, DEFAULT_PROPERTY, SITE_ORIGIN, readJson, writeJson, norm, round1, routeOf, isoDate, serviceAccount, jsonFetch, googleToken, heldReason } = require('./lib');

const ROW_LIMIT = 25000;
const SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`;

async function main() {
  const site = String(process.env.GSC_SITE_URL || '').trim() || DEFAULT_PROPERTY;
  const sa = serviceAccount();
  if (!sa || !sa.client_email || !sa.private_key) {
    console.log('NAMED STOP gsc-truth: GSC_SERVICE_ACCOUNT_JSON is not set here; the daily Agency Search Monitor supplies it from repository secrets. Existing truth left untouched.');
    return 0;
  }
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 27);
  const window = { start_date: isoDate(start), end_date: isoDate(end) };
  const collectedAt = new Date().toISOString();
  let token;
  try {
    token = await googleToken(sa, 'https://www.googleapis.com/auth/webmasters');
    const api = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}`;
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    async function query(dimensions) {
      const rows = [];
      for (let startRow = 0; ; startRow += ROW_LIMIT) {
        const r = await jsonFetch(`${api}/searchAnalytics/query`, { method: 'POST', headers: auth, body: JSON.stringify({ ...window, dimensions, rowLimit: ROW_LIMIT, startRow, type: 'web' }) });
        rows.push(...(r.rows || []));
        if ((r.rows || []).length < ROW_LIMIT) return rows;
      }
    }
    const [totalsRows, byQuery, byPage, byQueryPage] = await Promise.all([query([]), query(['query']), query(['page']), query(['query', 'page'])]);
    const t = totalsRows[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    const exp = {
      schema_version: '1.0', truth_source: 'google_search_console', site_url: site, ...window, collected_at: collectedAt,
      row_limit: ROW_LIMIT,
      totals: { clicks: t.clicks || 0, impressions: t.impressions || 0, ctr: t.ctr || 0, position: t.position || 0 },
      by_query: byQuery, by_page: byPage, by_query_page: byQueryPage,
      counts: { by_query: byQuery.length, by_page: byPage.length, by_query_page: byQueryPage.length },
      truth_boundary: 'Real Search Console rows for the verified property. totals include anonymized queries, so query rows sum to less than totals; page rows are complete.'
    };
    writeJson(FILES.export, exp);
    writeJson(FILES.truth, buildTruth(exp));
    writeJson(FILES.history, mergeHistory(readJson(FILES.history, null), exp));

    // Sitemaps: list, submit only when absent, list again.
    const listed = (r) => (r.sitemap || []).some((s) => s.path === SITEMAP_URL);
    const before = await jsonFetch(`${api}/sitemaps`, { headers: auth });
    let submitted = false;
    if (!listed(before)) {
      await jsonFetch(`${api}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`, { method: 'PUT', headers: auth });
      submitted = true;
    }
    const after = submitted ? await jsonFetch(`${api}/sitemaps`, { headers: auth }) : before;
    const state = listed(after) ? 'REGISTERED' : 'NOT_LISTED';
    writeJson(FILES.sitemaps, { schema_version: '1.0', collected_at: collectedAt, site, sitemap_url: SITEMAP_URL, state, submitted_this_run: submitted, listed_before: listed(before), listed_after: listed(after), sitemaps: after.sitemap || [] });
    const hist = readJson(FILES.history, {});
    console.log(`gsc-truth OK ${window.start_date}..${window.end_date}: ${exp.totals.impressions} impressions, ${exp.totals.clicks} clicks; ${byQuery.length} queries, ${byPage.length} pages, ${byQueryPage.length} query x page rows; history ${hist.query_count} queries (${hist.in_window_count} in window); sitemap ${state}${submitted ? ' (submitted this run)' : ''}`);
    if (state !== 'REGISTERED') { console.error(`gsc-sitemaps: ${SITEMAP_URL} submitted and still not listed on ${site}`); return 1; }
    return 0;
  } catch (err) {
    const held = heldReason(err);
    if (held) {
      console.log(`NAMED STOP gsc-truth: ${held} (${String(err.message).slice(0, 160)}). Owner step: Search Console > ${site} > Settings > Users and permissions > ${sa.client_email} needs Full permission. Existing truth left untouched.`);
      return 0;
    }
    throw err;
  }
}

/** Truth is a pure function of the export: the validator recomputes it and compares. */
function buildTruth(exp) {
  const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const pages = exp.by_page.map((r) => ({ url: r.keys[0], route: routeOf(r.keys[0]), impressions: r.impressions, clicks: r.clicks, position: round1(r.position) }))
    .sort((a, b) => b.impressions - a.impressions || a.route.localeCompare(b.route));
  const queries = exp.by_query.map((r) => ({ query: r.keys[0], impressions: r.impressions, clicks: r.clicks, position: round1(r.position) }))
    .sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query));
  return {
    schema_version: '1.0', stage: 'provider_truth', provider: 'google_search_console', state: 'OK',
    site_url: exp.site_url, window: { start_date: exp.start_date, end_date: exp.end_date }, collected_at: exp.collected_at,
    export_path: 'data/search_intelligence/gsc_search_analytics_export.json',
    totals: exp.totals,
    page_row_totals: { impressions: sum(exp.by_page, 'impressions'), clicks: sum(exp.by_page, 'clicks') },
    query_row_totals: { impressions: sum(exp.by_query, 'impressions'), clicks: sum(exp.by_query, 'clicks') },
    query_page_row_totals: { impressions: sum(exp.by_query_page, 'impressions'), clicks: sum(exp.by_query_page, 'clicks') },
    pages_with_impressions: pages.filter((p) => p.impressions > 0).length,
    queries_with_impressions: queries.filter((q) => q.impressions > 0).length,
    pages, queries,
    truth_boundary: 'Every number here is read from gsc_search_analytics_export.json for the stated window. Anonymized queries count in totals and page rows but not in query rows.'
  };
}

function mergeHistory(prev, exp) {
  const queries = new Map((prev && prev.queries || []).map((q) => [q.query_norm, { ...q, in_current_window: false }]));
  const best = new Map();
  for (const r of exp.by_query_page) {
    const k = norm(r.keys[0]);
    if (!best.has(k) || r.impressions > best.get(k).impressions) best.set(k, { page: routeOf(r.keys[1]), impressions: r.impressions });
  }
  for (const r of exp.by_query) {
    const k = norm(r.keys[0]);
    const old = queries.get(k);
    queries.set(k, {
      query: r.keys[0], query_norm: k,
      first_seen_window_end: old ? old.first_seen_window_end : exp.end_date,
      last_seen_window: `${exp.start_date}..${exp.end_date}`, last_seen_collected_at: exp.collected_at,
      last_impressions: r.impressions, last_clicks: r.clicks, last_position: round1(r.position),
      last_page: (best.get(k) || {}).page || (old && old.last_page) || null,
      max_impressions: Math.max(r.impressions, old ? old.max_impressions || 0 : 0),
      in_current_window: true
    });
  }
  const list = [...queries.values()].sort((a, b) => (b.in_current_window - a.in_current_window) || b.last_impressions - a.last_impressions || a.query_norm.localeCompare(b.query_norm));
  return {
    schema_version: '1.0', updated_at: exp.collected_at, current_window: `${exp.start_date}..${exp.end_date}`,
    rule: 'One row per query ever seen in a 28-day export. A query that leaves the window keeps its last measured numbers with in_current_window=false; it is never deleted.',
    query_count: list.length, in_window_count: list.filter((q) => q.in_current_window).length, queries: list
  };
}

module.exports = { buildTruth, mergeHistory };
if (require.main === module) main().then((code) => { process.exitCode = code; }).catch((err) => { console.error(`gsc-truth FAILED: ${err.stack || err.message}`); process.exitCode = 1; });

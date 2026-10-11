#!/usr/bin/env node
'use strict';
/**
 * Daily: URL Inspection on PER_RUN sitemap URLs, rotating oldest-first, WORKERS in parallel.
 *
 * 323 sitemap URLs at 150/day means every URL is re-inspected at least every
 * three days; rows not reached this run carry forward with their own
 * inspected_at. The quota is 2,000/day/property; the Sitemap And Indexing lane
 * spends a few dozen, so 150 leaves plenty.
 *
 * Writes data/search_intelligence/index_coverage.json with counts by
 * coverageState (summary.by_coverage_state), recomputed from the rows so the
 * validator can check consistency. URLs no longer in the sitemap are dropped;
 * new sitemap URLs start NOT_INSPECTED and go first.
 * No credential: NAMED STOP, previous file untouched. 401/403/429 mid-run:
 * NAMED STOP, rows inspected before the stop are kept. Exit 1 only when the
 * sitemap is empty or nothing could be inspected.
 */
const { FILES, DEFAULT_PROPERTY, readJson, writeJson, sitemapUrls, serviceAccount, jsonFetch, googleToken, heldReason } = require('./lib');

const PER_RUN = Number(process.env.INDEX_COVERAGE_PER_RUN || 150);
const WORKERS = 8;

function summarize(rows) {
  const by = {};
  for (const r of rows) by[r.coverageState] = (by[r.coverageState] || 0) + 1;
  return Object.fromEntries(Object.entries(by).sort());
}

function document(site, urls, rows, meta) {
  const ordered = urls.map((u) => rows.get(u) || { url: u, coverageState: 'NOT_INSPECTED', verdict: null, inspected_at: null });
  return {
    schema_version: '1.0', truth_source: 'google_search_console_url_inspection', site_url: site,
    collected_at: new Date().toISOString(), ...meta,
    sitemap_url_count: urls.length, per_run: PER_RUN, workers: WORKERS,
    summary: { by_coverage_state: summarize(ordered), inspected_url_count: ordered.filter((r) => r.inspected_at).length },
    truth_boundary: 'Google index state per URL at inspected_at. Not a ranking or traffic measure; impressions live in gsc_truth.json.',
    urls: ordered
  };
}

async function main() {
  const urls = sitemapUrls();
  if (!urls.length) { console.error('index-coverage: the built sitemap lists 0 URLs (run npm run build first); nothing to inspect is a failure.'); return 1; }
  const site = String(process.env.GSC_SITE_URL || '').trim() || DEFAULT_PROPERTY;
  const prev = readJson(FILES.coverage, null);
  const rows = new Map((prev && prev.urls || []).filter((r) => r.inspected_at && urls.includes(r.url)).map((r) => [r.url, r]));
  const sa = serviceAccount();
  if (!sa || !sa.client_email) {
    console.log('NAMED STOP index-coverage: GSC_SERVICE_ACCOUNT_JSON is not set here; the daily Agency Search Monitor supplies it. Existing coverage left untouched.');
    return 0;
  }
  const token = await googleToken(sa, 'https://www.googleapis.com/auth/webmasters.readonly');
  const batch = [...urls].sort((a, b) => String((rows.get(a) || {}).inspected_at || '').localeCompare(String((rows.get(b) || {}).inspected_at || '')) || a.localeCompare(b)).slice(0, PER_RUN);
  let held = null, inspected = 0;
  const errors = [];
  const queue = [...batch];
  async function worker() {
    while (queue.length && !held) {
      const url = queue.shift();
      try {
        const body = await jsonFetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
          method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ inspectionUrl: url, siteUrl: site, languageCode: 'en-US' })
        });
        const r = (body.inspectionResult || {}).indexStatusResult || {};
        rows.set(url, {
          url, coverageState: r.coverageState || 'UNKNOWN', verdict: r.verdict || null, lastCrawlTime: r.lastCrawlTime || null,
          indexingState: r.indexingState || null, pageFetchState: r.pageFetchState || null, robotsTxtState: r.robotsTxtState || null,
          googleCanonical: r.googleCanonical || null, userCanonical: r.userCanonical || null, inspected_at: new Date().toISOString()
        });
        inspected += 1;
      } catch (err) {
        const h = heldReason(err);
        if (h) held = { status: h, detail: String(err.message).slice(0, 160), url };
        else errors.push(`${url}: ${String(err.message).slice(0, 120)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));
  const state = held ? 'NAMED_STOP' : errors.length ? 'PARTIAL' : 'OK';
  const doc = document(site, urls, rows, { state, inspected_this_run: inspected, errors_this_run: errors.length, named_stop: held ? `${held.status}: ${held.detail}` : null });
  writeJson(FILES.coverage, doc);
  console.log(`index-coverage ${state}: ${urls.length} sitemap URLs, ${inspected} inspected this run (${WORKERS} parallel); by coverageState ${JSON.stringify(doc.summary.by_coverage_state)}`);
  if (held) console.log(`NAMED STOP index-coverage: ${held.status} at ${held.url}. ${held.status === 'HELD_QUOTA' ? 'Quota resets daily.' : `Owner step: give ${sa.client_email} access to ${site}.`}`);
  if (errors.length) console.log(`::warning title=URL inspection partial::${errors.length} failed: ${errors.slice(0, 3).join(' | ')}`);
  if (!held && inspected === 0) { console.error('index-coverage: nothing could be inspected.'); return 1; }
  return 0;
}

module.exports = { summarize };
if (require.main === module) main().then((c) => { process.exitCode = c; }).catch((err) => { console.error(`index-coverage FAILED: ${err.stack || err.message}`); process.exitCode = 1; });

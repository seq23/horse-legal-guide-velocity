#!/usr/bin/env node
'use strict';
/**
 * validate:search-intelligence - the measured search loop (data/search_intelligence/).
 *
 * Seven checks, one per item of the loop, each a pure function of a context so
 * it can be proven negatively. Every run does both:
 *   1. runs the seven checks on the committed data and the built site (npm run build first);
 *   2. re-runs each check on a context broken in exactly the way it guards
 *      against, and fails if any check does NOT catch its break.
 * Blocking in every mode: any issue exits 1.
 *
 *   truth_fresh_and_equal     gsc_truth.json is <= MAX_AGE_DAYS old and equals buildTruth(export); every export query is in the history
 *   coverage_fresh_consistent index_coverage.json is <= MAX_AGE_DAYS old, lists exactly the built sitemap, counts by coverageState recount; sitemap REGISTERED
 *   targets_measured          every target has a source, a positive number and a unit; the set equals a rebuild from the export
 *   families_served           every qualifying family is strengthened (and the built page proves it) or carries a reason; pending <= 7 days
 *   one_faqpage_per_page      no public page carries more than one FAQPage; strengthened pages carry exactly one, matching the visible FAQ
 *   freeze_read_by_publisher  the flag is on, both publishers call the freeze, and nothing live is new and unmeasured
 *   no_measured_url_404       every URL with impressions in the export is served by the build
 */
const fs = require('fs');
const path = require('path');
const si = require('../../scripts/search_intelligence/lib');
const { buildTruth } = require('../../scripts/search_intelligence/collect_gsc');
const { summarize } = require('../../scripts/search_intelligence/collect_index_coverage');
const { buildTargetQuerySet, PRECEDENCE } = require('../../scripts/search_intelligence/target_query_set');
const fam = require('../../scripts/search_intelligence/demand_families');
const { loadFreeze, decide } = require('../../scripts/search_intelligence/publish_freeze');
const { jsonLdGraph, publicPages, decode } = require('./seo_pages');

const MAX_AGE_DAYS = 4;
const clone = (v) => JSON.parse(JSON.stringify(v));
const stable = (v) => JSON.stringify(v);
const textOf = (h) => decode(String(h).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const isFaq = (n) => n && (n['@type'] === 'FAQPage' || (Array.isArray(n['@type']) && n['@type'].includes('FAQPage')));

function loadContext() {
  const pages = publicPages('search intelligence');
  return {
    now: new Date(),
    export: si.readJson(si.FILES.export, null), truth: si.readJson(si.FILES.truth, null), history: si.readJson(si.FILES.history, null),
    coverage: si.readJson(si.FILES.coverage, null), sitemaps: si.readJson(si.FILES.sitemaps, null), sitemapUrls: si.sitemapUrls(),
    targets: si.readJson(si.FILES.targets, null), families: si.readJson(si.FILES.families, null), ledger: si.readJson(si.FILES.ledger, null),
    strengthening: si.readJson(si.FILES.strengthening, null), intents: fam.loadIntents(),
    html: new Map(pages.map((p) => [p.urlPath, p.html])),
    freeze: loadFreeze(), freezeDoc: si.readJson(si.FILES.freeze, null), holds: si.readJson(si.FILES.holds, null),
    config: si.readJson('data/system/config.json', {}),
    publisherSources: {
      'scripts/build/write_editorial_pages.js': fs.readFileSync(si.abs('scripts/build/write_editorial_pages.js'), 'utf8'),
      'scripts/build/build_site.js': fs.readFileSync(si.abs('scripts/build/build_site.js'), 'utf8')
    },
    editorialLive: (si.readJson('dist/editorial-publishing-state.json', { live_entries: [] }).live_entries || []),
    builtPageTargets: new Set([...pages.map((p) => p.urlPath)]),
    approvedPageTargets: (si.readJson('data/queries/page_targets.json', []) || []).filter((p) => p.review_status === 'approved'),
    revoked: new Set((si.readJson('dist/editorial-revoked-paths.json', { revoked_paths: [] }).revoked_paths || [])),
    served: (route) => si.servedByBuild(route)
  };
}

const ageDays = (ctx, iso) => (ctx.now - new Date(iso)) / 86400000;

const CHECKS = {
  truth_fresh_and_equal(ctx) {
    const out = [];
    if (!ctx.export || !ctx.truth) return [`${si.FILES.export} or ${si.FILES.truth} is missing`];
    if (!(ctx.export.by_page || []).length) out.push('export has 0 page rows: an empty export is not truth');
    if (!(ageDays(ctx, ctx.truth.collected_at) <= MAX_AGE_DAYS)) out.push(`gsc_truth collected_at ${ctx.truth.collected_at} is older than ${MAX_AGE_DAYS} days`);
    const rebuilt = buildTruth(ctx.export);
    for (const k of ['window', 'collected_at', 'totals', 'page_row_totals', 'query_row_totals', 'query_page_row_totals', 'pages', 'queries']) {
      if (stable(rebuilt[k]) !== stable(ctx.truth[k])) out.push(`gsc_truth.${k} does not equal the export (rebuild differs)`);
    }
    const hist = new Map(((ctx.history && ctx.history.queries) || []).map((q) => [q.query_norm, q]));
    for (const r of ctx.export.by_query || []) {
      const h = hist.get(si.norm(r.keys[0]));
      if (!h || !h.in_current_window || h.last_impressions !== r.impressions) out.push(`query history is missing or stale for "${r.keys[0]}"`);
    }
    return out;
  },

  coverage_fresh_consistent(ctx) {
    const out = [];
    const c = ctx.coverage;
    if (!c || !Array.isArray(c.urls)) return [`${si.FILES.coverage} is missing`];
    if (!(ageDays(ctx, c.collected_at) <= MAX_AGE_DAYS)) out.push(`index_coverage collected_at ${c.collected_at} is older than ${MAX_AGE_DAYS} days`);
    if (!c.urls.some((u) => u.inspected_at)) out.push('index_coverage has 0 inspected URLs');
    const listed = new Set(c.urls.map((u) => u.url));
    const missing = ctx.sitemapUrls.filter((u) => !listed.has(u));
    const extra = [...listed].filter((u) => !ctx.sitemapUrls.includes(u));
    if (missing.length) out.push(`${missing.length} sitemap URL(s) absent from index_coverage (first: ${missing[0]})`);
    if (extra.length) out.push(`${extra.length} index_coverage URL(s) not in the sitemap (first: ${extra[0]})`);
    if (c.sitemap_url_count !== c.urls.length) out.push(`sitemap_url_count ${c.sitemap_url_count} != ${c.urls.length} rows`);
    if (stable(summarize(c.urls)) !== stable(c.summary && c.summary.by_coverage_state)) out.push('summary.by_coverage_state does not recount from the rows');
    if (!ctx.sitemaps || ctx.sitemaps.state !== 'REGISTERED' || !(ageDays(ctx, ctx.sitemaps.collected_at) <= MAX_AGE_DAYS)) out.push(`${si.FILES.sitemaps} is missing, stale, or the sitemap is not REGISTERED`);
    return out;
  },

  targets_measured(ctx) {
    const out = [];
    const t = ctx.targets;
    if (!t || !Array.isArray(t.targets) || !t.targets.length) return [`${si.FILES.targets} has no targets`];
    for (const x of t.targets) {
      if (!PRECEDENCE.includes(x.source)) out.push(`target "${x.query}" has no recognised source (${x.source})`);
      if (!(typeof x.number === 'number' && x.number > 0)) out.push(`target "${x.query}" has no positive measured number`);
      if (!x.unit) out.push(`target "${x.query}" has no unit`);
    }
    for (const d of t.dropped || []) if (!d.reason) out.push(`dropped "${d.query}" has no reason`);
    const rebuilt = buildTargetQuerySet(ctx.export, ctx.history);
    if (stable(rebuilt.targets) !== stable(t.targets)) out.push('target_query_set.json differs from a rebuild from the export (run node scripts/search_intelligence/build_loop.js)');
    return out;
  },

  families_served(ctx) {
    const out = [];
    const f = ctx.families;
    if (!f || !Array.isArray(f.families) || !f.families.length) return [`${si.FILES.families} has no families`];
    const entries = new Map(((ctx.strengthening && ctx.strengthening.pages) || []).map((p) => [p.route, p]));
    const rebuilt = fam.computeFamilies(ctx.export, { pages: [...entries.values()], pending: (ctx.ledger && ctx.ledger.pending) || [] }, ctx.intents, (f.families.find((x) => x.qualified_on) || {}).qualified_on || si.isoDate(ctx.now));
    const status = (list) => list.map((x) => `${x.family}=${x.status}`).sort();
    if (stable(status(rebuilt)) !== stable(status(f.families))) out.push('demand_families.json statuses differ from a recompute of the committed export');
    const realQueries = new Set([...(ctx.export.by_query || []).map((r) => si.norm(r.keys[0])), ...(((ctx.history || {}).queries) || []).map((q) => q.query_norm)]);
    for (const x of f.families.filter((y) => y.qualifies)) {
      if (!x.reason) out.push(`qualifying family ${x.family} has no reason`);
      if (x.status === 'pending_strengthening' && ageDays(ctx, x.qualified_on) > fam.RULE.pending_max_days) out.push(`family ${x.family} has waited since ${x.qualified_on} (> ${fam.RULE.pending_max_days} days) for strengthening`);
      if (!['strengthened', 'pending_strengthening', 'intent_mismatch', 'no_answer_page'].includes(x.status)) out.push(`qualifying family ${x.family} has status ${x.status}`);
      if (x.status !== 'strengthened') continue;
      const e = entries.get(x.page);
      if (!e) { out.push(`family ${x.family} is marked strengthened but ${x.page} has no strengthening entry`); continue; }
      const html = ctx.html.get(x.page) || '';
      const prefixes = [x.head_term, ...x.queries.map((q) => q.query)].map(si.norm);
      if (!(e.title.length <= 65) || !prefixes.some((p) => si.norm(e.title).startsWith(p))) out.push(`${x.page}: title "${e.title}" is not query-first and <= 65 chars`);
      const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
      if (decode(title || '') !== e.title) out.push(`${x.page}: built <title> is not the strengthened title`);
      const def = html.match(/<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/);
      const words = def ? textOf(def[1]).split(' ').length : 0;
      if (words < 40 || words > 60) out.push(`${x.page}: paragraph under the H1 is ${words} words (need 40-60)`);
      const sec = (html.match(/<section[^>]*data-search-strengthening="true"[^>]*>([\s\S]*?)<\/section>/) || [])[1] || '';
      const qH2 = [...sec.matchAll(/<h2>([^<]*\?)<\/h2>/g)].length;
      if (qH2 < 2) out.push(`${x.page}: ${qH2} question H2s in the strengthening section (need >= 2)`);
      if (!(e.facts || []).length || e.facts.length < 3 || e.facts.some((k) => !k.fact || !k.source)) out.push(`${x.page}: needs >= 3 specific facts, each with a source`);
      for (const q of e.faq || []) {
        if (!realQueries.has(si.norm(q.query))) out.push(`${x.page}: FAQ query "${q.query}" is not a real Search Console query`);
        if (!si.norm(q.question).includes(si.norm(q.query))) out.push(`${x.page}: FAQ question "${q.question}" does not carry its query "${q.query}"`);
      }
      for (const from of e.links_from || []) {
        const src = ctx.html.get(from) || '';
        if (!new RegExp(`<section[^>]*data-search-links="true"[\\s\\S]*?href="${x.page.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(src)) out.push(`${x.page}: no link from ${from}`);
      }
    }
    return out;
  },

  one_faqpage_per_page(ctx) {
    const out = [];
    if (!ctx.html.size) return ['no built pages (run npm run build)'];
    for (const [route, html] of ctx.html) {
      let graph;
      try { graph = jsonLdGraph(html); } catch (e) { out.push(`${route}: JSON-LD does not parse (${e.message})`); continue; }
      const n = graph.filter(isFaq).length;
      if (n > 1) out.push(`${route}: ${n} FAQPage nodes (max 1)`);
    }
    for (const e of (ctx.strengthening && ctx.strengthening.pages) || []) {
      const html = ctx.html.get(e.route) || '';
      let faqs = [];
      try { faqs = jsonLdGraph(html).filter(isFaq); } catch { /* reported above */ }
      if (faqs.length !== 1) { out.push(`${e.route}: strengthened page has ${faqs.length} FAQPage nodes (need exactly 1)`); continue; }
      const schemaQs = (faqs[0].mainEntity || []).map((q) => q.name);
      const visible = [...((html.match(/<section[^>]*data-search-faq="true"[^>]*>([\s\S]*?)<\/section>/) || [])[1] || '').matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => decode(m[1]));
      if (stable(schemaQs) !== stable(e.faq.map((q) => q.question)) || stable(visible) !== stable(schemaQs)) out.push(`${e.route}: FAQPage questions do not match the visible real-query FAQ`);
    }
    return out;
  },

  freeze_read_by_publisher(ctx) {
    const out = [];
    if (ctx.config.search_publishing_freeze !== true) out.push('data/system/config.json search_publishing_freeze is not true');
    const fd = ctx.freezeDoc;
    if (!fd || !(fd.grandfathered && (fd.grandfathered.editorial || []).length && (fd.grandfathered.page_targets || []).length)) out.push(`${si.FILES.freeze} has no grandfathered live set`);
    for (const [file, src] of Object.entries(ctx.publisherSources)) {
      if (!/require\(['"]\.\.\/search_intelligence\/publish_freeze['"]\)/.test(src) || !/freezeDecide\(/.test(src) || !/recordHolds\(/.test(src)) out.push(`${file} does not read the publishing freeze`);
    }
    if (!ctx.holds || !ctx.holds.lanes || !ctx.holds.lanes.editorial || !ctx.holds.lanes.page_targets) out.push(`${si.FILES.holds} was not written by both publishers on the last build`);
    // Behaviour: with the flag on, an unmeasured new page is held and a measured one is not.
    const probe = { ...ctx.freeze, enabled: ctx.config.search_publishing_freeze === true };
    const measured = [...probe.measured.keys()][0];
    if (decide(probe, 'editorial', '__probe_new__', ['zz unmeasured probe query']).publish) out.push('freeze decide() publishes an unmeasured new entry');
    if (measured && !decide(probe, 'editorial', '__probe_new__', [measured]).publish) out.push('freeze decide() holds a measured entry');
    // What the build actually published: nothing live is new and unmeasured.
    for (const e of ctx.editorialLive) {
      const d = decide(probe, 'editorial', e.entry_id, [e.source_query_title, e.title]);
      if (!d.publish) out.push(`editorial entry ${e.entry_id} is live but new and unmeasured`);
    }
    for (const p of ctx.approvedPageTargets) {
      if (!ctx.builtPageTargets.has(p.slug)) continue;
      const d = decide(probe, 'page_targets', p.slug, [p.primary_query, ...(p.supporting_queries || [])]);
      if (!d.publish) out.push(`page target ${p.slug} is live but new and unmeasured`);
    }
    return out;
  },

  no_measured_url_404(ctx) {
    const out = [];
    const urls = new Set([...(ctx.export.by_page || []).filter((r) => r.impressions > 0).map((r) => r.keys[0]), ...(ctx.export.by_query_page || []).filter((r) => r.impressions > 0).map((r) => r.keys[1])]);
    if (!urls.size) return ['export has 0 URLs with impressions'];
    for (const url of urls) {
      const route = si.routeOf(url);
      if (!url.startsWith(si.SITE_ORIGIN)) continue;
      if (!ctx.served(route).ok) out.push(`${url} has impressions and the build does not serve it (404)`);
      if (ctx.revoked.has(route)) out.push(`${url} has impressions and is in the revoked-paths denylist (404 at the edge)`);
    }
    return out;
  }
};

// Each break must be caught by the check it targets.
const BREAKS = {
  truth_fresh_and_equal: (c) => { c.truth = clone(c.truth); c.truth.totals.impressions += 1; },
  coverage_fresh_consistent: (c) => { c.coverage = clone(c.coverage); const k = Object.keys(c.coverage.summary.by_coverage_state)[0]; c.coverage.summary.by_coverage_state[k] += 1; },
  targets_measured: (c) => { c.targets = clone(c.targets); c.targets.targets[0].number = null; },
  families_served: (c) => { c.strengthening = clone(c.strengthening); c.strengthening.pages[0].title = 'Unrelated Title'; },
  one_faqpage_per_page: (c) => { const [route, html] = [...c.html].find(([, h]) => /"FAQPage"/.test(h)); c.html = new Map(c.html); c.html.set(route, html.replace('</head>', `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script></head>`)); },
  freeze_read_by_publisher: (c) => { c.editorialLive = [...c.editorialLive, { entry_id: '__new_unmeasured__', title: 'zz unmeasured probe', source_query_title: 'zz unmeasured probe' }]; },
  no_measured_url_404: (c) => { c.export = clone(c.export); c.export.by_page.push({ keys: [`${si.SITE_ORIGIN}/zz-not-built/`], impressions: 3, clicks: 0, position: 9 }); }
};

function main() {
  const ctx = loadContext();
  const issues = [];
  for (const [name, check] of Object.entries(CHECKS)) {
    const found = check(ctx);
    for (const m of found) issues.push(`[${name}] ${m}`);
    const broken = { ...ctx };
    BREAKS[name](broken);
    if (!check(broken).length) issues.push(`[${name}] negative proof failed: the check passed on a context broken on purpose`);
  }
  if (issues.length) {
    console.error(`validate_search_intelligence: ${issues.length} issue(s)`);
    for (const i of issues.slice(0, 40)) console.error(`- ${i}`);
    process.exit(1);
  }
  const f = ctx.families;
  console.log(`OK: search intelligence - 7 checks pass and 7 negative proofs caught their break. truth ${ctx.truth.totals.impressions} impressions (${ctx.truth.window.start_date}..${ctx.truth.window.end_date}); coverage ${JSON.stringify(ctx.coverage.summary.by_coverage_state)}; ${ctx.targets.target_count} targets; ${f.qualifying_count} qualifying families ${JSON.stringify(f.status_counts)}.`);
}

module.exports = { CHECKS, BREAKS, loadContext };
if (require.main === module) main();

const fs = require('fs');
const path = require('path');
const { renderLayout } = require('../lib/render_page');
const { toAbsoluteUrl } = require('../lib/write_canonical_tag');
function dir(p) { fs.mkdirSync(p, { recursive: true }); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }
function tit(s) { return String(s || '').replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
function rslug(c) { return '/reference/' + (c.slug || String(c.query || c.raw_phrasing || c.candidate_id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) + '/'; }
function readJson(rel, fallback) { try { return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')); } catch { return fallback; } }
function writeJson(dist, rel, payload) {
  fs.writeFileSync(path.join(dist, rel), JSON.stringify(payload, null, 2));
}
function idx(dist, { slug, title, description, items }) {
  const d = path.join(dist, slug.replace(/^\//, ''));
  dir(d);
  const list = items.length ? items.map((i) => '<li><a href="' + i.slug + '">' + esc(i.title) + '</a>' + (i.cluster ? ' <span class="muted">— ' + esc(tit(i.cluster)) + '</span>' : '') + '</li>').join('\n') : '<li>No approved pages are currently available in this index.</li>';
  const body = '<header class="content-header"><span class="eyebrow">Public index</span><h1>' + esc(title) + '</h1><p class="muted">' + esc(description) + '</p></header>' +
    '<nav><p><a href="/">Home</a> · <a href="/coverage/">Coverage map</a> · <a href="/reference/">Reference index</a> · <a href="/sitemap.xml">Sitemap</a></p></nav>' +
    '<section><h2>Pages</h2><ul>' + list + '</ul></section>';
  fs.writeFileSync(path.join(d, 'index.html'), renderLayout({ title, description, url: slug, body }));
}
function coveragePage(dist, targets, clusters, cands) {
  const raw = readJson('data/community/raw_signals.json', []);
  const normalized = readJson('data/community/normalized_signals.json', []);
  const queue = readJson('data/community/publish_queue.json', []);
  const bySource = raw.reduce((acc, s) => { acc[s.source_key || 'unknown'] = (acc[s.source_key || 'unknown'] || 0) + 1; return acc; }, {});
  const byCluster = normalized.reduce((acc, s) => { acc[s.cluster || 'unknown'] = (acc[s.cluster || 'unknown'] || 0) + 1; return acc; }, {});
  const groupedTargets = targets.reduce((acc, p) => { (acc[p.page_type] ||= []).push(p); return acc; }, {});
  const typeSections = Object.entries(groupedTargets).sort().map(([type, pages]) => {
    const items = pages.sort((a,b) => (a.title || '').localeCompare(b.title || '')).map((p) => '<li><a href="' + p.slug + '">' + esc(p.title) + '</a> <span class="muted">— ' + esc(tit(p.cluster)) + (p.provenance_status ? ' · ' + esc(p.provenance_status) : '') + '</span></li>').join('\n');
    return '<section><h2>' + esc(tit(type)) + '</h2><ul>' + items + '</ul></section>';
  }).join('\n');
  const clusterItems = clusters.map((c) => '<li><a href="' + c.slug + '">' + esc(c.title || tit(c.cluster)) + '</a> <span class="muted">— mapped coverage area · fan-out JSON: <code>/reference/fanout/' + esc(c.cluster) + '.json</code></span></li>').join('\n');
  const targetItems = targets.sort((a,b) => (a.cluster || '').localeCompare(b.cluster || '') || (a.page_type || '').localeCompare(b.page_type || '') || (a.title || '').localeCompare(b.title || '')).map((p) => '<li><a href="' + p.slug + '">' + esc(p.title) + '</a> <span class="muted">— ' + esc(p.page_type) + ' · ' + esc(tit(p.cluster)) + '</span></li>').join('\n');
  const referenceItems = cands.slice(0, 300).map((c) => '<li><a href="' + rslug(c) + '">' + esc(c.query || c.raw_phrasing || c.candidate_id) + '</a> <span class="muted">— ' + esc(tit(c.cluster)) + '</span></li>').join('\n');
  const sourceItems = Object.entries(bySource).sort().map(([k,v]) => '<li>' + esc(k) + ': ' + esc(v) + '</li>').join('\n');
  const clusterSignalItems = Object.entries(byCluster).sort().map(([k,v]) => '<li>' + esc(tit(k)) + ': ' + esc(v) + '</li>').join('\n');
  const body = '<header class="content-header"><span class="eyebrow">Query coverage map</span><h1>Coverage Map</h1><p class="muted">Public resource map showing the query universe, cluster routing, approved public page targets, and intentional reference/fan-out surfaces. Raw user posts are not published here.</p></header>' +
    '<nav><p><a href="/">Home</a> · <a href="/faq/">FAQ</a> · <a href="/scenario/">Scenarios</a> · <a href="/compare/">Comparisons</a> · <a href="/reference/">Reference</a></p></nav>' +
    '<section><h2>Query universe</h2><p>Approved public page targets are now ingestion-governed. Public pages expose clean questions and original educational answers, while source traceability stays in JSON artifacts.</p></section>' +
    '<section><h2>Signal source mix</h2><ul>' + sourceItems + '</ul></section>' +
    '<section><h2>Cluster signal mix</h2><ul>' + clusterSignalItems + '</ul></section>' +
    '<section><h2>Cluster map</h2><ul>' + clusterItems + '</ul></section>' +
    '<section><h2>All approved public page targets</h2><ul>' + targetItems + '</ul></section>' + typeSections +
    '<section><h2>Reference / fan-out surfaces</h2><p>The reference layer now exists to route clean question patterns to canonical public pages and cluster fan-out files.</p><ul>' + referenceItems + '</ul></section>' +
    '<section><h2>Ingestion queue summary</h2><p>Approved for content: ' + esc(String(queue.filter((q) => q.status === 'approved_for_content').length)) + '. Pages strengthened: ' + esc(String(queue.filter((q) => q.action === 'strengthen_existing_page').length)) + '.</p></section>';
  const d = path.join(dist, 'coverage');
  dir(d);
  fs.writeFileSync(path.join(d, 'index.html'), renderLayout({ title: 'Coverage Map | Horse Legal Guide', description: 'Query universe and public coverage map for Horse Legal Guide.', url: '/coverage/', body }));
}
function writeExports(dist, targets, clusters, cands) {
  const answers = targets.map((page) => ({
    slug: page.slug,
    title: page.title,
    page_type: page.page_type,
    cluster: page.cluster,
    primary_query: page.primary_query,
    answer_surface_type: 'educational_velocity_page',
    canonical_site_url: toAbsoluteUrl(page.slug)
  }));
  const coverage = {
    cluster_count: clusters.length,
    approved_page_count: targets.length,
    reference_candidate_count: cands.length,
    clusters: clusters.map((cluster) => ({ cluster: cluster.cluster, title: cluster.title, slug: cluster.slug })),
    pages: targets.map((page) => ({ slug: page.slug, page_type: page.page_type, cluster: page.cluster, title: page.title }))
  };
  writeJson(dist, 'answers.json', answers);
  writeJson(dist, 'coverage.json', coverage);
}
function writePublicIndexes(dist, targets, clusters, cands) {
  const a = targets.filter((p) => p.review_status === 'approved');
  idx(dist, { slug: '/faq/', title: 'FAQ Index', description: 'Approved frequently asked equine-law question pages.', items: a.filter((p) => p.page_type === 'faq') });
  idx(dist, { slug: '/scenario/', title: 'Scenario Index', description: 'Approved scenario-based equine-law pages.', items: a.filter((p) => p.page_type === 'scenario') });
  idx(dist, { slug: '/compare/', title: 'Comparison Index', description: 'Approved comparison pages for adjacent equine-law questions.', items: a.filter((p) => p.page_type === 'comparison') });
  idx(dist, { slug: '/state/', title: 'State Index', description: 'Approved state-specific equine-law pages.', items: a.filter((p) => p.page_type === 'state') });
  idx(dist, { slug: '/hubs/', title: 'Topic Hub Index', description: 'All public topic hubs for Horse Legal Guide.', items: clusters.map((c) => ({ slug: c.slug, title: c.title || tit(c.cluster), cluster: c.cluster })) });
  idx(dist, { slug: '/reference/', title: 'Reference / Fan-Out Index', description: 'Intentional reference surfaces that map clean public question patterns to page targets and cluster fan-out files.', items: cands.map((c) => ({ slug: rslug(c), title: c.query || c.raw_phrasing || c.candidate_id, cluster: c.cluster })) });
  coveragePage(dist, a, clusters, cands);
  writeExports(dist, a, clusters, cands);
}
module.exports = { writePublicIndexes };

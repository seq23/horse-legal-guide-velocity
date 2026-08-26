/**
 * Shared wayfinding for every content surface.
 *
 * Measured on the shipped dist/ before this existed: a median of 10 unique
 * internal links out per page, against 17 on uscisexam.com - the most-cited
 * property in this estate, and the smallest. Two structural reasons for the
 * gap, both navigation rather than content:
 *
 *   1. A content page could not reach /faq/, /compare/, /scenario/, /hubs/ or
 *      /coverage/ at all. Those index pages exist and are in the sitemap; no
 *      content page linked to any of them. The only way in was the homepage.
 *   2. The related-pages block was capped at six same-cluster siblings, and it
 *      took the same first six for every page in the cluster. A 65-page cluster
 *      therefore concentrated all of its internal links on six destinations and
 *      left the other 58 with one inbound link from the hub.
 *
 * Everything here is navigation and sibling linking drawn from the taxonomy the
 * repo already carries - `cluster` on data/queries/page_targets.json and
 * data/reference/incoming_candidates.json, and the hub titles in
 * data/queries/clusters.json. No cluster, tag or grouping is invented, no
 * editorial copy is written, and no page's own prose is touched.
 *
 * Anchor text is always the destination page's own title, so it describes what
 * the reader will land on and varies by construction rather than repeating one
 * phrase across hundreds of links.
 */
const fs = require('fs');
const path = require('path');

/** Unique internal links out per page. The cited property measures 17. */
const LINK_TARGET = 18;
/** Never fewer than this in a sibling block, and never more. */
const SIBLINGS_MIN = 6;
const SIBLINGS_MAX = 12;

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')); } catch { return fallback; }
}

function titleCase(value) {
  return String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

/** route -> no trailing slash, so `/faq/` and `/faq` are one destination. */
function normRoute(route) {
  const r = String(route || '').split('#')[0].split('?')[0];
  if (!r.startsWith('/')) return null;
  if (r === '/') return '/';
  return r.replace(/\/+$/, '') || '/';
}

let clusterCache = null;
function clusterIndex() {
  if (clusterCache) return clusterCache;
  clusterCache = new Map((readJson('data/queries/clusters.json', []) || [])
    .map((c) => [c.cluster, { cluster: c.cluster, title: c.title || titleCase(c.cluster), slug: c.slug }]));
  return clusterCache;
}

function clusterHub(cluster) {
  return clusterIndex().get(cluster) || { cluster, title: titleCase(cluster), slug: `/hubs/${cluster}/` };
}

/**
 * The public index a page's own URL sits under. These are the section pages the
 * build already writes; the first path segment is the section.
 */
const SECTION_LABEL = {
  compare: 'Comparisons',
  scenario: 'Scenarios',
  faq: 'Questions',
  reference: 'Reference index',
  hubs: 'Topic hubs',
  coverage: 'Coverage map',
};
function sectionOf(url) {
  const seg = String(url || '/').replace(/^\//, '').split('/')[0];
  return SECTION_LABEL[seg] ? { route: `/${seg}/`, label: SECTION_LABEL[seg] } : null;
}

/**
 * Visible breadcrumb, matching the BreadcrumbList already emitted in JSON-LD:
 * Home, the section index the URL sits under, then the page itself. Both sides
 * are derived from the same URL, so the markup and the schema cannot disagree.
 */
function breadcrumbNav(url, title) {
  const section = sectionOf(url);
  const crumbs = [`<a href="/">Home</a>`];
  if (section) crumbs.push(`<a href="${section.route}">${esc(section.label)}</a>`);
  return `<nav class="breadcrumb-nav" aria-label="Breadcrumb"><p>${crumbs.join(' <span aria-hidden="true">·</span> ')} <span aria-hidden="true">·</span> <span aria-current="page">${esc(title)}</span></p></nav>`;
}

/**
 * The wayfinding row. Every link on it points at a page the build already
 * writes and the sitemap already carries; before this, a reader on a content
 * page had no route to any of them.
 */
function wayfindingNav(cluster, extraLinks = []) {
  const hub = clusterHub(cluster);
  const links = [
    `<a href="/">Home</a>`,
    `<a href="${hub.slug}">${esc(hub.title)}</a>`,
    `<a href="/hubs/">All topic hubs</a>`,
    `<a href="/reference/">Reference index</a>`,
    `<a href="/coverage/">Coverage map</a>`,
    ...extraLinks,
  ];
  return `<nav class="wayfinding-nav" aria-label="Site sections"><p>${links.join(' <span aria-hidden="true">·</span> ')}</p></nav>`;
}

/**
 * Sibling links, sized to what the page is actually short of.
 *
 * `have` is the page's own unique internal link set, read off the rendered body
 * and normalised the same way the link graph is measured, so a page already at
 * the standard is not padded to hit a number. Candidates are consumed in the
 * order given: nearest first, and a lane is only reached when the one before it
 * ran out.
 */
function uniqueInternalRoutes(html) {
  const out = new Set();
  const re = /<a\b[^>]*?href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    let href = m[1];
    const absolute = href.match(/^https?:\/\/(?:www\.)?horselegalguide\.com(\/[^\s"']*)?$/i);
    if (absolute) href = absolute[1] || '/';
    else if (/^(https?:|mailto:|tel:|javascript:|data:|#|\/\/)/i.test(href)) continue;
    if (!href.startsWith('/')) continue;
    const r = normRoute(href);
    if (r) out.add(r);
  }
  return out;
}

/**
 * Pick siblings until the page reaches LINK_TARGET unique internal links.
 * `candidates` is [{ slug, title, why }], nearest lane first.
 */
function pickSiblings(bodyHtml, selfSlug, candidates) {
  const have = uniqueInternalRoutes(bodyHtml);
  const self = normRoute(selfSlug);
  have.delete(self);
  const picks = [];
  for (const cand of candidates) {
    const route = normRoute(cand.slug);
    if (!route || route === self || have.has(route)) continue;
    if (picks.length >= SIBLINGS_MIN && have.size >= LINK_TARGET) break;
    if (picks.length >= SIBLINGS_MAX) break;
    picks.push(cand);
    have.add(route);
  }
  return picks;
}

/**
 * A rotating window over a cluster, so two pages in the same cluster do not
 * list the same siblings. The offset is derived from the page's own slug, so it
 * is stable across builds - a link block that reshuffles on every build is a
 * link block no crawler learns to trust.
 */
function rotate(list, seedSlug) {
  if (list.length < 2) return list.slice();
  let h = 7;
  for (const ch of String(seedSlug || '')) h = ((h * 31) + ch.charCodeAt(0)) | 0;
  const start = Math.abs(h) % list.length;
  const out = [];
  // Stride of 5 rather than 1 so consecutive pages in a cluster do not produce
  // near-identical windows.
  for (let k = 0; k < list.length; k += 1) out.push(list[(start + (k * 5)) % list.length]);
  return [...new Set(out)];
}

function siblingBlock({ heading, intro, items }) {
  if (!items.length) return '';
  const lis = items.map((i) => `<li><a href="${esc(i.slug)}">${esc(i.title)}</a>${i.why ? ` <span class="muted">— ${esc(i.why)}</span>` : ''}</li>`).join('\n');
  return `<section class="cluster-links" data-cluster-links="true"><h2>${esc(heading)}</h2><p class="muted">${esc(intro)}</p><ul>${lis}</ul></section>`;
}

module.exports = {
  LINK_TARGET,
  breadcrumbNav,
  clusterHub,
  clusterIndex,
  pickSiblings,
  rotate,
  sectionOf,
  siblingBlock,
  titleCase,
  uniqueInternalRoutes,
  wayfindingNav,
};

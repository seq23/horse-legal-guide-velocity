'use strict';
/**
 * Folds the shared search loop's question pages (seq23/search-loop, config
 * search-loop.config.json, source in questions/) into the built site.
 *
 * Ruling (Sequoia, 1 Nov 2026, horse only): question pages are HIDDEN pages.
 * They are never added to the nav, a hub or a section index. They are reached
 * through a "Related questions" block on relevant existing pages, the sitemap
 * and IndexNow (write_sitemaps.js sweeps dist/ after this runs).
 *
 * Called by scripts/build/build_site.js after every page family is written and
 * BEFORE writeSitemaps, so folded pages are in sitemap-pages.xml and the
 * IndexNow batch, and unfolded (held) pages are not.
 *
 * Legal gate (client site, not legal advice): a question page is served only
 * if it carries the footer disclaimer and has none of the compliance rules'
 * forbidden phrases and no best/top/expert wording. A page that fails is held
 * (kept in questions/, not served, every link to it removed) and listed in
 * data/search-loop/legal-holds.json with a NAMED NOTE in the build log.
 */
const fs = require('fs');
const path = require('path');
const { extractVisibleFaq } = require('../lib/render_page');

const SRC_DIR = 'questions';
const URL_PREFIX = '/questions/';
const SITE = 'https://horselegalguide.com';
const HOLDS_FILE = 'data/search-loop/legal-holds.json';
const FOOTER_PARTIAL = 'templates/partial.footer.html';
const FOOTER_DISCLAIMER = 'This content does not constitute legal advice or create an attorney-client relationship.';
const RELATED_START = '<!-- search-loop:related -->';
const RELATED_END = '<!-- /search-loop:related -->';
const HOSTS_PER_PAGE = 2;
const MAX_LINKS_PER_HOST = 6;
// Sections whose individual pages may carry a Related questions block. Section
// index pages (the nav/menu targets), hubs, the homepage, reference copies and
// operator surfaces are never edited.
const HOST_SECTIONS = ['faq', 'scenario', 'compare', 'business', 'boarding', 'liability', 'leases', 'state', 'ip', 'disputes', 'therapeutic', 'insights', 'articles', 'whitepapers', 'authority'];
// Endorsement and ranking words a legal-education page never uses (PI/legal
// risk rule, spry brain 1 Nov 2026; horse ruling 1 Nov 2026).
const RISK_WORDS = /\b(best|expert|experts|expertise|specialist|specialists|leading|premier|top-rated|top)\b/i;
const RISK_WORD_ALLOWED = [/\bon top of\b/gi, /\bat the top\b/gi, /\btop of the\b/gi];
const STOP = new Set('a an and are as at be by can do does for from how i if in is it its my of on or the to what when where which who why will with you your'.split(' '));

function read(root, rel) { return fs.readFileSync(path.resolve(root, rel), 'utf8'); }
function readJsonSafe(root, rel, fallback) { try { return JSON.parse(read(root, rel)); } catch { return fallback; } }
function visibleText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
function words(s) { return new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))); }
function overlap(a, b) { let n = 0; for (const w of a) if (b.has(w)) n++; return n / Math.max(1, Math.min(a.size, b.size)); }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// The site's head conventions (attribute order its validators read, icons and
// web manifest), applied to the engine's markup so a question page looks like
// every other page to the sitemap, canonical and favicon checks.
const ICON_LINKS = '<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#5d4634">';
function normalizeHead(html) {
  let out = html
    .replace(/<meta content="([^"]*)" (name|property)="([^"]*)"\/?>/g, '<meta $2="$3" content="$1">')
    .replace(/<link href="([^"]*)" rel="([^"]*)"\/?>/g, '<link rel="$2" href="$1">');
  if (!/rel="icon"/.test(out)) out = out.replace('</head>', `${ICON_LINKS}\n</head>`);
  return out;
}

// FAQ in the site's visible Q&A form (<details open>), and the site's entity
// graph: the same Organization and WebSite nodes every page carries (read from
// the built /about/ page, one source), a WebPage node, and the engine's
// Article/FAQPage/BreadcrumbList pointing at them. FAQPage questions are set
// from the same extractor the JSON-LD validator uses, so they cannot drift.
function siteEntities(distDir) {
  const about = path.join(distDir, 'about', 'index.html');
  if (!fs.existsSync(about)) return [];
  const m = fs.readFileSync(about, 'utf8').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) return [];
  return (JSON.parse(m[1])['@graph'] || []).filter((n) => n['@type'] === 'Organization' || n['@type'] === 'WebSite');
}
function siteShape(html, url, entities) {
  let out = html.replace(/<section class="faq">([\s\S]*?)<\/section>/, (all, inner) => {
    const heading = (inner.match(/<h2>[\s\S]*?<\/h2>/) || [''])[0];
    const pairs = [...inner.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((x) => `<details open><summary>${x[1]}</summary><p>${x[2]}</p></details>`);
    return `<section class="faq">${heading}${pairs.join('')}</section>`;
  });
  const ld = out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ld || !entities.length) return out;
  const doc = JSON.parse(ld[1]);
  const org = entities.find((n) => n['@type'] === 'Organization');
  const site = entities.find((n) => n['@type'] === 'WebSite');
  const graph = (doc['@graph'] || []).map((n) => {
    if (n['@type'] === 'Article') return { ...n, author: { '@id': org['@id'] }, publisher: { '@id': org['@id'] }, isPartOf: { '@id': site['@id'] } };
    if (n['@type'] === 'FAQPage') {
      const visible = extractVisibleFaq(out);
      return { ...n, mainEntity: visible.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })) };
    }
    return n;
  });
  const article = graph.find((n) => n['@type'] === 'Article') || {};
  const webpage = { '@type': 'WebPage', '@id': `${url}#webpage`, name: article.headline, description: article.description, url, isPartOf: { '@id': site['@id'] } };
  doc['@graph'] = [org, site, webpage, ...graph];
  return out.replace(ld[0], `<script type="application/ld+json">${JSON.stringify(doc).replace(/</g, '\\u003c')}</script>`);
}

/** Problems that keep a question page off the live site (empty list = servable). */
function legalProblems(html, forbiddenPhrases) {
  const problems = [];
  const text = visibleText(html);
  const lower = text.toLowerCase();
  if (!html.includes(FOOTER_DISCLAIMER)) problems.push('footer disclaimer missing');
  for (const p of forbiddenPhrases) if (lower.includes(String(p).toLowerCase())) problems.push(`forbidden phrase "${p}"`);
  let scrubbed = text;
  for (const re of RISK_WORD_ALLOWED) scrubbed = scrubbed.replace(re, ' ');
  const m = scrubbed.match(RISK_WORDS);
  if (m) problems.push(`endorsement/ranking word "${m[1]}"`);
  return problems;
}

function listQuestionPages(root) {
  const base = path.join(root, SRC_DIR);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(base, e.name, 'index.html')))
    .map((e) => e.name).sort();
}

function hostCandidates(distDir) {
  const out = [];
  for (const section of HOST_SECTIONS) {
    const dir = path.join(distDir, section);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const file = path.join(dir, e.name, 'index.html');
      if (!fs.existsSync(file)) continue;
      const html = fs.readFileSync(file, 'utf8');
      const route = `/${section}/${e.name}/`;
      const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1] || '';
      if (canonical && !canonical.replace(/\/$/, '').endsWith(route.replace(/\/$/, ''))) continue; // copies of another page
      const title = ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/<[^>]+>/g, '');
      out.push({ file, route, words: words(title) });
    }
  }
  return out.sort((a, b) => a.route.localeCompare(b.route));
}

function withRelatedLink(html, route, anchor) {
  if (html.includes(`href="${route}"`)) return html;
  const li = `<li><a href="${esc(route)}">${esc(anchor)}</a></li>`;
  const re = new RegExp(`${RELATED_START}[\\s\\S]*?${RELATED_END}`);
  const m = html.match(re);
  if (m) {
    if ((m[0].match(/<li>/g) || []).length >= MAX_LINKS_PER_HOST) return null;
    return html.replace(m[0], m[0].replace('</ul>', `${li}</ul>`));
  }
  const block = `${RELATED_START}<section class="search-loop-related"><h2>Related questions</h2><ul>${li}</ul></section>${RELATED_END}\n`;
  for (const marker of ['<section class="routing-block"', '<footer', '</main>']) {
    const i = html.indexOf(marker);
    if (i >= 0) return html.slice(0, i) + block + html.slice(i);
  }
  return null;
}

function stripLinksTo(html, routes) {
  let out = html;
  for (const r of routes) {
    const q = r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`<li><a href="${q}">[\\s\\S]*?</a></li>`, 'g'), '');
  }
  return out;
}

function foldQuestionPages(distDir, { root = process.cwd(), log = console.log } = {}) {
  const slugs = listQuestionPages(root);
  const result = { found: slugs.length, folded: [], held: [], related_links: 0 };
  if (!slugs.length) { writeHolds(root, result.held); return result; }
  const forbidden = (readJsonSafe(root, 'data/system/compliance_rules.json', {}).forbidden_phrases) || [];
  const footer = read(root, FOOTER_PARTIAL).trim();
  const entities = siteEntities(distDir);
  const loopLive = new Set(((readJsonSafe(root, 'data/search-loop/pages.json', {}).pages) || []).filter((p) => p.status === 'live').map((p) => p.route));
  const pages = slugs.map((slug) => {
    const html = fs.readFileSync(path.join(root, SRC_DIR, slug, 'index.html'), 'utf8');
    const served = siteShape(normalizeHead(html.replace(/<footer[\s\S]*?<\/footer>/i, footer)), `${SITE}${URL_PREFIX}${slug}/`, entities);
    const h1 = ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || slug).replace(/<[^>]+>/g, '').trim();
    const route = `${URL_PREFIX}${slug}/`;
    const problems = legalProblems(served, forbidden);
    if (!loopLive.has(route)) problems.unshift('not recorded as live in data/search-loop/pages.json');
    return { slug, route, h1, html: served, problems };
  });
  const held = pages.filter((p) => p.problems.length);
  const live = pages.filter((p) => !p.problems.length);
  const heldRoutes = held.map((p) => p.route);

  // The site's own stylesheet, from the single renderer, for the question pages.
  const about = path.join(distDir, 'about', 'index.html');
  const style = fs.existsSync(about) ? ((fs.readFileSync(about, 'utf8').match(/<style>([\s\S]*?)<\/style>/i) || [])[1] || '') : '';
  fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(distDir, 'assets', 'questions.css'), `${style.trim()}\n.site-header{padding:18px 0}.direct-answer{font-size:1.1rem}.site-action .button{display:inline-block;padding:10px 16px;border-radius:10px;background:var(--accent);color:#fff;text-decoration:none}\n`);

  for (const p of live) {
    const out = path.join(distDir, 'questions', p.slug, 'index.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, stripLinksTo(p.html, heldRoutes));
    result.folded.push(p.route);
  }

  // Never an orphan: each live question page is linked from up to two relevant
  // existing pages (deterministic: best word overlap, then route order).
  const hosts = hostCandidates(distDir);
  const edits = new Map();
  for (const p of live) {
    const qw = words(p.h1);
    const ranked = hosts.map((h) => ({ h, s: overlap(qw, h.words) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.h.route.localeCompare(b.h.route));
    let placed = 0;
    for (const { h } of ranked) {
      if (placed >= HOSTS_PER_PAGE) break;
      const before = edits.get(h.file) ?? fs.readFileSync(h.file, 'utf8');
      const after = withRelatedLink(before, p.route, p.h1);
      if (!after || after === before) continue;
      edits.set(h.file, after);
      placed++;
      result.related_links++;
    }
  }
  for (const [file, html] of edits) fs.writeFileSync(file, html);

  for (const p of held) {
    result.held.push({ route: p.route, problems: p.problems });
    log(`NAMED NOTE [QUESTION_PAGE_LEGAL_HOLD] ${p.route} is not served: ${p.problems.join('; ')}`);
  }
  writeHolds(root, result.held);
  log(`search-loop fold: ${result.found} question page(s), ${result.folded.length} served, ${result.held.length} held, ${result.related_links} related link(s) placed`);
  return result;
}

function writeHolds(root, held) {
  const file = path.join(root, HOLDS_FILE);
  if (!held.length && !fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ rule: 'Question pages kept off the live site by the legal gate in scripts/search_loop/fold_question_pages.js; fixed or replaced by the search loop, never published as they are.', held_count: held.length, held }, null, 2) + '\n');
}

module.exports = { foldQuestionPages, legalProblems, withRelatedLink };

#!/usr/bin/env node
'use strict';
/**
 * Build step: apply data/search_intelligence/strengthening.json to the built pages.
 *
 * Runs at the end of `npm run build`, after every page writer, so one rule
 * reaches home, hub and leaf pages alike. For each entry:
 *   - <title>, og:title and twitter:title become the query-first title;
 *   - the definition paragraph goes directly under the H1 (home keeps its
 *     own #site-definition, pinned by validate_home_definition_speakable);
 *   - a section of question H2s, with the specific facts and their sources,
 *     follows the header (after the quick answer when the page has one);
 *   - the page's visible FAQ becomes the real-query FAQ, and its JSON-LD
 *     carries exactly one FAQPage built from that same FAQ;
 *   - every page in links_from gets a "Most-searched answers" block linking it.
 * Idempotent: marked blocks are replaced, never duplicated.
 */
const fs = require('fs');
const path = require('path');
const { FILES, ROOT, readJson, SITE_ORIGIN } = require('./lib');
const { fitTitle } = require('../lib/meta_text');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fileFor = (dist, route) => path.join(dist, route.replace(/^\//, ''), 'index.html');

function stripMarked(html) {
  return html
    .replace(/<p class="search-definition"[^>]*data-search-definition="true"[^>]*>[\s\S]*?<\/p>\s*/g, '')
    .replace(/<section[^>]*data-search-(strengthening|faq|links)="true"[^>]*>[\s\S]*?<\/section>\s*/g, '');
}

function sectionsHtml(entry) {
  const blocks = entry.sections.map((s) => {
    const paras = (s.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('');
    const list = s.list ? `<ul>${s.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>` : '';
    return `<h2>${esc(s.question)}</h2>${paras}${list}`;
  }).join('\n');
  const facts = `<h2>Key facts and sources</h2><ul class="search-facts">${entry.facts.map((f) => `<li>${esc(f.fact)} <span class="muted">(${esc(f.source)})</span></li>`).join('')}</ul>`;
  return `<section class="search-strengthening" data-search-strengthening="true">\n${blocks}\n${facts}\n</section>\n`;
}

/**
 * A page that already had an FAQ zone keeps the accordion form (its quick answer
 * and signal block sit above it, as validate_ingestion requires of accordions).
 * A page without one (home, hubs) gets open <details> Q&A without the accordion
 * marker, which render_page's extractVisibleFaq still reads as visible Q&A.
 */
function faqHtml(entry, accordion) {
  if (!accordion) {
    const items = entry.faq.map((f) => `<details class="search-faq-item" open><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('\n');
    return `<section class="search-faq" data-search-faq="true"><h2>Questions people search</h2>\n${items}\n</section>\n`;
  }
  const items = entry.faq.map((f, i) => `<details data-accordion="true" data-accordion-purpose="faq-only"${i === 0 ? ' open' : ''}><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('\n');
  return `<section class="accordion-section faq-accordion" data-accordion="true" data-accordion-purpose="faq-only" data-editable-zone="faq_block" data-search-faq="true"><h2>Questions people search</h2>\n${items}\n</section>\n`;
}

function faqNode(entry) {
  return {
    '@type': 'FAQPage', '@id': `${SITE_ORIGIN}${entry.route}#faq`,
    mainEntity: entry.faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } }))
  };
}

/** Remove every FAQPage node from every JSON-LD block, then add ours to the first block. */
function setFaqJsonLd(html, entry) {
  let added = false;
  const out = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (m, json) => {
    let doc;
    try { doc = JSON.parse(json); } catch { return m; }
    const isFaq = (n) => n && (n['@type'] === 'FAQPage' || (Array.isArray(n['@type']) && n['@type'].includes('FAQPage')));
    if (Array.isArray(doc['@graph'])) doc['@graph'] = doc['@graph'].filter((n) => !isFaq(n));
    else if (isFaq(doc)) return '';
    if (!added && Array.isArray(doc['@graph'])) { doc['@graph'].push(faqNode(entry)); added = true; }
    return `<script type="application/ld+json">${JSON.stringify(doc)}</script>`;
  });
  if (added) return out;
  return out.replace('</head>', `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...faqNode(entry) })}</script>\n</head>`);
}

function insertBeforeTail(html, block) {
  for (const marker of ['<section class="cluster-links"', '<section class="routing-block"', '<footer']) {
    const i = html.lastIndexOf(marker);
    if (i >= 0) return html.slice(0, i) + block + html.slice(i);
  }
  return html.replace('</main>', `${block}</main>`);
}

function applyEntry(html, entry) {
  let out = stripMarked(html);
  const title = esc(fitTitle(entry.title));
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`);
  if (entry.definition) out = out.replace(/<\/h1>/, `</h1>\n  <p class="search-definition" data-search-definition="true">${esc(entry.definition)}</p>`);
  // Question H2s: after the quick answer block when present, else after the header holding the H1.
  const h1 = out.indexOf('<h1');
  const quick = out.indexOf('data-editable-zone="quick_answer_block"', h1);
  let at;
  if (quick > 0) at = out.indexOf('</section>', quick) + '</section>'.length;
  else { const close = out.indexOf('</header>', h1); at = close > 0 ? close + '</header>'.length : out.indexOf('</h1>') + 5; }
  out = `${out.slice(0, at)}\n${sectionsHtml(entry)}${out.slice(at)}`;
  // Visible FAQ: replace the page's FAQ zone, else add one.
  const faqRe = /<section[^>]*data-editable-zone="faq_block"[^>]*>[\s\S]*?<\/section>\s*/;
  out = faqRe.test(out) ? out.replace(faqRe, faqHtml(entry, true)) : insertBeforeTail(out, faqHtml(entry, false));
  return setFaqJsonLd(out, entry);
}

function linksBlock(entries) {
  const items = entries.map((e) => `<li><a href="${esc(e.route)}">${esc(e.title)}</a></li>`).join('');
  return `<section class="search-strengthened-links" data-search-links="true"><h2>Most-searched answers</h2><ul>${items}</ul></section>\n`;
}

function applyAll(dist = path.join(ROOT, 'dist'), doc = readJson(FILES.strengthening, { pages: [] })) {
  const applied = [];
  for (const entry of doc.pages || []) {
    const file = fileFor(dist, entry.route);
    if (!fs.existsSync(file)) throw new Error(`strengthening: ${entry.route} is not in the build (${path.relative(ROOT, file)})`);
    fs.writeFileSync(file, applyEntry(fs.readFileSync(file, 'utf8'), entry));
    applied.push(entry.route);
  }
  const linkTargets = new Map();
  for (const entry of doc.pages || []) for (const from of entry.links_from || []) {
    if (!linkTargets.has(from)) linkTargets.set(from, []);
    linkTargets.get(from).push(entry);
  }
  for (const [from, entries] of linkTargets) {
    const file = fileFor(dist, from);
    if (!fs.existsSync(file)) throw new Error(`strengthening: link source ${from} is not in the build`);
    let html = fs.readFileSync(file, 'utf8').replace(/<section[^>]*data-search-links="true"[^>]*>[\s\S]*?<\/section>\s*/g, '');
    fs.writeFileSync(file, insertBeforeTail(html, linksBlock(entries)));
  }
  return { applied, link_sources: [...linkTargets.keys()] };
}

module.exports = { applyEntry, applyAll, faqNode };
if (require.main === module) {
  const r = applyAll();
  console.log(`strengthening: applied to ${r.applied.length} page(s) [${r.applied.join(', ')}]; links from ${r.link_sources.join(', ') || 'none'}`);
}

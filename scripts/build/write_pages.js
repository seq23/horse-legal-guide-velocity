const fs = require('fs');
const path = require('path');
const { renderLayout } = require('../lib/render_page');
const { resolveCanonicalTarget } = require('../lib/resolve_canonical_targets');
const { loadPageContent } = require('../lib/content_loader');
const { renderModule, comparisonSides, quickAnswerForPage } = require('../lib/answer_shape');
const { validatePostRenderPage } = require('./validate_page_contract_post_render');
const { findManifest, loadPatchForManifest, loadPatchForSlug, applyZoneOperations } = require('../lib/page_patch_utils');

function ensureDir(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function esc(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function titleCase(value) { return String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
function readJson(rel, fallback) { try { return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')); } catch { return fallback; } }
function unique(list) { return [...new Set((list || []).filter(Boolean))]; }

function formatRelatedLinks(relatedPages = [], fallbackPages = []) {
  const combined = [...relatedPages];
  for (const page of fallbackPages.slice(0, 5)) combined.push(`${page.title} (${page.slug})`);
  const clean = unique(combined).slice(0, 6);
  if (!clean.length) return '';
  const items = clean.map((item) => {
    const alt = String(item).match(/^(.*)\s+\((\/.*\/?)\)$/);
    if (!alt) return `<li>${esc(item)}</li>`;
    return `<li><a href="${esc(alt[2])}">${esc(alt[1])}</a></li>`;
  }).join('\n');
  return `<section data-editable-zone="related_links_block"><h2>Related pages in this cluster</h2><ul>${items}</ul></section>`;
}

function clusterContext(cluster) {
  const map = {
    'horse-sale-and-purchase': 'horse sale, purchase, disclosure, deposit, refund, title transfer, and pre-purchase-exam problems',
    'horse-lease-and-trial': 'lease, trial, lease-to-own, possession, expense, injury, and early-termination questions',
    'boarding-training-and-barn-operations': 'boarding, training, barn operations, emergency authority, payment, care, and property disputes',
    'liability-waivers-insurance': 'liability, waivers, insurance, warning signs, injuries, and equine activity statute questions',
    'equine-business-formation': 'LLCs, business formation, partnership, syndicate, and asset-separation questions',
    'intellectual-property-and-brand': 'trademarks, sponsorships, image rights, barn names, and equestrian brand questions',
    'demand-letters-and-disputes': 'demand letters, informal disputes, mediation, litigation, and response strategy questions',
    'therapeutic-riding-and-hipaa': 'therapeutic riding, equine-assisted services, privacy, consent, and program-risk questions',
    'real-property-and-leases': 'facility leases, pasture leases, property control, repairs, improvements, and real-estate use questions',
    'state-specific': 'state-by-state equine law, warning language, waiver, venue, and jurisdiction questions',
    'emotional-am-i-screwed': 'panic-stage questions where the reader needs to separate fear from documents, facts, and next actions'
  };
  return map[cluster] || 'horse-world legal questions where facts, documents, and jurisdiction matter';
}

function applyPersistedPatchIfPresent(page, html) {
  const manifest = findManifest(page.slug);
  const patch = manifest ? loadPatchForManifest(manifest) : loadPatchForSlug(page.slug, page.slug && page.slug.startsWith('/reference/') ? 'reference' : 'page');
  if (!patch || !Array.isArray(patch.operations) || !patch.operations.length) return html;
  return applyZoneOperations(html, patch.operations);
}

function loadSignalIndexes() {
  const raw = readJson('data/community/raw_signals.json', []);
  const normalized = readJson('data/community/normalized_signals.json', []);
  const rawById = new Map(raw.map((s) => [s.signal_id, s]));
  const normBySlug = new Map();
  for (const n of normalized) {
    if (!n.mapped_slug) continue;
    if (!normBySlug.has(n.mapped_slug)) normBySlug.set(n.mapped_slug, []);
    normBySlug.get(n.mapped_slug).push(n);
  }
  return { rawById, normBySlug };
}

function querySet(page, norms) {
  const qs = [];
  if (page.primary_query) qs.push(page.primary_query);
  for (const q of page.supporting_queries || []) qs.push(q);
  for (const n of norms || []) qs.push(n.normalized_query);
  return unique(qs).slice(0, 7);
}

function signalBlock(page, queries, rawSignals) {
  const sourceCount = unique(rawSignals.map((s) => s.source_key)).length;
  const items = queries.slice(0, 5).map((q) => `<li>${esc(q)}</li>`).join('\n');
  return `<section class="signal-block">
  <span class="eyebrow">Signal-driven page</span>
  <h2>Real question patterns this page is built around</h2>
  <p>This page is mapped to ${esc(page.cluster || 'general')} and is written around public question-pattern metadata, not copied posts or private messages.</p>
  <ul>${items}</ul>
  <p class="muted">Traceability: ${esc(String(rawSignals.length))} source signal${rawSignals.length === 1 ? '' : 's'} across ${esc(String(sourceCount || 1))} approved source lane${sourceCount === 1 ? '' : 's'}.</p>
</section>`;
}

function accordion(items, title) {
  if (!items.length) return '';
  const details = items.map((item, idx) => `<details data-accordion="true" data-accordion-purpose="faq-only" ${idx === 0 ? 'open' : ''}><summary>${esc(item.question)}</summary><p>${esc(item.answer)}</p></details>`).join('\n');
  return `<section class="accordion-section faq-accordion" data-accordion="true" data-accordion-purpose="faq-only" data-editable-zone="faq_block"><h2>${esc(title)}</h2>${details}</section>`;
}

function faqItems(page, queries, clusterPhrase) {
  const q = queries.length ? queries : [page.title];
  return q.slice(0, 5).map((question, idx) => ({
    question,
    answer: idx === 0
      ? `Start with the documents, dates, messages, payment trail, and the state where the horse-related activity happened. The answer usually depends on those facts, not on a generic rule pulled from another situation.`
      : `This question belongs to the ${clusterPhrase} cluster. The useful move is to identify the exact agreement, who had control, what changed, and whether the written record matches what each side says happened.`
  }));
}

function comparisonBody(page, queries, clusterPhrase) {
  const sides = comparisonSides(page);
  return `<section><h2>Bottom-line decision</h2><p>People land on this page because they need to choose between <strong>${esc(sides.left)}</strong> and <strong>${esc(sides.right)}</strong>, not because they want two abstract definitions. The useful move is to match the document to who controls the horse-world relationship, who carries the downside, and what happens if the relationship breaks.</p></section>
<section><h2>Best fit / worst fit</h2><table><thead><tr><th>Decision lane</th><th>How to think about it</th></tr></thead><tbody><tr><td>Best fit for ${esc(sides.left)}</td><td>Use it when the parties want a narrower role, a simpler responsibility split, or a shorter factual commitment that does not quietly turn into a bigger deal later.</td></tr><tr><td>Best fit for ${esc(sides.right)}</td><td>Use it when the relationship needs broader authority, clearer ownership or control language, stronger payment logic, and a more durable written framework.</td></tr><tr><td>Worst fit for either one</td><td>Both fail when the paperwork says one thing but the real horse-world arrangement works another way in practice.</td></tr></tbody></table></section>
<section><h2>What usually decides the comparison</h2><ul><li>who controls the horse, property, business, or decision rights</li><li>what money changes hands and when</li><li>what happens if the horse is injured, the deal ends early, or the facts change</li><li>which promises are actually written down</li><li>whether state-specific rules change notice, liability, venue, or enforceability</li></ul></section>
<section><h2>Practical verdict</h2><p>The better choice is usually the one that reduces later confusion about control, payment, responsibility, exit rights, and proof. If ${esc(sides.left)} only works when everyone stays friendly, and ${esc(sides.right)} works when the facts get messy, that usually tells you which structure is safer.</p></section>`;
}

function scenarioBody(page, queries, clusterPhrase) {
  return `<section><h2>What matters first</h2><p>This is a ${esc(clusterPhrase)} scenario, which means the real work is triage. Before you argue about blame, figure out what lane you are actually in: ownership, payment, care, injury, disclosure, control, authority, or state-specific compliance. Most bad outcomes happen because people respond emotionally before they classify the problem correctly.</p></section>
<section><h2>Fast triage framework</h2><table><thead><tr><th>Question</th><th>Why it matters</th></tr></thead><tbody><tr><td>What document controls this?</td><td>If there is a signed agreement, invoice, waiver, policy, text chain, bill of sale, or notice, that usually matters more than memory.</td></tr><tr><td>What changed hands?</td><td>Money, possession, care, transport, emergency authority, and title transfer often determine which side carries the immediate risk.</td></tr><tr><td>What happened first?</td><td>Sequence matters. The timeline often decides whether this is a misunderstanding, a contract problem, a care issue, or an escalation problem.</td></tr><tr><td>What state rules may change the answer?</td><td>Venue, warning language, lien rights, waiver rules, and equine activity statutes can change the practical analysis fast.</td></tr></tbody></table></section>
<section><h2>What to gather before you act</h2><ul><li>the controlling agreement, form, waiver, invoice, or bill of sale</li><li>texts, emails, screenshots, and payment records</li><li>photos, vet records, boarding logs, or incident notes if care or injury is involved</li><li>a short dated timeline of what happened and when</li><li>the exact demand, threat, refusal, or deadline now on the table</li></ul></section>
<section><h2>What not to do</h2><ul><li>do not post accusations publicly before you preserve the private record</li><li>do not make a new promise just to calm the situation down</li><li>do not treat a horse-world custom like a written legal rule</li><li>do not assume the loudest issue is the real issue</li></ul></section>
<section><h2>Practical next move</h2><p>The next move is usually to stabilize the record, identify the governing lane, and respond in writing with a cleaner factual position. If the other side is escalating fast, your job is to get organized first, not dramatic first.</p></section>`;
}

function faqBody(page, queries, clusterPhrase) {
  return `<section><h2>Bottom line</h2><p>This question comes up because horse-world deals often get treated like they can run on trust, memory, or custom. They usually cannot. The useful answer starts with the controlling document, the real timeline, what money, care, possession, or authority changed hands, and which state-specific rule could change the result.</p></section>
<section><h2>What usually decides the answer</h2><ul><li>what the signed document, bill of sale, waiver, lease, invoice, text chain, or policy actually says</li><li>whether the written record matches what each side says was promised</li><li>who had control of the horse, property, business decision, or emergency call when the issue arose</li><li>whether state law changes warning language, waiver scope, notice requirements, venue, or lien rights</li></ul></section>
<section><h2>Practical answer framework</h2><p>For ${esc(clusterPhrase)}, the wrong move is to treat this like a generic internet FAQ. The right move is to answer from the paper trail first, then the facts on the ground, then the state-specific rule set. That order is what usually separates a useful answer from a misleading one.</p></section>`;
}

function defaultBody(page, queries, clusterPhrase) {
  if (page.page_type === 'comparison') return comparisonBody(page, queries, clusterPhrase);
  if (page.page_type === 'scenario') return scenarioBody(page, queries, clusterPhrase);
  return faqBody(page, queries, clusterPhrase);
}

function routingBlock(canonical) {
  return `<section class="routing-block" data-editable-zone="routing_block">
  <p>Situations like this depend heavily on the specific facts, documents, and jurisdiction.</p>
  <p><strong>Wise Covington PLLC is a law firm built by equestrians for the equestrian community.</strong></p>
  <p>This page is educational only and does not provide legal advice or create an attorney-client relationship.</p>
  <p><a href="${canonical}">Learn more here</a>.</p>
</section>`;
}

function writeApprovedPages(distDir, approvedPages) {
  const canonical = resolveCanonicalTarget();
  const { rawById, normBySlug } = loadSignalIndexes();
  const byCluster = approvedPages.reduce((acc, p) => { (acc[p.cluster] ||= []).push(p); return acc; }, {});
  const results = [];
  approvedPages.forEach((page) => {
    const finalDir = path.join(distDir, page.slug.replace(/^\//, ''));
    ensureDir(finalDir);
    const content = loadPageContent(page.slug) || {};
    const norms = normBySlug.get(page.slug) || [];
    const signals = unique([...(page.source_signal_ids || []), ...norms.flatMap((n) => n.source_signal_ids || [])]).map((id) => rawById.get(id)).filter(Boolean);
    const queries = querySet(page, norms);
    const clusterPhrase = clusterContext(page.cluster);
    const related = (byCluster[page.cluster] || []).filter((p) => p.slug !== page.slug && p.review_status === 'approved').slice(0, 6);
    const answerShape = renderModule(page);
    const rawQuick = String(content.quick_answer || page.quick_answer || '').trim();
    const normalizedQuick = rawQuick.replace(/^short answer:\s*/i, '');
    const hedgedQuick = /^(generally|usually|it depends|depends|often)\b/i.test(normalizedQuick);
    const quick = (!rawQuick || hedgedQuick)
      ? quickAnswerForPage(page)
      : rawQuick;
    let body = `
<header class="content-header">
  <span class="eyebrow">${esc(titleCase(page.page_type))} page</span>
  <h1>${esc(page.title)}</h1>
  <p class="muted">General educational information for equestrians, horse owners, trainers, investors, and equine businesses. This page is not a substitute for advice on a specific situation.</p>
</header>
<section class="quick-answer-block" data-answer-summary="true" data-editable-zone="quick_answer_block">
  <h2>Quick answer</h2>
  <p><strong>Short answer:</strong> ${esc(quick)}</p>
</section>
${answerShape.html.replace('<section class="answer-shape-module"', '<section class="answer-shape-module" data-editable-zone="top_answer_module"')}
${signalBlock(page, queries, signals)}
${defaultBody(page, queries, clusterPhrase)}
<section>
  <h2>Common mistakes</h2>
  <ul><li>treating a text-message understanding like a complete contract</li><li>ignoring state-specific rules, warning language, or venue issues</li><li>copying a template without matching it to the real horse, barn, sale, lease, sponsor, or business arrangement</li><li>posting accusations publicly before preserving the private record</li></ul>
</section>
<section>
  <h2>What to do next</h2>
  <p>Collect the contract, messages, invoices, payment records, registration or transfer records, vet records if relevant, insurance documents if relevant, and a short timeline. Then evaluate the next move with the exact state and facts in mind.</p>
</section>
${accordion(faqItems(page, queries, clusterPhrase), 'Signal-backed FAQ')}
${formatRelatedLinks(content.related_pages, related)}
<nav><p><a href="/">Home</a> · <a href="/hubs/${esc(page.cluster)}/">Back to ${esc(titleCase(page.cluster))}</a> · <a href="/reference/">Reference index</a></p></nav>
${routingBlock(canonical)}`;
    body = applyPersistedPatchIfPresent(page, body);
    const html = renderLayout({
      title: page.title,
      description: quick.slice(0, 155),
      url: page.slug,
      body,
      schemaType: page.page_type === 'faq' ? 'FAQPage' : 'Article'
    });
    const filePath = path.join(finalDir, 'index.html');
    fs.writeFileSync(filePath, html);
    results.push({
      page,
      filePath,
      html,
      queryFamily: answerShape.queryFamily,
      moduleType: answerShape.moduleType,
      validation: validatePostRenderPage({ page, filePath, html })
    });
  });
  return results;
}

module.exports = { writeApprovedPages };

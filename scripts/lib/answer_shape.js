const fs = require('fs');
const path = require('path');

function readJson(rel, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8'));
  } catch {
    return fallback;
  }
}

const familyMap = readJson('data/system/query_family_to_shape_map.json', {});
const { lensesFor, joinLabels } = require('./topic_lenses');

// Comparison and scenario pages: the rows come from the page's own lenses
// (scripts/lib/topic_lenses.js), so no two pages share one paragraph set with
// only the names swapped in (Search Readiness q1, 17 Nov 2026).
function isLensPage(page) {
  return ['comparison', 'scenario'].includes(String(page.page_type || '').toLowerCase());
}
function lensRows(page) {
  return lensesFor(page).map((l) => [l.ask, l.check]);
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sentenceCase(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(text) {
  return sentenceCase(text).toLowerCase();
}

function detectQueryFamily(page) {
  const pageType = String(page.page_type || '').toLowerCase();
  if (pageType === 'comparison') return 'comparison';
  const text = normalizeText([page.primary_query, ...(page.supporting_queries || []), page.title].join(' | '));
  for (const [family, config] of Object.entries(familyMap)) {
    const patterns = (config.query_patterns || []).map(normalizeText);
    if (patterns.some((pattern) => pattern && text.includes(pattern))) return family;
  }
  if (pageType === 'scenario') return 'eligibility_or_claim';
  return 'choose_or_best';
}

function requiredTopModuleForFamily(family) {
  return familyMap[family]?.required_top_module || 'top_checklist';
}

// The title ("Demand Letter vs Lawsuit") names the two sides cleanly; the
// primary query wraps them in a question ("How should someone compare demand
// letter vs lawsuit in an equine legal situation?"), and splitting that on "vs"
// put the whole question into the published answer: "How should someone
// compare demand letter and lawsuit in an equine legal situation? are not
// interchangeable." Try the title first and strip the question frame.
function comparisonSides(page) {
  for (const source of [page.title, page.primary_query]) {
    const raw = String(source || '')
      .replace(/^\s*how (?:should|do|can) (?:someone|i|you|we) compare\s+/i, '')
      .replace(/\s+(?:in|for) an? [^?]*\?*\s*$/i, '')
      .replace(/[?.!]+\s*$/, '')
      .trim();
    const match = raw.split(/\s+vs\.?\s+/i);
    if (match.length >= 2 && match[0] && match[1]) {
      return { left: sentenceCase(match[0]), right: sentenceCase(match.slice(1).join(' vs ')) };
    }
    // "Do I need both a waiver and insurance ..." published "option one and
    // option two are not interchangeable" before this.
    const both = raw.match(/\bboth\s+(.+?)\s+and\s+(.+)$/i);
    if (both) return { left: sentenceCase(both[1]).replace(/^\w/, (c) => c.toUpperCase()), right: sentenceCase(both[2]) };
  }
  return { left: 'option one', right: 'option two' };
}

function checklistItems(page, clusterPhrase) {
  return [
    'Identify the controlling document, email trail, invoice, waiver, or policy before arguing about conclusions.',
    'Match the real-world facts to the issue: money, possession, horse care, disclosure, injury, authority, or timing.',
    'Confirm which state law, venue, or equine-activity rule may change the answer.',
    'Separate what was promised verbally from what can actually be proved in writing.',
    `Use this page as a ${clusterPhrase} screening tool, then hand off fact-specific analysis to the canonical law-firm surface.`
  ];
}

function redFlagItems(page) {
  return [
    'The document uses broad language but never explains who pays, who decides, or who carries the risk.',
    'Important promises were made in texts or calls but never moved into the signed document.',
    'The page-specific scenario turns on state law, but the paperwork reads like a generic internet template.',
    'Money, care, training authority, transport, or emergency decisions are left vague.',
    'One side is pushing for speed while resisting written clarification.'
  ];
}

function comparisonRows(page) {
  const sides = comparisonSides(page);
  const lenses = lensesFor(page);
  return [
    ...lenses.map((l) => [l.ask, l.check]),
    ['Before choosing', `Check whether ${sides.left} or ${sides.right}, as written, answers each question above for the real arrangement.`]
  ];
}

function costRows(page) {
  return [
    ['Base issue', 'What payment, refund, boarding charge, sale price, care cost, or damages number is actually in dispute?'],
    ['What drives variance?', 'Contract terms, emergency decisions, timing, mitigation, proof, and state-law remedies can all move the number.'],
    ['What people forget', 'Extra costs often come from transport, vet care, delay, replacement decisions, storage, or escalation costs.'],
    ['What to document', 'Invoices, texts, vet records, photos, boarding logs, and timeline notes usually matter more than opinions.']
  ];
}

function timelineRows(page) {
  return [
    ['Phase 1 — stabilize facts', 'Identify the horse, people, date, documents, payments, and any immediate care or possession problem.'],
    ['Phase 2 — preserve the record', 'Save texts, emails, invoices, photos, contracts, waivers, and any public statements.'],
    ['Phase 3 — frame the issue', 'Decide whether the conflict is about sale, boarding, lease, liability, payment, care, or business authority.'],
    ['Phase 4 — choose the next move', 'That may mean clarifying in writing, sending a formal notice, negotiating, or escalating to counsel.']
  ];
}

function decisionRows(page) {
  return [
    ['Yes', 'You may have a real issue if the facts, documents, and written promises line up clearly in your favor.'],
    ['No', 'You may not have a strong path if the key promise was never documented or the risk was clearly assigned against you.'],
    ['It depends', 'Most horse-world disputes hinge on the exact agreement, the written record, and the state-specific rule set.']
  ];
}

function scriptRows(page) {
  return [
    ['What document actually controls this situation?', 'A strong answer points to a specific signed document, clause, or written policy.'],
    ['What happens if the facts change fast?', 'A strong answer explains notice, emergency authority, payment, and decision rights.'],
    ['Where does the risk sit if something goes wrong?', 'A strong answer allocates responsibility instead of staying vague.'],
    ['What would you want preserved in writing right now?', 'A strong answer focuses on the paper trail, not verbal assumptions.']
  ];
}

function quickAnswerForPage(page) {
  const pageType = String(page.page_type || '').toLowerCase();
  if (pageType === 'comparison') {
    const { left, right } = comparisonSides(page);
    return `Short answer: ${left} and ${right} are not interchangeable. ${lensesFor(page)[0].check}`;
  }
  if (pageType === 'scenario') {
    return `Short answer: Do not guess; start from the record. ${lensesFor(page)[0].check}`;
  }
  const stem = sentenceCase(page.primary_query || page.title);
  return `Short answer: ${stem} is rarely answered by vibe or horse-world custom alone. Start with the controlling document, the real timeline, what changed hands, and the state-specific rule that actually governs the relationship, then answer from there.`;
}

function verdictText(page) {
  return quickAnswerForPage(page);
}

function renderModule(page) {
  const family = detectQueryFamily(page);
  const moduleType = requiredTopModuleForFamily(family);
  const clusterPhrase = String(page.cluster || 'horse legal').replace(/-/g, ' ');
  const titleMap = {
    top_checklist: 'Decision checklist',
    top_red_flags_block: 'Red flags to look for first',
    top_comparison_table: 'Fast comparison table',
    top_cost_table: 'Cost and value drivers',
    top_timeline: 'Timeline and process map',
    top_decision_tree: 'Yes / no / depends',
    top_question_script: 'Questions to ask before acting',
    top_verdict_block: 'Bottom-line verdict'
  };
  let inner = '';
  if (isLensPage(page)) {
    // The marker stays the family's module type; the rows are the page's own.
    const head = String(page.page_type).toLowerCase() === 'comparison' ? ['Decision lens', 'What to check'] : ['Question to settle', 'What to check'];
    const rows = String(page.page_type).toLowerCase() === 'comparison' ? comparisonRows(page) : lensRows(page);
    inner = `<table><thead><tr><th>${head[0]}</th><th>${head[1]}</th></tr></thead><tbody>${rows.map(([a,b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`;
  } else if (moduleType === 'top_checklist') {
    inner = `<ol>${checklistItems(page, clusterPhrase).map((item) => `<li>${esc(item)}</li>`).join('')}</ol>`;
  } else if (moduleType === 'top_red_flags_block') {
    inner = `<ul>${redFlagItems(page).map((item) => `<li><strong>Red flag:</strong> ${esc(item)}</li>`).join('')}</ul>`;
  } else if (moduleType === 'top_comparison_table') {
    inner = `<table><thead><tr><th>Decision lens</th><th>What matters</th></tr></thead><tbody>${comparisonRows(page).map(([a,b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`;
  } else if (moduleType === 'top_cost_table') {
    inner = `<table><thead><tr><th>Cost lens</th><th>What matters</th></tr></thead><tbody>${costRows(page).map(([a,b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`;
  } else if (moduleType === 'top_timeline') {
    inner = `<table><thead><tr><th>Phase</th><th>What happens</th></tr></thead><tbody>${timelineRows(page).map(([a,b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`;
  } else if (moduleType === 'top_decision_tree') {
    inner = `<table><thead><tr><th>Answer path</th><th>How to think about it</th></tr></thead><tbody>${decisionRows(page).map(([a,b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`;
  } else if (moduleType === 'top_question_script') {
    inner = `<table><thead><tr><th>Question to ask</th><th>What a strong answer sounds like</th></tr></thead><tbody>${scriptRows(page).map(([a,b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`;
  } else {
    inner = `<p>${esc(verdictText(page))}</p>`;
  }
  return {
    queryFamily: family,
    moduleType,
    html: `<section class="answer-shape-module" data-answer-shape="${esc(moduleType)}" data-query-family="${esc(family)}"${isLensPage(page) ? ` data-checks="${esc(lensesFor(page).map((l) => l.label).join('|'))}"` : ''}><span class="eyebrow">Answer-first module</span><h2>${esc(isLensPage(page) && String(page.page_type).toLowerCase() === 'scenario' ? 'Which questions settle this situation?' : (titleMap[moduleType] || 'Answer-first module'))}</h2>${inner}</section>`
  };
}

module.exports = { detectQueryFamily, requiredTopModuleForFamily, renderModule, comparisonSides, quickAnswerForPage };

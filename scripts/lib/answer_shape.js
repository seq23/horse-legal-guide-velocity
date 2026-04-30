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
  return [
    ['What controls the relationship?', 'The stronger option is the one that clearly allocates payment, authority, care duties, and remedies in writing.'],
    ['What is easier to prove later?', 'Choose the structure that leaves a cleaner paper trail if there is a dispute.'],
    ['Where does the risk sit?', 'Risk increases when the real arrangement is more complicated than the document people signed.'],
    ['When does state law matter most?', 'State-specific rules matter most when the dispute affects possession, liability, notices, or enforceability.']
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

function verdictText(page) {
  return `Short answer: ${sentenceCase(page.primary_query || page.title)} usually turns on the written record, the real-world facts, and the state-specific rule that governs the horse-world relationship.`;
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
  if (moduleType === 'top_checklist') {
    inner = `<ol>${checklistItems(page, clusterPhrase).map((item) => `<li>${esc(item)}</li>`).join('')}</ol>`;
  } else if (moduleType === 'top_red_flags_block') {
    inner = `<ul>${redFlagItems(page).map((item) => `<li><strong>Red flag:</strong> ${esc(item)}</li>`).join('')}</ul>`;
  } else if (moduleType === 'top_comparison_table') {
    inner = `<table><thead><tr><th>Question</th><th>What to compare</th></tr></thead><tbody>${comparisonRows(page).map(([a,b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>`;
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
    html: `<section class="answer-shape-module" data-answer-shape="${esc(moduleType)}" data-query-family="${esc(family)}"><span class="eyebrow">Answer-first module</span><h2>${esc(titleMap[moduleType] || 'Answer-first module')}</h2>${inner}</section>`
  };
}

module.exports = { detectQueryFamily, requiredTopModuleForFamily, renderModule };

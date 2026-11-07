'use strict';
/** Intent-based writing slots shared by query pages and editorial pages.
 * Nothing reaches a public page until this ONE change is approved in /admin/.
 * No URL allowlist, sampled-page patch, invented reviewer or rolling date.
 */
const { changeApproved, readQueue } = require('./site_changes');
const CHANGE = 'search-quality-2026w45';
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = s => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const NC = 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/';
const intents = [
  {
    id: 'purchase-contract', match: /(?:need.*contract.*buy.*horse|contract.*horse.*purchase)/i,
    lead: 'A horse purchase contract is the written record of the buyer’s and seller’s agreement about a particular horse. It separates the price and payment terms from promises about condition, suitability, trial rights and delivery. Without that distinction, a buyer may mistake a sales conversation for a promise the seller actually accepted.',
    heading: 'What should the buyer settle before paying?',
    paragraphs: [
      'Identify the horse precisely, including registered name or number where available. Name the actual seller and check who can sign for an owner or business. A trainer arranging the sale and the person entitled to sell the horse may be different people.',
      'Record whether the payment is a deposit or the balance, where it goes, and what event makes it refundable or nonrefundable. Put any trial arrangement, return option and delivery condition in the agreement rather than assuming the payment receipt explains them.',
      'A pre-purchase examination records a veterinary assessment. It does not write the purchase terms for the parties. If a finding affects the decision to buy, record what the parties agree to do about it before treating the transaction as complete.'
    ],
    rows: [['Horse identity', 'Match the contract description to registration and identification records.'], ['Seller’s promises', 'Distinguish an express statement about the horse from the buyer’s intended use.'], ['Examination and trial', 'Record permitted use, decision date and any agreed return process.'], ['Delivery and loss', 'Identify the handover point, transporter and agreed insurance arrangements.']],
    question: 'Does a missing signature mean there is no agreement?',
    answer: 'That conclusion needs the governing law and the transaction record. North Carolina’s statute on sales of goods includes writing requirements and exceptions; payment, acceptance and other circumstances can matter. Do not assume every state or every horse transaction is resolved by the same rule.',
    source: NC + 'Chapter_25/GS_25-2-201.html', sourceLabel: 'North Carolina sales-of-goods writing requirements (a state-specific example)'
  },
  {
    id: 'lease-unsoundness', match: /(?:leased horse.*unsound|unsound.*leased horse)/i,
    lead: 'An unsound leased horse is a horse whose condition may prevent the use agreed in the lease. Who pays is a separate question from who owns it: the lease may distinguish routine care, emergency treatment, insurance and loss of use. Start with the condition’s timing and the actual expense clauses, rather than assigning every bill to one party.',
    heading: 'Which records separate treatment from payment responsibility?',
    paragraphs: [
      'Keep the horse’s immediate care separate from the disagreement over reimbursement. Record the veterinary findings, when signs first appeared, who noticed them and who authorized treatment. A condition discovered during a lease is not, by itself, a complete explanation of when or why it arose.',
      'Read routine-care and emergency-care provisions separately. Identify any limits on treatment authority, the agreed notification route and any instruction about consulting the owner. Compare those terms with what actually happened, including messages and invoices.',
      'Look for provisions addressing an unusable horse, suspension of payments, return transport and early termination. A clause assigning veterinary bills does not necessarily answer whether the lease continues. Avoid treating a payment dispute as permission to abandon the horse or stop necessary care.'
    ],
    rows: [['Before the lease', 'Collect the condition report, examination and any disclosed limitations.'], ['At the first sign', 'Preserve dated observations and the veterinary assessment.'], ['When care was authorized', 'Identify the decision maker, notice given and expense clause.'], ['If riding stops', 'Check loss-of-use, termination, transport and insurance provisions separately.']],
    question: 'Does insurance decide who owes the veterinary bill?',
    answer: 'An insurance policy and a lease answer different questions. Check the policy’s insured parties, reporting conditions and coverage terms alongside the lease’s expense allocation. An expected claim payment is not proof that a particular bill is covered or that the parties agreed who carries an uninsured balance.',
    source: 'https://wisecovington.com', sourceLabel: 'Wise Covington PLLC — fact-specific equine-law questions'
  },
  {
    id: 'demand-letter', match: /received.*demand letter|demand letter.*what.*(?:first|do)/i,
    lead: 'A demand letter is a written request that another party take an action, make a payment or resolve a dispute. Receiving one about a horse is different from receiving court papers. Identify the sender, the requested response and any accompanying documents before deciding whether a reply, insurance notification or legal review is needed.',
    heading: 'What should be checked before a reply is drafted?',
    paragraphs: [
      'Save the original letter, envelope, attachments and delivery record. Identify who sent it and for whom they claim to act. Separate the requested payment or action from the allegations offered to justify it; each allegation may need a different document or factual response.',
      'Check whether court documents accompanied the letter. A date requested by a correspondent and a deadline associated with court process are different things. Do not use a general article to calculate a response deadline: the actual papers, jurisdiction and method of service matter.',
      'Build a private chronology from the sale, lease, boarding or training records. Mark what is documented, what is disputed and what is still unknown. Preserve messages and attachments in their original form. Avoid replacing those records with a social-media argument about the dispute.'
    ],
    rows: [['Sender and recipient', 'Confirm the parties and any claimed representative.'], ['Requested action', 'Separate money, return of the horse, documents and other demands.'], ['Supporting record', 'Match each allegation to the agreement, communications and invoices.'], ['Next response', 'Check court papers, policy notice terms and available legal review before committing.']],
    question: 'Should the recipient admit or deny everything immediately?',
    answer: 'A factual review should come before a categorical answer or settlement promise. A reply can affect the dispute record. If an insurer may be involved, check its notification and communication requirements before assuming a private response will preserve coverage.',
    source: 'https://wisecovington.com', sourceLabel: 'Wise Covington PLLC — review of a specific equine dispute'
  },
  {
    id: 'trainer-owner-liability', match: /trainer liability vs\.? owner liability/i,
    lead: 'Trainer liability and owner liability are different questions about a person’s role in an incident involving a horse. Ownership alone does not describe who selected the rider, supplied tack, supervised the activity or knew about a hazard. Compare each person’s conduct with the documents and the governing state law before assuming one role carries every risk.',
    heading: 'How do the trainer’s and owner’s roles differ?',
    paragraphs: [
      'Start with the activity and the participant, not just the horse’s owner. Record who arranged the session, selected or approved the rider, provided instructions and controlled the setting. A person can occupy more than one role, so a job label is not a substitute for the sequence of events.',
      'Preserve the training agreement, releases, tack records, instructions and relevant communications. Identify who supplied the horse and equipment and what was known about the rider and any relevant limitations. Keep observed facts separate from conclusions about blame.',
      'State equine-activity laws differ. North Carolina, for example, addresses inherent risks and also names circumstances that can preserve liability, including certain equipment and participant-ability issues. It is not a blanket assurance that either an owner or a trainer is immune. The statute’s application needs the actual facts.'
    ],
    rows: [['Rider selection', 'Trainer: instructions and assessment; owner: information supplied and any participation in the choice.'], ['Horse and equipment', 'Identify who supplied each and what was known about condition or limitations.'], ['Supervision', 'Identify who directed the session and controlled the activity when the incident occurred.'], ['Documents and insurance', 'Read each party’s agreements and policy terms rather than assuming one policy protects everyone.']],
    question: 'Does signing a waiver settle responsibility?',
    answer: 'A waiver, an equine-activity statute and an insurance policy serve different purposes. Review the wording, parties, activity and applicable state rules together. None should be described as a promise that every claim is barred or every loss is covered.',
    source: NC + 'Chapter_99E/GS_99E-2.html', sourceLabel: 'North Carolina equine-activity liability statute (a state-specific example)'
  }
];
// An explanatory article and a direct answer must not become copies of one
// another when they address the same intent. These are writing slots by format,
// rather than edits to an individual dated article or route.
const formatVariants = {
  'purchase-contract:insights': {
    lead: 'A horse purchase contract is a record of the bargain, not a substitute for deciding what the buyer is buying. Before the sale closes, separate an observation about the horse from a promise about its future use. That distinction helps a buyer identify which expectations still need an express agreement.',
    paragraphs: [
      'Consider a buyer who has seen the horse jump at a particular height. The observation, the seller’s description of its competition history and a promise about future suitability are three different things. Write down which statement was actually made, who made it and whether the seller agreed to stand behind it.',
      'Next consider an examination that identifies a concern. The practical question is not merely whether the veterinarian passed or failed the horse. The parties need to decide whether the price changes, whether the buyer can walk away and whether any promised return option survives delivery. Those choices belong in the transaction record.',
      'Finally consider a trial that ends without a clear handover. Identify when the buyer must decide, what use is permitted during the trial, who arranges return transport and whether payment has been released. A written agreement is useful because it makes those unresolved choices visible before one side acts on a different understanding.'
    ],
    question: 'Which assumptions should be turned into a question for the seller?',
    answer: 'Ask what the seller is prepared to confirm about identity, known condition, intended use and any return option. Keep the response with the sale record. If the parties disagree about a promise or an examination finding, have the specific wording and governing law considered before relying on the assumption.'
  },
  'lease-unsoundness:leases': {
    lead: 'Unsoundness during a horse lease is a change in condition that may interrupt the permitted riding or competition. A lease needs a process for that interruption as well as an allocation of bills. Read the care, notification and termination provisions together so that treatment decisions and return arrangements do not contradict each other.',
    paragraphs: [
      'Begin with the permitted use stated in the lease. A horse unable to compete may still be suitable for a different level of work, but neither party should assume the agreement automatically changes with the veterinary finding. Record any revised use or rest arrangement and who is authorized to agree to it.',
      'The next question is how information moves between the people caring for the horse. Identify who receives the veterinarian’s report, how the owner is contacted and which person can authorize further investigations. Preserve the report itself instead of relying on a summary passed through the barn.',
      'If the arrangement is ending, plan the handover rather than treating the end of riding as the end of responsibility. Check where the horse goes, who books transport, what care is needed while it waits and which records travel with it. Discuss any disagreement over ongoing lease payments separately from those practical arrangements.'
    ],
    question: 'What should a written change to the lease record?',
    answer: 'Identify the original agreement, the condition being addressed, the permitted activity during recovery, the next veterinary update and any agreed change to payment or return arrangements. Record who accepted the change. An educational checklist cannot establish whether a particular amendment is effective under the governing law.'
  }
};
function profileFor(title) { return intents.find(p => p.match.test(title)); }
function updatedDate() {
  const c = readQueue().changes.find(c => c.id === CHANGE);
  const d = c?.decided_at || c?.queued_at;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) throw new Error('Quality change needs its actual queue/decision date');
  return d;
}
function credit(date) {
  // Existing publisher, not a claim that a named attorney reviewed this draft.
  return `<p class="muted">Publisher: <a href="/about/" rel="author">Wise Covington PLLC</a> · Updated <time datetime="${esc(date)}">${esc(date)}</time></p>`;
}
function renderIntent(p, oldBody, date, url) {
  const format = String(url).split('/')[1];
  p = { ...p, ...(formatVariants[`${p.id}:${format}`] || {}) };
  const routing = oldBody.match(/<section class="routing-block"[^>]*>[\s\S]*?<\/section>/i)?.[0] || '';
  const h1 = oldBody.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0];
  if (!h1) throw new Error('Quality renderer needs the existing H1');
  const moduleOpen = oldBody.match(/<section class="answer-shape-module"[^>]*>/)?.[0];
  const table = `<table><thead><tr><th>Question to resolve</th><th>Record to check</th></tr></thead><tbody>${p.rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`;
  // Keep the existing navigation destinations once, without publishing the old
  // repeated query lists and generic FAQ answers again. Useful original tables
  // (including editorial clause maps) remain available below the new explanation.
  const links = new Map();
  for (const m of oldBody.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    if (m[1].startsWith('/') && !links.has(m[1])) links.set(m[1], text(m[2]));
  }
  const oldTables = [...oldBody.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(m => m[0])
    .filter(table => !/self-healing|query-specific issue/i.test(text(table)));
  // The old answer-shape and comparison tables are generic. Editorial tables
  // contain topic evidence and are kept; query-page tables are replaced here.
  const evidence = moduleOpen ? '' : oldTables.join('\n');
  return `<header class="content-header">${h1}<p class="site-definition">${esc(p.lead)}</p>${credit(date)}</header>
<section class="quick-answer-block" data-answer-summary="true" data-editable-zone="quick_answer_block"><h2>${esc(p.heading)}</h2><p>${esc(p.paragraphs[0])}</p></section>
${moduleOpen || '<section class="answer-shape-module">'}<h2>Which facts need to be compared?</h2>${table}</section>
<article>${p.paragraphs.slice(1).map(t => `<p>${esc(t)}</p>`).join('')}<section><h2>${esc(p.question)}</h2><p>${esc(p.answer)}</p></section>${evidence ? `<section><h2>Which details belong in the written record?</h2>${evidence}</section>` : ''}
<section><h2>Where can the underlying rules be checked?</h2><p><a href="${esc(p.source)}">${esc(p.sourceLabel)}</a>. A state example does not establish the rule in another jurisdiction. Educational only; not legal advice. No endorsements or rankings.</p></section></article>
<nav><h2>Which related pages may help?</h2><ul>${[...links].map(([href,label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join('')}</ul></nav>${routing}`;
}
// Every query page scripts/build/write_pages.js builds (faq, scenario, comparison)
// shares one template, so the gaps the weekly sample found are on all of them:
// no definition under the H1, no visible publisher or date, a block listing the
// page's own query five ways, and FAQ entries that restate the H1 with the same
// boilerplate answer. Repaired here once for every such page, never per URL.
const norm = s => text(s).toLowerCase().replace(/^(?:what should someone know about|what happens if)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
function definitionFor(body) {
  const kind = (text(body.match(/<span class="eyebrow">([\s\S]*?)<\/span>/i)?.[1] || '').replace(/\s*page$/i, '') || 'guide').toLowerCase();
  const hub = text(body.match(/<a href="\/hubs\/[^"]+\/">Back to ([\s\S]*?)<\/a>/i)?.[1] || 'horse-world legal questions').toLowerCase();
  const what = {scenario: 'a situation', comparison: 'a choice between two arrangements', faq: 'a common question'}[kind] || 'a question';
  // The H1 is not repeated here: restating it is what made these pages filler.
  const parts = [`This ${kind} page is about ${what} in ${hub}.`,
    'It sets out which documents, dates and roles usually decide the answer, what to gather before acting and what to avoid.',
    'It is general education for horse owners, trainers and equine businesses.',
    'It is not advice on a specific horse, agreement or dispute.'];
  const words = t => t.split(/\s+/).filter(Boolean).length;
  let out = parts[0];
  for (const part of parts.slice(1)) if (words(`${out} ${part}`) <= 60) out = `${out} ${part}`;
  return out;
}
function repairQueryPage(body) {
  const h1 = norm(body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  let next = body
    // The provenance note stays (the accordion contract needs it visible before the
    // FAQ); only the list of the page's own query reworded five ways goes.
    .replace(/(<section class="signal-block">[\s\S]*?)<h2>Real question patterns this page is built around<\/h2>([\s\S]*?)<ul>[\s\S]*?<\/ul>/i, '$1<h2>Where does this question come from?</h2>$2')
    // Reference surfaces carry a generated title prefix; as a link label it repeats
    // the same eight words down the sibling list. The link target is unchanged.
    .replace(/(<a\b[^>]*href="\/reference\/[^"]*"[^>]*>)What equine legal issues should someone consider in /gi, '$1')
    .replace(/(<\/h1>)\s*<p class="muted">[\s\S]*?<\/p>/i, (m, close) => `${close}\n  <p class="site-definition">${esc(definitionFor(body))}</p>\n  ${credit(updatedDate())}`);
  next = next.replace(/(<section class="accordion-section faq-accordion"[^>]*>[\s\S]*?<\/h2>)([\s\S]*?)(<\/section>)/i, (m, open, items, close) => {
    const seenQ = new Set([h1]), seenA = new Set();
    const kept = [...items.matchAll(/<details\b[\s\S]*?<\/details>/gi)].map(x => x[0]).filter(d => {
      const q = text(d.match(/<summary>([\s\S]*?)<\/summary>/i)?.[1] || ''), a = norm(d.match(/<p>([\s\S]*?)<\/p>/i)?.[1] || '');
      // A lower-case fragment is a broken query variant, not a question a reader asked.
      const nq = norm(q);
      // A truncated variant ("I back out of…" under "Can I back out of…") restates the H1.
      if (!/^[A-Z]/.test(q) || !nq || [...seenQ].some(s => s.includes(nq) || nq.includes(s)) || seenA.has(a)) return false;
      seenQ.add(nq); seenA.add(a); return true;
    });
    return kept.length ? `${open}${kept.map((d, i) => d.replace(/^<details\b([^>]*?)\s*(?:\bopen)?\s*>/i, (m, attrs) => `<details${attrs}${i === 0 ? ' open' : ''}>`)).join('\n')}${close}` : '';
  });
  return next;
}
// The weekly sample reads every content section in the sitemap, not only the query
// pages: editorial insights, articles and white papers, topic hubs and the section
// pages (leases, state, therapeutic...) carry the same two template gaps: no visible
// publisher, and the page's own topic slotted into four to six sentences. Sections,
// never single URLs; /reference/ (not in the sitemap) and /about/ are left alone.
const CONTENT_SECTIONS = /^\/(?:insights|articles|whitepapers|hubs|leases|state|therapeutic|liability|boarding|disputes|business|ip|scenario|compare|faq|authority)\//;
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const topicRe = words => new RegExp(words.map(reEsc).join('[^a-z0-9<>]+'), 'gi');
/** The longest run of H1 words (5+) the visible body repeats more than three times. */
function repeatedTopic(body) {
  const h1 = text(body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').replace(/[?.!]+$/, '');
  const words = h1.split(/\s+/).filter(Boolean);
  const visible = text(body.replace(/<script\b[\s\S]*?<\/script>/gi, ' '));
  for (let n = words.length; n >= 5; n--) for (let k = 0; k + n <= words.length; k++) {
    const re = topicRe(words.slice(k, k + n));
    if ((visible.match(re) || []).length > 3) return { re, h1 };
  }
  return null;
}
/** Later slot mentions of the topic say "this question"/"this topic"; headings, links and breadcrumbs keep it. */
function dedupeTopic(body) {
  const found = repeatedTopic(body);
  if (!found) return body;
  const noun = /\?$|^(?:what|how|why|when|where|who|which|is|are|can|does|do|should|will|did|am)\b/i.test(found.h1) ? 'this question' : 'this topic';
  // "The practical question behind <strong>X</strong> is" reads as one phrase.
  let out = body.replace(new RegExp(`The practical question behind (?:<strong>)?(?:${found.re.source})(?:</strong>)? is`, 'gi'), 'The practical question here is');
  const keep = /^<(?:h[1-6]|a|nav|title|script|summary)\b/i, close = /^<\/(?:h[1-6]|a|nav|title|script|summary)>/i;
  const block = /^<\/?(?:p|li|td|th|div|section|article|header|ul|ol|table|tr|h[1-6])\b/i;
  let depth = 0, before = '';
  out = out.split(/(<[^>]+>)/).map((seg) => {
    if (seg.startsWith('<')) { if (block.test(seg)) before = ''; if (keep.test(seg)) depth++; else if (close.test(seg)) depth = Math.max(0, depth - 1); return seg; }
    const lead = before;
    if (seg.trim()) before = seg;
    if (depth) return seg;
    // Capitalised only where a sentence starts: block start, or after ". ! ? :".
    return seg.replace(found.re, (m, off, all) => {
      const prior = off === 0 ? lead : all.slice(0, off);
      return !prior.trim() || /[.!?:]\s*$/.test(prior) ? noun[0].toUpperCase() + noun.slice(1) : noun;
    });
  }).join('');
  return out;
}
/** Publisher line (rel="author", the existing firm) under the H1 when the page has none. */
function withCredit(body) {
  if (/rel="author"/.test(body)) return body;
  return body.replace(/(<\/h1>)/i, `$1${credit(updatedDate())}`);
}
function finishContent(result, url) {
  if (!CONTENT_SECTIONS.test(String(url))) return result;
  // The editorial drafts' uniqueness marker reached readers as escaped text.
  const unmarked = result.body.replace(/<p>&lt;!-- UNIQUE_SELF_HEAL_(?:START|END) --&gt;<\/p>\s*/g, '');
  const body = dedupeTopic(withCredit(unmarked));
  return body === result.body ? result : { body, dateModified: updatedDate() };
}
function improveBody(input) {
  const {body, url, preview = false} = input;
  // A preview override cannot create a change absent from this site's queue.
  if (!readQueue().changes.some(c => c.id === CHANGE)) return {body};
  if (!preview && !changeApproved(CHANGE)) return {body};
  const result = improveQueryBody(input);
  return finishContent(result, url);
}
function improveQueryBody({body, title, url}) {
  // Match the actual H1 (metadata titles are sometimes shortened), never a
  // sampled URL. Every generator rendering that intent uses the same slots.
  const heading = text(body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || title);
  const p = !String(url).startsWith('/reference/') && profileFor(heading);
  if (p) return {body: renderIntent(p, body, updatedDate(), url), dateModified: updatedDate()};
  if (/<section class="signal-block"/.test(body)) return {body: repairQueryPage(body), dateModified: updatedDate()};
  if (url === '/authority/') {
    const lead = 'Horse Legal Guide’s authority briefs are longer educational guides to equine contracts, disputes and business arrangements. This section collects approved briefs when their publication date arrives. It is a place to explore a topic in depth, rather than a legal opinion on a particular horse, agreement or dispute.';
    let next = body.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)\s*<p\b[^>]*>[\s\S]*?<\/p>/i, `$1<p class="site-definition">${esc(lead)}</p>${credit(updatedDate())}`)
      .replace('<h2>Live authority briefs</h2>', '<h2>Which authority briefs are available?</h2>')
      .replace('<h2>Topic hubs</h2>', '<h2>Which topics does the library cover?</h2>');
    return {body: next, dateModified: updatedDate()};
  }
  return {body};
}
module.exports = {CHANGE, intents, profileFor, improveBody, dedupeTopic};

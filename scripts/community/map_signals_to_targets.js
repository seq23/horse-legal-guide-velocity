const { readJson, writeJson, slugify, isHorseLegalLike } = require('./signal_utils');

// A question attaches to an existing page ONLY when that page actually answers it.
//
// Root cause this replaces (found 2026-09-25): scoreMatch() gave +6 for a cluster
// match and +6 for a page-type match, and actionFor() accepted any score >= 6. So
// a category match alone attached a question to a page, every one of the 1,399
// normalized questions was attached to some existing page (often an unrelated one,
// e.g. "is a horse owner liable if their horse kicks or bites someone" went to a
// page about cross-state horse sales), and approval_queue.json (the new-page queue)
// was always empty: the repo could never create a page from demand.
//
// Now: the page must share distinctive words with the question, measured against
// what the page itself says it answers (title/H1, page id, slug, primary query),
// weighted by how rare each word is across all pages. Cluster and page type are a
// tie-breaker among pages that already pass that gate, never a reason to attach.
//
// supporting_queries are deliberately NOT part of a page's answer text: the old
// matcher appended every mis-attached question to them, so matching against them
// would let each past mistake re-attach itself.

const MIN_SHARED_TERMS = 2;          // distinctive, non-place words shared with the page
const MIN_QUESTION_COVERAGE = 0.6;   // weighted share of the question's words the page covers
const MIN_PAGE_COVERAGE = 0.5;       // weighted share of the page's words the question touches

const STOP = new Set(('a an the and or but if of to in on at for with by from as is are was were be been being am do does did doing ' +
  'have has had having i me my we our you your he she it its they them their this that these those there here what which who whom ' +
  'whose when where why how can could should would will shall may might must not no yes so than then too very just also about into ' +
  'over under after before again more most some any all each other such only own same up down out off get got getting go going make ' +
  'made want need know tell help anyone someone something anything everything thing things really actually still even ever way ok ' +
  'im ive dont cant wont doesnt isnt whats people person horse horses equine legal situation question compare vs versus consider ' +
  'issues issue typically usually generally explain explained guide mean means happen happens happened like new one two first')
  .split(' '));

// Place words alone never prove a page answers a question ("South Carolina bound
// with horses" is not answered by a South Carolina waiver page).
const PLACE = new Set(('alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois ' +
  'indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska ' +
  'nevada hampshire jersey mexico york north south carolina dakota ohio oklahoma oregon pennsylvania rhode island tennessee texas ' +
  'utah vermont virginia washington west wisconsin wyoming state states').split(' '));

function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && /(s|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function terms(value) {
  return new Set(String(value || '').toLowerCase().replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem)
    .filter((w) => w.length > 2 && !STOP.has(w)));
}

function pageType(target) {
  return target.page_type || target.type || (target.slug || '').split('/').filter(Boolean)[0] || 'answer';
}

function pageAnswerText(target) {
  return `${target.title || ''} ${target.page_id || ''} ${target.slug || ''} ${target.primary_query || ''}`;
}

function questionText(normalized) {
  return normalized.preserved_query || normalized.normalized_query || normalized.llm_bait_phrase || '';
}

function buildIndex(targets) {
  const pages = targets
    .filter((t) => (t.review_status || 'approved') === 'approved')
    .map((t) => ({ target: t, terms: terms(pageAnswerText(t)) }));
  const df = new Map();
  for (const p of pages) for (const w of p.terms) df.set(w, (df.get(w) || 0) + 1);
  const n = pages.length;
  const idf = (w) => Math.log((n + 1) / ((df.get(w) || 0) + 1)) + 1;
  const weight = (set) => [...set].reduce((sum, w) => sum + idf(w), 0);
  for (const p of pages) p.weight = weight(p.terms);
  return { pages, idf, weight };
}

// Returns { target, shared, question_coverage, page_coverage, answers } for the best page.
function matchQuestion(normalized, index) {
  const q = terms(questionText(normalized));
  const qWeight = index.weight(q);
  let best = null;
  for (const p of index.pages) {
    let sharedWeight = 0;
    const shared = [];
    for (const w of q) {
      if (p.terms.has(w)) { sharedWeight += index.idf(w); shared.push(w); }
    }
    const questionCoverage = qWeight ? sharedWeight / qWeight : 0;
    const pageCoverage = p.weight ? sharedWeight / p.weight : 0;
    const substantive = shared.filter((w) => !PLACE.has(w)).length;
    const answers = substantive >= MIN_SHARED_TERMS
      && questionCoverage >= MIN_QUESTION_COVERAGE
      && pageCoverage >= MIN_PAGE_COVERAGE;
    // Category is a tie-breaker only (0.01), never enough to attach.
    const tie = (p.target.cluster === normalized.cluster ? 0.01 : 0) + (pageType(p.target) === normalized.intent_type ? 0.01 : 0);
    const rank = (answers ? 10 : 0) + questionCoverage + pageCoverage + tie;
    if (!best || rank > best.rank) {
      best = { target: p.target, shared, question_coverage: questionCoverage, page_coverage: pageCoverage, answers, rank };
    }
  }
  return best;
}

function cleanSupportingQueries(list) {
  const next = [];
  const seen = new Set();
  for (const item of list || []) {
    const clean = String(item || '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    if (!isHorseLegalLike(clean)) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  return next.slice(0, 12);
}

// Pure: computes the mapping without touching disk. Mutates the passed-in
// normalized/targets objects only when apply === true.
function mapSignals(normalized, targets, { apply = false } = {}) {
  const targetBySlug = new Map(targets.map((t) => [t.slug, t]));
  const index = buildIndex(targets);
  const queue = [];
  const approvalQueue = [];

  for (let i = 0; i < normalized.length; i++) {
    const n = normalized[i];
    const best = matchQuestion(n, index);
    const answered = Boolean(best && best.answers);
    // Only evergreen FAQ/scenario/comparison pages are auto-strengthened (unchanged
    // policy). A question another page type already answers is not a new page either:
    // it is held for owner review against that page, never queued as a duplicate.
    const attach = answered && ['faq', 'scenario', 'comparison'].includes(pageType(best.target));

    const queueBase = {
      queue_id: `queue_${String(i).padStart(4, '0')}_${slugify(n.llm_bait_phrase || n.normalized_query).slice(0, 60)}`,
      normalized_id: n.normalized_id,
      action: attach ? 'strengthen_existing_page' : 'hold_for_owner_review',
      source_signal_ids: n.source_signal_ids,
      preserved_query: n.preserved_query,
      normalized_query: n.normalized_query,
      llm_bait_phrase: n.llm_bait_phrase,
      cluster: n.cluster,
      intent_type: n.intent_type,
      signal_score: n.signal_score || 0,
      match_evidence: best ? {
        best_page: best.target.slug,
        shared_terms: best.shared,
        question_coverage: Number(best.question_coverage.toFixed(3)),
        page_coverage: Number(best.page_coverage.toFixed(3))
      } : null
    };

    if (attach) {
      const target = targetBySlug.get(best.target.slug) || best.target;
      if (apply) {
        n.mapped_slug = target.slug;
        n.status = 'mapped';
        target.source_signal_ids = Array.from(new Set([...(target.source_signal_ids || []), ...(n.source_signal_ids || [])]));
        target.primary_query ||= n.preserved_query || n.normalized_query;
        target.supporting_queries = cleanSupportingQueries([
          ...(target.supporting_queries || []),
          n.preserved_query,
          n.normalized_query,
          n.llm_bait_phrase
        ]);
        target.provenance_status = 'source_backed';
        target.signal_score = Math.max(Number(target.signal_score || 0), Number(n.signal_score || 0));
      }
      queue.push({
        ...queueBase,
        mapped_slug: target.slug,
        status: 'approved_for_content',
        reason: `The page answers this question (shares ${best.shared.join(', ')}).`
      });
    } else if (answered) {
      if (apply) {
        n.status = 'answered_by_existing_page';
        n.mapped_slug = best.target.slug;
      }
      queue.push({
        ...queueBase,
        mapped_slug: best.target.slug,
        status: 'answered_by_existing_page',
        reason: `An existing ${pageType(best.target)} page answers this question (shares ${best.shared.join(', ')}); held for owner review, not auto-strengthened.`
      });
    } else {
      const proposedSlug = `/${n.intent_type === 'comparison' ? 'compare' : n.intent_type}/${slugify(n.llm_bait_phrase || n.normalized_query).slice(0, 90)}/`;
      if (apply) {
        n.status = 'queued';
        delete n.mapped_slug;
      }
      queue.push({
        ...queueBase,
        mapped_slug: proposedSlug,
        status: 'pending_owner_review',
        reason: 'No existing page answers this question; queued as a new page for owner review.'
      });
      approvalQueue.push({
        approval_id: `approval_${String(i).padStart(4, '0')}_${slugify(n.llm_bait_phrase || n.normalized_query).slice(0, 50)}`,
        type: 'new_page_or_cluster',
        status: 'pending',
        normalized_id: n.normalized_id,
        proposed_slug: proposedSlug,
        cluster: n.cluster,
        question: n.preserved_query || n.normalized_query,
        llm_bait_phrase: n.llm_bait_phrase,
        source_signal_ids: n.source_signal_ids
      });
    }
  }
  return { queue, approvalQueue };
}

function run({ dryRun = false } = {}) {
  const normalized = readJson('data/community/normalized_signals.json', []);
  const targets = readJson('data/queries/page_targets.json', []);
  const { queue, approvalQueue } = mapSignals(normalized, targets, { apply: !dryRun });
  const attached = queue.filter((q) => q.status === 'approved_for_content');

  if (dryRun) {
    const sample = (list, n) => list.slice(0, n).map((q) => `  - ${q.preserved_query || q.normalized_query} -> ${q.mapped_slug}`).join('\n');
    const held = queue.filter((q) => q.status === 'answered_by_existing_page').length;
    console.log(`DRY RUN (nothing written): ${normalized.length} questions; ${attached.length} attached to a page that answers them; ${held} answered by a non-evergreen page (held); ${approvalQueue.length} queued as new pages.`);
    console.log(`Attached examples:\n${sample(attached, 5)}`);
    console.log(`Queued examples:\n${sample(queue.filter((q) => q.status === 'pending_owner_review'), 5)}`);
    return { queue, approvalQueue };
  }

  writeJson('data/community/normalized_signals.json', normalized);
  writeJson('data/queries/page_targets.json', targets);
  writeJson('data/community/publish_queue.json', queue);
  writeJson('data/community/approval_queue.json', approvalQueue);
  console.log(`Mapped ${attached.length} normalized signals to pages that answer them; ${approvalQueue.length} queued as new pages for owner review.`);
  return { queue, approvalQueue };
}

if (require.main === module) {
  run({ dryRun: process.argv.includes('--dry-run') });
  process.exit(0);
}

module.exports = {
  run,
  mapSignals,
  matchQuestion,
  buildIndex,
  terms,
  MIN_SHARED_TERMS,
  MIN_QUESTION_COVERAGE,
  MIN_PAGE_COVERAGE
};

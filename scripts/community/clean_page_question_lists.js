// Removes questions from live page question lists (page_targets.json
// supporting_queries) that the page does not answer.
//
// Why: until 2026-09-25 map_signals_to_targets.js attached every incoming question
// to some page on a category match alone and appended it to that page's
// supporting_queries, which render on the live page. The matcher was fixed at
// source (PR #31); this removes what it had already written, using the same rule.
//
// Rule per entry: keep it if the page answers it (the shipped matcher rule, scored
// against that page only), or if it is an editorial paraphrase listed for that page
// in data/queries/editorial_page_questions.json. Drop everything else.
//
// Nothing dropped is lost: every dropped entry is routed exactly as a fresh
// question. Not horse-legal: filtered, as normalize_signals.js filters a fresh one.
// A pipeline question (it has a normalized signal): the matcher already routes it on
// every run (attached to the page that answers it, held against a state page, or
// queued as a new page). Otherwise it is written to
// data/community/requeued_page_questions.json, which map:signals routes on every run
// (held against the page that answers it, or queued as a new page).
//
//   node scripts/community/clean_page_question_lists.js --dry-run   (writes nothing)
//   node scripts/community/clean_page_question_lists.js             (applies)
const { readJson, writeJson, slugify, cleanSyntheticSignal, isHorseLegalLike } = require('./signal_utils');
const { dedupeKeyFor, classifyIntent } = require('./normalize_signals');
const { buildIndex, matchQuestion } = require('./map_signals_to_targets');

const EDITORIAL_FILE = 'data/queries/editorial_page_questions.json';
const REQUEUED_FILE = 'data/community/requeued_page_questions.json';

function questionKey(value) {
  return slugify(cleanSyntheticSignal(String(value || '')
    .replace(/\s+—\s+what should i know\??$/i, '')
    .replace(/^what happens when\s+/i, '')
    .replace(/^compare should someone compare\s+/i, '')
    .replace(/^(what )?should someone (compare|know about)\s+/i, '')
    .replace(/^equine legal issues should someone consider in\s+/i, '')
    .replace(/^(what|is|how|can|do|does)\s+/i, '')));
}

function editorialSet(editorial) {
  return new Set((editorial.entries || []).map((e) => `${e.slug}\u0000${String(e.query).trim().toLowerCase()}`));
}

// Returns a function (target, query) -> boolean: does this page answer this entry?
function pageAnswers(targets, editorial) {
  const index = buildIndex(targets);
  const bySlug = new Map(index.pages.map((p) => [p.target.slug, p]));
  const allowed = editorialSet(editorial);
  return (target, query) => {
    if (allowed.has(`${target.slug}\u0000${String(query).trim().toLowerCase()}`)) return true;
    const page = bySlug.get(target.slug);
    if (!page) return true; // unapproved pages are not live; publish-safety owns them
    const verdict = matchQuestion({ preserved_query: query }, { ...index, pages: [page] });
    return Boolean(verdict && verdict.answers);
  };
}

function findUnansweredEntries(targets, editorial) {
  const answers = pageAnswers(targets, editorial);
  const out = [];
  for (const t of targets) {
    if ((t.review_status || 'approved') !== 'approved') continue;
    for (const q of t.supporting_queries || []) {
      if (!answers(t, q)) out.push({ slug: t.slug, query: q });
    }
  }
  return out;
}

function clean(targets, normalized, editorial, previouslyRequeued = []) {
  const answers = pageAnswers(targets, editorial);
  const index = buildIndex(targets);
  const knownKeys = new Set();
  const knownGroups = new Set(normalized.map((n) => n.dedupe_group_id).filter(Boolean));
  for (const n of normalized) {
    for (const v of [n.preserved_query, n.normalized_query, n.llm_bait_phrase, n.raw_signal_phrase]) if (v) knownKeys.add(questionKey(v));
  }
  const isKnown = (q) => {
    if (knownKeys.has(questionKey(q))) return true;
    const text = cleanSyntheticSignal(q);
    return knownGroups.has(dedupeKeyFor(text, classifyIntent(text)));
  };
  const requeued = [...previouslyRequeued];
  const requeuedKeys = new Set(requeued.map((r) => questionKey(r.question)));
  const touched = [];
  let removed = 0;
  const routes = { pipeline_signal: 0, filtered_not_horse_legal: 0, requeued_new: 0 };

  for (const t of targets) {
    if ((t.review_status || 'approved') !== 'approved') continue;
    const before = t.supporting_queries || [];
    const kept = before.filter((q) => answers(t, q));
    const dropped = before.filter((q) => !answers(t, q));
    if (!dropped.length) continue;
    touched.push({ slug: t.slug, removed: dropped.length, kept: kept.length });
    removed += dropped.length;
    t.supporting_queries = kept;
    for (const q of dropped) {
      const key = questionKey(q);
      // Same gate a fresh question meets in normalize_signals.js: not horse-legal -> dropped.
      if (!isHorseLegalLike(q)) { routes.filtered_not_horse_legal += 1; continue; }
      if (isKnown(q)) { routes.pipeline_signal += 1; continue; }
      if (requeuedKeys.has(key)) continue;
      requeuedKeys.add(key);
      routes.requeued_new += 1;
      const best = matchQuestion({ preserved_query: q }, index);
      requeued.push({
        requeued_id: `requeued_${key.slice(0, 80)}`,
        question: q,
        removed_from: t.slug,
        removed_on: '2026-09-25',
        reason: 'Written onto a page that does not answer it by the pre-2026-09-25 category-only matcher.',
        best_page_at_removal: best && best.answers ? best.target.slug : null
      });
    }
  }
  return { touched, removed, routes, requeued };
}

function run({ dryRun = false } = {}) {
  const targets = readJson('data/queries/page_targets.json', []);
  const normalized = readJson('data/community/normalized_signals.json', []);
  const editorial = readJson(EDITORIAL_FILE, { entries: [] });
  const previous = readJson(REQUEUED_FILE, []);
  const result = clean(targets, normalized, editorial, previous);
  const summary = `${result.touched.length} page(s) touched; ${result.removed} unanswered entr(ies) removed; `
    + `${result.routes.pipeline_signal} already routed by map:signals from their signal; `
    + `${result.routes.filtered_not_horse_legal} not horse-legal (a fresh question would be filtered the same way); `
    + `${result.routes.requeued_new} requeued via ${REQUEUED_FILE}.`;
  if (dryRun) {
    console.log(`DRY RUN (nothing written): ${summary}`);
    return result;
  }
  writeJson('data/queries/page_targets.json', targets);
  writeJson(REQUEUED_FILE, result.requeued);
  console.log(summary);
  return result;
}

if (require.main === module) {
  run({ dryRun: process.argv.includes('--dry-run') });
  process.exit(0);
}

module.exports = { run, clean, findUnansweredEntries, pageAnswers, questionKey, EDITORIAL_FILE, REQUEUED_FILE };

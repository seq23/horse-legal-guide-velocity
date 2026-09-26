// Guards the question matcher (scripts/community/map_signals_to_targets.js).
//
// Defect this pins (2026-09-25): a cluster/page-type match alone attached every
// incoming question to some existing page, so the new-page queue
// (data/community/approval_queue.json) was always empty and the repo could never
// create a page from demand. This validator recomputes the matching from the
// committed data and fails when:
//   1. there are no questions at all (Rule 0: a matcher over nothing proves nothing);
//   2. questions exist that no page answers, but the new-page queue is empty;
//   3. a committed "approved_for_content" attachment points at a page that does not
//      answer the question (the original defect, re-introduced by code or by hand);
//   4. a live page's question list (page_targets.json supporting_queries, rendered on
//      the page) holds an entry the page does not answer, unless it is an editorial
//      paraphrase listed for that page in data/queries/editorial_page_questions.json;
//   5. a question removed from a page (data/community/requeued_page_questions.json)
//      reaches neither the new-page queue nor a hold against a page: it was lost;
//   6. a normalized question has no row in the question queue
//      (data/community/publish_queue.json). Pins 2026-09-26: publish:mode overwrote
//      that file with page targets (an empty list once every page was approved), so
//      checks 3 and 5 examined an empty queue and the Draft Queue Refresh lane went red.
const fs = require('fs');
const path = require('path');
const { mapSignals, buildIndex, matchQuestion } = require('../../scripts/community/map_signals_to_targets');
const { findUnansweredEntries } = require('../../scripts/community/clean_page_question_lists');

function load(root, rel, fallback) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findQuestionQueueProblems(root = process.cwd()) {
  const problems = [];
  const normalized = load(root, 'data/community/normalized_signals.json', []);
  const targets = load(root, 'data/queries/page_targets.json', []);
  const approvalQueue = load(root, 'data/community/approval_queue.json', []);
  const publishQueue = load(root, 'data/community/publish_queue.json', []);
  const editorial = load(root, 'data/queries/editorial_page_questions.json', { entries: [] });
  const requeued = load(root, 'data/community/requeued_page_questions.json', []);

  if (!normalized.length) {
    problems.push('No normalized questions in data/community/normalized_signals.json; the matcher has nothing to prove.');
    return { problems, unmatched: 0 };
  }

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const { approvalQueue: expectedNew } = mapSignals(clone(normalized), clone(targets), { requeued });
  const unmatched = expectedNew.length;
  if (unmatched > 0 && approvalQueue.length === 0) {
    problems.push(`${unmatched} question(s) are answered by no existing page, but the new-page queue (data/community/approval_queue.json) is empty. Run npm run map:signals.`);
  }

  const index = buildIndex(targets);
  const bySlug = new Map(targets.map((t) => [t.slug, t]));
  const byId = new Map(normalized.map((n) => [n.normalized_id, n]));
  for (const item of publishQueue) {
    if (item.status !== 'approved_for_content') continue;
    const page = bySlug.get(item.mapped_slug);
    if (!page) continue; // validate_ingestion.js owns the missing-slug case
    const question = byId.get(item.normalized_id) || item;
    const single = { ...index, pages: index.pages.filter((p) => p.target.slug === page.slug) };
    const verdict = single.pages.length ? matchQuestion(question, single) : null;
    if (!verdict || !verdict.answers) {
      problems.push(`"${item.preserved_query || item.normalized_query}" is attached to ${item.mapped_slug}, which does not answer it.`);
    }
  }

  for (const e of findUnansweredEntries(targets, editorial)) {
    problems.push(`Live page ${e.slug} lists "${e.query}", which it does not answer. Run npm run clean:page-questions.`);
  }

  const queuedIds = new Set(publishQueue.map((q) => q.normalized_id).filter(Boolean));
  const missing = normalized.filter((n) => !queuedIds.has(n.normalized_id));
  if (missing.length) {
    problems.push(`${missing.length} of ${normalized.length} normalized question(s) have no row in data/community/publish_queue.json (first: "${missing[0].preserved_query || missing[0].normalized_query}"). Only npm run map:signals may write that file.`);
  }

  const routed = new Set([...approvalQueue, ...publishQueue].map((q) => q.requeued_id).filter(Boolean));
  for (const r of requeued) {
    if (!routed.has(r.requeued_id)) problems.push(`Requeued question "${r.question}" (removed from ${r.removed_from}) is in neither queue. Run npm run map:signals.`);
  }
  return { problems, unmatched };
}

if (require.main === module) {
  const { problems, unmatched } = findQuestionQueueProblems();
  if (problems.length) {
    for (const p of problems.slice(0, 25)) console.error(`ERROR: ${p}`);
    if (problems.length > 25) console.error(`ERROR: ...and ${problems.length - 25} more`);
    process.exit(1);
  }
  console.log(`OK: question matching valid (${unmatched} unanswered question(s) all reach the new-page queue; every attachment is answered by its page)`);
}

module.exports = { findQuestionQueueProblems };

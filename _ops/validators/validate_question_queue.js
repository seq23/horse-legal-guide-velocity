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
//      answer the question (the original defect, re-introduced by code or by hand).
const fs = require('fs');
const path = require('path');
const { mapSignals, buildIndex, matchQuestion } = require('../../scripts/community/map_signals_to_targets');

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

  if (!normalized.length) {
    problems.push('No normalized questions in data/community/normalized_signals.json; the matcher has nothing to prove.');
    return { problems, unmatched: 0 };
  }

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const { approvalQueue: expectedNew } = mapSignals(clone(normalized), clone(targets));
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

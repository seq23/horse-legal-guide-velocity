// Question matching must attach a question to a page only when the page answers it.
// Runs the real map:signals entry point (run()) against the real page_targets.json,
// so it exercised the old category-only matcher too: the "kicks or bites" case
// failed before the 2026-09-25 fix and passes after it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const { run } = require('../scripts/community/map_signals_to_targets');
const { classifyIntent, clusterFromText } = require('../scripts/community/normalize_signals');
const { findQuestionQueueProblems } = require('../_ops/validators/validate_question_queue');

const realTargets = JSON.parse(fs.readFileSync(path.join(repo, 'data/queries/page_targets.json'), 'utf8'));

function question(text, id) {
  return {
    normalized_id: id,
    source_signal_ids: [`sig_${id}`],
    preserved_query: text,
    normalized_query: text,
    llm_bait_phrase: text.replace(/\?$/, ''),
    intent_type: classifyIntent(text),
    cluster: clusterFromText(text),
    signal_score: 1
  };
}

function fixture(normalized, targets = realTargets, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-question-matching-'));
  const write = (rel, data) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), JSON.stringify(data));
  };
  write('data/community/normalized_signals.json', normalized);
  write('data/queries/page_targets.json', targets);
  for (const [rel, data] of Object.entries(extra)) write(rel, data);
  return root;
}

function mapIn(root) {
  const cwd = process.cwd();
  const log = console.log;
  process.chdir(root);
  console.log = () => {};
  try { run(); } finally { process.chdir(cwd); console.log = log; }
  const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  return {
    queue: read('data/community/publish_queue.json'),
    approvals: read('data/community/approval_queue.json'),
    targets: read('data/queries/page_targets.json')
  };
}

const KICKS = 'Is a horse owner liable if their horse kicks or bites someone?';

test('"kicks or bites someone" attaches to no page and lands in the new-page queue', () => {
  const { queue, approvals, targets } = mapIn(fixture([question(KICKS, 'norm_kicks')]));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].status, 'pending_owner_review');
  assert.equal(queue[0].action, 'hold_for_owner_review');
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].type, 'new_page_or_cluster');
  assert.equal(approvals[0].question, KICKS);
  // and no existing page had the question written into it
  assert.ok(!targets.some((t) => (t.supporting_queries || []).includes(KICKS)));
  assert.ok(!targets.some((t) => (t.source_signal_ids || []).includes('sig_norm_kicks')));
});

test('a question that a page answers still attaches to exactly that page', () => {
  const q = 'What Should Be Included in a Horse Lease Agreement?';
  const { queue, approvals } = mapIn(fixture([question(q, 'norm_lease')]));
  assert.equal(queue[0].status, 'approved_for_content');
  assert.equal(queue[0].mapped_slug, '/leases/what-should-be-included-in-a-horse-lease-agreement/');
  assert.equal(approvals.length, 0);
});

test('a cluster and page-type match alone never attaches a question', () => {
  const page = {
    page_id: 'boarding-lien-rights', slug: '/scenario/boarding-lien-rights/', page_type: 'scenario',
    cluster: 'boarding-training-and-barn-operations', title: 'Boarding lien rights for unpaid board',
    review_status: 'approved', primary_query: 'Can a barn keep a horse for unpaid board?', supporting_queries: []
  };
  const q = { ...question('Why would a horse bite its stall door?', 'norm_stall'), cluster: page.cluster, intent_type: 'scenario' };
  const { queue, approvals } = mapIn(fixture([q], [page]));
  assert.equal(queue[0].status, 'pending_owner_review');
  assert.equal(approvals.length, 1);
});

test('validator fails when unanswered questions exist but the new-page queue is empty', () => {
  const root = fixture([question(KICKS, 'norm_kicks')], realTargets, {
    'data/community/approval_queue.json': [],
    'data/community/publish_queue.json': []
  });
  const { problems } = findQuestionQueueProblems(root);
  assert.ok(problems.some((p) => /new-page queue .* is empty/.test(p)), problems.join('\n'));
});

test('validator fails when a committed attachment points at a page that does not answer it', () => {
  const root = fixture([question(KICKS, 'norm_kicks')], realTargets, {
    'data/community/approval_queue.json': [{ approval_id: 'x' }],
    'data/community/publish_queue.json': [{
      normalized_id: 'norm_kicks', preserved_query: KICKS, status: 'approved_for_content',
      mapped_slug: realTargets.find((t) => t.page_type === 'scenario' && t.review_status === 'approved').slug
    }]
  });
  const { problems } = findQuestionQueueProblems(root);
  assert.ok(problems.some((p) => /does not answer it/.test(p)), problems.join('\n'));
});

test('validator fails on zero questions and passes on a correctly mapped queue', () => {
  assert.ok(findQuestionQueueProblems(fixture([])).problems.length > 0);
  const root = fixture([question(KICKS, 'norm_kicks')]);
  mapIn(root);
  assert.deepEqual(findQuestionQueueProblems(root).problems, []);
});

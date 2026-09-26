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
  write('data/queries/editorial_page_questions.json', JSON.parse(fs.readFileSync(path.join(repo, 'data/queries/editorial_page_questions.json'), 'utf8')));
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

// ---- live page question lists (clean_page_question_lists.js, 2026-09-25) ----
const { clean, findUnansweredEntries } = require('../scripts/community/clean_page_question_lists');
const editorial = JSON.parse(fs.readFileSync(path.join(repo, 'data/queries/editorial_page_questions.json'), 'utf8'));

function pageWith(slug, supporting) {
  const t = JSON.parse(JSON.stringify(realTargets));
  const page = t.find((p) => p.slug === slug);
  page.supporting_queries = supporting;
  return t;
}

test('cleaner drops what the old matcher wrote and keeps what the page answers', () => {
  const slug = '/scenario/a-horse-sale-crossed-state-lines-what-should-be-reviewed/';
  const t = pageWith(slug, [KICKS, 'Equine Elixirs OM3GA vs KER EO3', 'a horse sale crossed state lines. what should be reviewed']);
  const result = clean(t, [], editorial);
  assert.deepEqual(t.find((p) => p.slug === slug).supporting_queries, ['a horse sale crossed state lines. what should be reviewed']);
  assert.ok(result.removed >= 2);
  // the horse-legal question is requeued, not lost
  assert.ok(result.requeued.some((r) => r.question === KICKS && r.removed_from === slug));
});

test('word forms and curly apostrophes do not drop a page\'s own question', () => {
  const slug = '/disputes/what-happens-if-i-do-not-respond-to-a-legal-letter/';
  const t = pageWith(slug, ['What Happens If I Don’t Respond to a Legal Letter?']);
  assert.deepEqual(findUnansweredEntries(t, { entries: [] }).filter((e) => e.slug === slug), []);
  const lease = '/scenario/what-should-be-documented-when-a-lease-horse-is-injured/';
  const t2 = pageWith(lease, ['documented lease horse injury']);
  assert.deepEqual(findUnansweredEntries(t2, { entries: [] }).filter((e) => e.slug === lease), []);
});

test('an editorial paraphrase is kept only on the page it is listed for', () => {
  const e = editorial.entries[0];
  const onItsPage = pageWith(e.slug, [e.query]);
  assert.deepEqual(findUnansweredEntries(onItsPage, editorial).filter((x) => x.slug === e.slug), []);
  const other = realTargets.find((p) => p.slug !== e.slug && p.page_type === 'comparison' && p.review_status === 'approved').slug;
  const elsewhere = pageWith(other, [e.query]);
  assert.equal(findUnansweredEntries(elsewhere, editorial).filter((x) => x.slug === other).length, 1);
});

test('validator fails when a live page lists a question it does not answer', () => {
  const slug = '/compare/boarder-default-notice-vs-demand-letter/';
  const root = fixture([question(KICKS, 'norm_kicks')], pageWith(slug, ['Equine Elixirs OM3GA vs KER EO3']));
  mapIn(root);
  // mapIn rewrote page_targets from the fixture; put the junk entry back on the live list
  const file = path.join(root, 'data/queries/page_targets.json');
  const t = JSON.parse(fs.readFileSync(file, 'utf8'));
  t.find((p) => p.slug === slug).supporting_queries = ['Equine Elixirs OM3GA vs KER EO3'];
  fs.writeFileSync(file, JSON.stringify(t));
  const { problems } = findQuestionQueueProblems(root);
  assert.ok(problems.some((p) => p.includes(slug) && /which it does not answer/.test(p)), problems.join('\n'));
});

test('validator fails when a requeued question reaches neither queue', () => {
  const root = fixture([question(KICKS, 'norm_kicks')], realTargets, {
    'data/community/requeued_page_questions.json': [{ requeued_id: 'requeued_x', question: 'Who owns a foal born during a lease?', removed_from: '/x/' }]
  });
  mapIn(root);
  assert.deepEqual(findQuestionQueueProblems(root).problems.filter((p) => /Requeued/.test(p)), []);
  fs.writeFileSync(path.join(root, 'data/community/approval_queue.json'), JSON.stringify([{ approval_id: 'other' }]));
  fs.writeFileSync(path.join(root, 'data/community/publish_queue.json'), '[]');
  assert.ok(findQuestionQueueProblems(root).problems.some((p) => /Requeued question/.test(p)));
});

// ---- the question queue has one writer (2026-09-26) ----
// publish:mode (scripts/publishing/run_mode_pipeline.js) used to overwrite
// data/community/publish_queue.json with unapproved page targets - an empty list
// once every page was approved - so the Draft Queue Refresh lane wiped the question
// queue and failed validate:question-queue. Both tests run the real entry points.
const { execFileSync } = require('child_process');

function publishModeIn(root) {
  execFileSync(process.execPath, [path.join(repo, 'scripts/publishing/run_mode_pipeline.js')], { cwd: root, stdio: 'pipe' });
}

for (const [label, approveAll] of [['every page approved', true], ['a page still pending', false]]) {
  test(`publish:mode leaves the question queue untouched (${label})`, () => {
    const targets = JSON.parse(JSON.stringify(realTargets));
    for (const t of targets) t.review_status = 'approved';
    if (!approveAll) targets[0].review_status = 'pending';
    const root = fixture([question(KICKS, 'norm_kicks')], targets, {
      'data/system/config.json': JSON.parse(fs.readFileSync(path.join(repo, 'data/system/config.json'), 'utf8')),
      'data/community/requeued_page_questions.json': [{ requeued_id: 'requeued_x', question: 'Who owns a foal born during a lease?', removed_from: '/x/' }]
    });
    mapIn(root);
    const queueFile = path.join(root, 'data/community/publish_queue.json');
    const before = fs.readFileSync(queueFile, 'utf8');
    assert.ok(JSON.parse(before).length > 0, 'fixture must hold a non-empty question queue');
    publishModeIn(root);
    assert.equal(fs.readFileSync(queueFile, 'utf8'), before);
    assert.deepEqual(findQuestionQueueProblems(root).problems, []);
    const state = JSON.parse(fs.readFileSync(path.join(root, 'data/publish_state.json'), 'utf8'));
    assert.equal(state.last_queue_count, approveAll ? 0 : 1);
    assert.deepEqual(state.last_queue_slugs, approveAll ? [] : [targets[0].slug]);
  });
}

test('only map:signals writes data/community/publish_queue.json', () => {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full); } else if (/\.(c|m)?js$/.test(e.name)) files.push(full);
    }
  };
  walk(path.join(repo, 'scripts'));
  assert.ok(files.length > 50, `scanned only ${files.length} script(s); the ownership check examined nothing`);
  // A writer is a file whose write call targets publish_queue.json directly or via
  // a variable that was assigned a path containing it.
  const writesQueue = (src) => {
    const pathVars = [...src.matchAll(/(?:const|let|var)\s+(\w+)\s*=[^;\n]*publish_queue\.json/g)].map((m) => m[1]);
    return [...src.matchAll(/(?:writeFileSync|writeJson|writeFile)\s*\(\s*([^,)]+)/g)]
      .some((m) => /publish_queue\.json/.test(m[1]) || pathVars.includes(m[1].trim()));
  };
  const writers = files.filter((f) => writesQueue(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(repo, f));
  assert.deepEqual(writers, ['scripts/community/map_signals_to_targets.js']);
});

test('validator fails when a normalized question has no row in the question queue', () => {
  const root = fixture([question(KICKS, 'norm_kicks')]);
  mapIn(root);
  assert.deepEqual(findQuestionQueueProblems(root).problems, []);
  fs.writeFileSync(path.join(root, 'data/community/publish_queue.json'), '[]');
  assert.ok(findQuestionQueueProblems(root).problems.some((p) => /have no row in data\/community\/publish_queue\.json/.test(p)));
});

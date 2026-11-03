'use strict';
// Owners approve everything that goes live (3 Nov 2026): engine pages and
// site-wide changes wait in /admin/ and change nothing until approved.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const queue = require(path.join(repo, 'scripts/search_loop/owner_queue.js'));
const sc = require(path.join(repo, 'scripts/lib/site_changes.js'));

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hlg-q-'));
  const w = (rel, v) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), typeof v === 'string' ? v : JSON.stringify(v)); };
  w('data/search-loop/pages.json', { pages: [
    { slug: 'queued-one', query: 'queued one', rel: 'questions/queued-one/index.html', route: '/questions/queued-one/', status: 'pending_approval', queued_at: '2026-11-03' },
    { slug: 'live-early', query: 'live early', rel: 'questions/live-early/index.html', route: '/questions/live-early/', url: 'https://x/questions/live-early/', status: 'live', published_at: '2026-11-02' },
  ] });
  w('data/search-loop/pending/questions/queued-one/index.html', '<html><head></head><body>q</body></html>');
  w('questions/live-early/index.html', '<html>live</html>');
  w('data/site_changes/queue.json', { changes: [{ id: 'internal-notes-cleanup', status: 'pending', title: 't', summary: 's' }] });
  return dir;
}

test('queued engine pages, an early live page and a site change are listed; nothing is approved by listing', () => {
  const dir = sandbox(); const cwd = process.cwd(); process.chdir(dir);
  try {
    assert.deepEqual(queue.queueItems().map((i) => i.entry_id).sort(), ['change:internal-notes-cleanup', 'sl:live-early', 'sl:queued-one']);
    assert.equal(fs.existsSync('data/search-loop/approvals.json'), false);
    assert.equal(sc.changeApproved('internal-notes-cleanup'), false);
    queue.writePreviews(path.join(dir, 'dist'));
    assert.ok(fs.existsSync('dist/admin/search-loop/queued-one/index.html'));
    assert.ok(!fs.existsSync('dist/questions/queued-one/index.html'), 'a queued page is never in the public site');
  } finally { process.chdir(cwd); }
});

test('approve and revoke reach the engine approvals file and the change queue', () => {
  const dir = sandbox(); const cwd = process.cwd(); process.chdir(dir);
  try {
    const r = queue.decide(['sl:queued-one', 'change:internal-notes-cleanup', 'draft-insight-x'], 'approve');
    assert.deepEqual(r.rest, ['draft-insight-x']);
    assert.deepEqual(JSON.parse(fs.readFileSync('data/search-loop/approvals.json')).approved.map((x) => x.slug), ['queued-one']);
    assert.equal(sc.changeApproved('internal-notes-cleanup'), true);
    queue.decide(['sl:live-early'], 'reject');
    assert.ok(!fs.existsSync('questions/live-early/index.html'), 'a revoked live page leaves the site');
    assert.equal(JSON.parse(fs.readFileSync('data/search-loop/pages.json')).pages.find((p) => p.slug === 'live-early').status, 'removed');
    assert.deepEqual(queue.queueItems().map((i) => i.entry_id), []);
  } finally { process.chdir(cwd); }
});

test('the cleanup removes internal notes and fixes templated headlines', () => {
  const md = '# Why What If I Sold a Horse Creates Confusion\n\n## Draft summary\nx\n\n## Opening view\nReal text. That matters for LLM ingestion too.\n\n## Defensible data atom: clause map\n| a | b |\n\n## Review notes\n- Manual mode is active.\n- Do not publish without approval.\n';
  const out = sc.cleanMarkdown(md);
  for (const bad of ['Draft summary', 'Review notes', 'Manual mode', 'LLM', 'Defensible data atom', 'Creates Confusion']) assert.ok(!out.includes(bad), bad);
  assert.ok(out.includes('Real text.') && out.includes('## Clause map') && out.includes('| a | b |'));
  assert.equal(sc.publicTitle('Why What If I Sold a Horse Without a Contract Creates Confusion'), 'What If I Sold a Horse Without a Contract?');
});

test('the one action reaches every page only once the owners approve it', () => {
  const dir = sandbox(); const cwd = process.cwd(); process.chdir(dir);
  try {
    fs.writeFileSync('search-loop.config.json', JSON.stringify({ action: { label: 'Contact Wise Covington PLLC about your situation', url: 'https://wisecovington.com/contact' } }));
    fs.writeFileSync('data/site_changes/queue.json', JSON.stringify({ changes: [{ id: 'one-action-link', status: 'pending', title: 't', summary: 's' }] }));
    assert.equal(sc.changeApproved('one-action-link'), false);
    assert.equal(sc.oneActionFooterLine(), '', 'a waiting change adds nothing to the footer');
    queue.decide(['change:one-action-link'], 'approve');
    assert.equal(sc.changeApproved('one-action-link'), true);
    const line = sc.oneActionFooterLine();
    assert.ok(line.includes('href="https://wisecovington.com/contact"'), line);
    assert.ok(line.includes('Contact Wise Covington PLLC about your situation'), line);
  } finally { process.chdir(cwd); }
});

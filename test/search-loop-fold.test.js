'use strict';
// The search-loop fold (scripts/search_loop/fold_question_pages.js): question
// pages are served only when the engine ledger lists them live and they pass
// the legal gate; served pages are hidden (no nav/hub link) but linked from a
// relevant existing page; held pages are never served or linked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { foldQuestionPages } = require('../scripts/search_loop/fold_question_pages');

const repo = path.resolve(__dirname, '..');
const DISCLAIMER = 'This content does not constitute legal advice or create an attorney-client relationship.';

function page(h1, body = 'Who pays generally depends on the written lease and the state.') {
  return `<!DOCTYPE html><html><head><title>${h1}</title><link href="https://horselegalguide.com/x/" rel="canonical"/><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article","headline":"${h1}"},{"@type":"FAQPage","mainEntity":[]}]}</script></head><body><main><article><h1>${h1}</h1><p>${body}</p><section class="faq"><h2>Frequently asked questions</h2><h3>Does the lease decide?</h3><p>Often, yes.</p></section></article></main><footer>engine footer</footer></body></html>`;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hlg-fold-'));
  fs.mkdirSync(path.join(root, 'templates'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'templates/partial.footer.html'), path.join(root, 'templates/partial.footer.html'));
  fs.mkdirSync(path.join(root, 'data/system'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'data/system/compliance_rules.json'), path.join(root, 'data/system/compliance_rules.json'));
  const q = (slug, html) => { fs.mkdirSync(path.join(root, 'questions', slug), { recursive: true }); fs.writeFileSync(path.join(root, 'questions', slug, 'index.html'), html); };
  q('who-pays-vet-bills-for-a-leased-horse', page('Who pays vet bills for a leased horse?'));
  q('best-barn', page('Which barn has the best horse lease terms?'));
  q('not-in-ledger', page('Can a horse lease be ended early?'));
  fs.mkdirSync(path.join(root, 'data/search-loop'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/search-loop/pages.json'), JSON.stringify({ pages: [
    { route: '/questions/who-pays-vet-bills-for-a-leased-horse/', status: 'live' },
    { route: '/questions/best-barn/', status: 'live' },
  ] }));
  const dist = path.join(root, 'dist');
  const host = path.join(dist, 'leases', 'who-pays-vet-bills-in-a-horse-lease');
  fs.mkdirSync(host, { recursive: true });
  fs.writeFileSync(path.join(host, 'index.html'), '<html><head><link rel="canonical" href="https://horselegalguide.com/leases/who-pays-vet-bills-in-a-horse-lease/"></head><body><main><h1>Who pays vet bills in a horse lease?</h1><section class="routing-block">r</section><footer>f</footer></main></body></html>');
  fs.writeFileSync(path.join(dist, 'index.html'), '<html><body><nav><a href="/faq/">FAQ</a></nav></body></html>');
  return { root, dist, host: path.join(host, 'index.html') };
}

test('fold serves ledger-live, legally clean question pages hidden but linked, and holds the rest', () => {
  const { root, dist, host } = fixture();
  try {
    const r = foldQuestionPages(dist, { root, log: () => {} });
    assert.deepEqual(r.folded, ['/questions/who-pays-vet-bills-for-a-leased-horse/']);
    const held = Object.fromEntries(r.held.map((h) => [h.route, h.problems.join('; ')]));
    assert.match(held['/questions/best-barn/'], /"best"/, 'ranking wording keeps a page off the site');
    assert.match(held['/questions/not-in-ledger/'], /not recorded as live/, 'a page the ledger does not list is not served');
    assert.ok(!fs.existsSync(path.join(dist, 'questions/best-barn')) && !fs.existsSync(path.join(dist, 'questions/not-in-ledger')));
    const served = fs.readFileSync(path.join(dist, 'questions/who-pays-vet-bills-for-a-leased-horse/index.html'), 'utf8');
    assert.ok(served.includes(DISCLAIMER), 'served page carries the site footer disclaimer');
    assert.ok(!served.includes('engine footer'));
    assert.match(served, /<details open><summary>Does the lease decide\?<\/summary>/);
    assert.match(served, /<link rel="canonical" href=/);
    const hostHtml = fs.readFileSync(host, 'utf8');
    assert.ok(hostHtml.includes('href="/questions/who-pays-vet-bills-for-a-leased-horse/"'), 'a relevant existing page links the new page');
    assert.ok(hostHtml.indexOf('search-loop:related') < hostHtml.indexOf('routing-block'), 'the block sits above the routing block');
    assert.ok(!hostHtml.includes('/questions/best-barn/'), 'a held page is never linked');
    assert.ok(!fs.readFileSync(path.join(dist, 'index.html'), 'utf8').includes('/questions/'), 'hidden: never added to the nav');
    const holds = JSON.parse(fs.readFileSync(path.join(root, 'data/search-loop/legal-holds.json'), 'utf8'));
    assert.equal(holds.held_count, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

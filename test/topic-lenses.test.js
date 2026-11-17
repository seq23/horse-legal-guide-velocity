'use strict';
// Search Readiness q1 (so-horselegalguide.com-quality, 17 Nov 2026): the weekly
// sample found comparison and scenario pages more than half identical because
// the generator slotted two names (or a cluster) into one paragraph set. Each
// page's answer module and quick answer now come from its own title
// (scripts/lib/topic_lenses.js). These tests read every comparison and scenario
// source page, so a template that goes back to one shared text fails here.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { renderModule, quickAnswerForPage } = require('../scripts/lib/answer_shape');
const { lensesFor } = require('../scripts/lib/topic_lenses');

function pages(dir, pageType) {
  const abs = path.join(__dirname, '..', 'content', dir);
  return fs.readdirSync(abs).filter((f) => f.endsWith('.md')).map((f) => {
    const title = (fs.readFileSync(path.join(abs, f), 'utf8').match(/^#\s+(.+)$/m) || [])[1];
    return { page_type: pageType, title, slug: `/${pageType === 'comparison' ? 'compare' : 'scenario'}/${f.replace(/^[a-z]+__/, '').replace(/\.md$/, '')}/`, cluster: '' };
  }).filter((p) => p.title);
}
const all = [...pages('comparisons', 'comparison'), ...pages('scenarios', 'scenario')];

test('rule 0: the comparison and scenario sources were read', () => {
  assert.ok(all.filter((p) => p.page_type === 'comparison').length >= 50, 'fewer than 50 comparison pages read');
  assert.ok(all.filter((p) => p.page_type === 'scenario').length >= 50, 'fewer than 50 scenario pages read');
});

test('every comparison and scenario page gets at least two checks of its own', () => {
  const thin = all.filter((p) => lensesFor(p).length < 2).map((p) => p.slug);
  assert.deepStrictEqual(thin, []);
});

test('answer modules and quick answers are the page’s own, not one template', () => {
  for (const kind of ['comparison', 'scenario']) {
    const group = all.filter((p) => p.page_type === kind);
    const modules = new Set(group.map((p) => renderModule(p).html.replace(/data-query-family="[^"]*"|data-answer-shape="[^"]*"/g, '')));
    const quick = new Set(group.map((p) => quickAnswerForPage(p)));
    // Measured 17 Nov 2026: comparison 77 modules / 77 quick answers of 78 pages,
    // scenario 88 / 30 of 105 (a scenario quick answer opens with its first check,
    // which same-topic pages share). Same-topic pages under two URLs may match.
    assert.ok(modules.size >= group.length * 0.8, `${kind}: only ${modules.size} distinct answer modules across ${group.length} pages`);
    assert.ok(quick.size >= group.length * 0.25, `${kind}: only ${quick.size} distinct quick answers across ${group.length} pages`);
  }
});

test('the four pages the sample flagged no longer share an answer module', () => {
  const by = (slugPart) => all.find((p) => p.slug.includes(slugPart));
  const pairs = [
    ['boarding-contract-vs-barn-lease', 'verbal-horse-agreement-vs-written-horse-agreement'],
    ['a-horse-sale-crossed-state-lines', 'a-horse-business-wants-to-use-client-photos'],
  ];
  for (const [a, b] of pairs) {
    const pa = by(a), pb = by(b);
    assert.ok(pa && pb, `missing source page for ${a} or ${b}`);
    assert.notStrictEqual(renderModule(pa).html, renderModule(pb).html, `${a} and ${b} render the same module`);
    assert.notStrictEqual(quickAnswerForPage(pa), quickAnswerForPage(pb), `${a} and ${b} share a quick answer`);
  }
});

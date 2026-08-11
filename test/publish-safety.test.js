const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findUnapprovedRenderedTargets } = require('../_ops/validators/validate_publish_safety_gate');
function fixture(targets, rendered = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-publish-safety-'));
  fs.mkdirSync(path.join(root, 'data/queries'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/queries/page_targets.json'), JSON.stringify(targets));
  for (const slug of rendered) {
    const dir = path.join(root, 'dist', slug.replace(/^\/+|\/+$/g, ''));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>fixture</title>');
  }
  return root;
}
test('approved rendered target is allowed', () => {
  const root=fixture([{page_id:'a',slug:'/a/',review_status:'approved'}], ['/a/']);
  assert.deepEqual(findUnapprovedRenderedTargets(root), []);
});
test('pending rendered target is rejected', () => {
  const root=fixture([{page_id:'p',slug:'/pending/',review_status:'pending'}], ['/pending/']);
  assert.equal(findUnapprovedRenderedTargets(root).length, 1);
});
test('rejected rendered target is rejected', () => {
  const root=fixture([{page_id:'r',slug:'/rejected/',review_status:'rejected'}], ['/rejected/']);
  assert.equal(findUnapprovedRenderedTargets(root)[0].review_status, 'rejected');
});
test('non-approved target absent from dist is safe', () => {
  const root=fixture([{page_id:'p',slug:'/pending/',review_status:'pending'}], []);
  assert.deepEqual(findUnapprovedRenderedTargets(root), []);
});
test('missing review status fails closed if rendered', () => {
  const root=fixture([{page_id:'m',slug:'/missing/'}], ['/missing/']);
  assert.equal(findUnapprovedRenderedTargets(root)[0].review_status, 'missing');
});

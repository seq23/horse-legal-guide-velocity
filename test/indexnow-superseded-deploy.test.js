const test = require('node:test');
const assert = require('node:assert/strict');
const { pagesDeployState } = require('../scripts/indexing/pages_deploy_state.cjs');

const done = (conclusion) => ({ status: 'completed', conclusion });
const running = { status: 'in_progress', conclusion: null };

test('own Pages check decides when it completes', () => {
  assert.equal(pagesDeployState({ sha: 'a', own: done('success'), headSha: 'b', head: done('failure') }).state, 'live');
  assert.equal(pagesDeployState({ sha: 'a', own: done('failure'), headSha: 'b', head: done('success') }).state, 'failed');
});

test('a superseded build (own check stuck in_progress) is live once main head, which contains it, deployed', () => {
  // 11 Oct 2026: 72204bf stuck in_progress ("Skipped" in Cloudflare), 3453450 deployed green.
  const d = pagesDeployState({ sha: '72204bf', own: running, headSha: '3453450', head: done('success') });
  assert.equal(d.state, 'live');
  assert.equal(d.via, '3453450');
});

test('a superseded build whose head deploy failed is a failed deploy, never live', () => {
  assert.equal(pagesDeployState({ sha: 'a', own: running, headSha: 'b', head: done('failure') }).state, 'failed');
});

test('it keeps waiting while nothing containing the commit has finished', () => {
  assert.equal(pagesDeployState({ sha: 'a', own: running, headSha: 'a', head: null }).state, 'wait');
  assert.equal(pagesDeployState({ sha: 'a', own: running, headSha: 'b', head: running }).state, 'wait');
  assert.equal(pagesDeployState({ sha: 'a', own: null, headSha: 'b', head: null }).state, 'wait');
});

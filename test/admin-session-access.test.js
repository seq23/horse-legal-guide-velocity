// The client admin's login and access control, as behaviour (restored 10 Nov
// 2026 from the cut validate_assisted_operations_e2e.mjs, hostile review):
// a signed session verifies, a wrong secret is rejected, actionPlan only
// dispatches allowlisted workflows, and empty or stale selections are refused.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.resolve(__dirname, '..', 'functions/_shared/github_admin.js')).href);
const session = { login: 'fixture-owner' };

test('a signed admin session verifies only with its own secret', async () => {
  const admin = await load();
  const signed = await admin.signPayload('fixture-secret', { purpose: 'session', exp: Math.floor(Date.now() / 1000) + 60 });
  assert.equal((await admin.verifyPayload('fixture-secret', signed))?.purpose, 'session');
  assert.equal(await admin.verifyPayload('wrong-secret', signed), null);
});

test('actionPlan dispatches only allowlisted workflows and refuses bad input', async () => {
  const admin = await load();
  const plan = admin.actionPlan('approve_selected', { ids: ['draft-fixture'] }, session);
  assert.equal(plan.workflow, 'admin-bulk-content-actions.yml');
  assert.equal(plan.inputs.action, 'approve_many');
  assert.throws(() => admin.actionPlan('approve_selected', { ids: [] }, session));
  assert.throws(() => admin.actionPlan('not_a_real_action', { ids: ['draft-fixture'] }, session));
  assert.throws(() => admin.actionPlan('set_publish_date_selected', { ids: ['draft-fixture'], publish_date: 'tomorrow' }, session));
});

test('only ids in the current editorial manifest can be dispatched', async () => {
  const admin = await load();
  const ctx = { request: new Request('https://horselegalguide.com/api/admin/action'), env: { ASSETS: { fetch: async (req) => {
    if (new URL(req.url).pathname === '/admin/editorial_manifest.json') return new Response(JSON.stringify({ items: [{ entry_id: 'draft-fixture' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('{}', { status: 404 });
  } } } };
  assert.equal((await admin.validateSelectedIds(ctx, 'approve_selected', ['draft-fixture'])).length, 1);
  await assert.rejects(() => admin.validateSelectedIds(ctx, 'approve_selected', ['draft-stale']));
});

// The weekly entity_backlink_watch: resolve, link-back, self-heal, named stops.
const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../scripts/entity/entity_backlink_watch.mjs');
const fakeFetch = (table) => async (url) => {
  const row = table[url];
  if (!row) { const e = new Error('fetch failed'); e.cause = { code: 'ENOTFOUND' }; throw e; }
  return { status: row.status, ok: row.status >= 200 && row.status < 300, text: async () => row.body || '' };
};
const base = {
  site_host: 'horselegalguide.com',
  sameAs: ['https://firm.example', 'https://www.facebook.com/firm', 'https://www.instagram.com/firm'],
  profiles_pending: ['https://www.pinterest.com/firm'],
  profiles_awaiting_client_approval: [{ url: 'https://x.com/firm', evidence: 'test' }],
};

test('dead sameAs is removed, pending that resolves is promoted, awaiting-approval never is', async () => {
  const { runWatch } = await load();
  const { entity, report } = await runWatch(base, { delayMs: 0, fetchImpl: fakeFetch({
    'https://firm.example': { status: 200, body: '<a href="https://horselegalguide.com/">guide</a>' },
    'https://www.facebook.com/firm': { status: 404 },
    'https://www.instagram.com/firm': { status: 200, body: '<div id="root"></div>' },
    'https://www.pinterest.com/firm': { status: 200, body: '' },
  }) });
  assert.deepEqual(entity.sameAs, ['https://firm.example', 'https://www.instagram.com/firm', 'https://www.pinterest.com/firm']);
  assert.deepEqual(entity.profiles_pending, []);
  assert.equal(entity.removed_same_as.length, 1);
  assert.equal(entity.removed_same_as[0].url, 'https://www.facebook.com/firm');
  assert.ok(!entity.sameAs.includes('https://x.com/firm'));
  assert.equal(report.changed, true);
  const byUrl = Object.fromEntries(report.rows.map((r) => [r.url, r]));
  assert.equal(byUrl['https://firm.example'].link_back, 'present');
  assert.equal(byUrl['https://www.instagram.com/firm'].link_back, 'unverifiable');
  assert.ok(report.named_stops.some((s) => s.startsWith('NAMED_STOP: SAME_AS_AWAITING_CLIENT_APPROVAL https://x.com/firm')));
});

test('a plain site without a link back is a named stop naming where to fix it', async () => {
  const { runWatch } = await load();
  const { report, entity } = await runWatch({ site_host: 'horselegalguide.com', sameAs: ['https://firm.example'] }, { delayMs: 0, fetchImpl: fakeFetch({ 'https://firm.example': { status: 200, body: 'no link here' } }) });
  assert.equal(report.changed, false);
  assert.deepEqual(entity.sameAs, ['https://firm.example']);
  const stop = report.named_stops.find((s) => s.startsWith('NAMED_STOP: LINK_BACK_MISSING https://firm.example'));
  assert.ok(stop, 'missing link-back must be a named stop');
  assert.match(stop, /https:\/\/horselegalguide\.com/);
});

test('a 5xx is unreachable, kept and named - never removed on a transient failure', async () => {
  const { runWatch } = await load();
  const { entity, report } = await runWatch({ site_host: 'horselegalguide.com', sameAs: ['https://firm.example'] }, { delayMs: 0, fetchImpl: fakeFetch({ 'https://firm.example': { status: 503 } }) });
  assert.deepEqual(entity.sameAs, ['https://firm.example']);
  assert.equal(report.rows[0].state, 'unreachable');
  assert.ok(report.named_stops.some((s) => s.startsWith('NAMED_STOP: SAME_AS_UNREACHABLE')));
});

test('rule 0: an empty sameAs fails rather than passing having examined nothing', async () => {
  const { runWatch } = await load();
  await assert.rejects(runWatch({ site_host: 'horselegalguide.com', sameAs: [] }, { delayMs: 0, fetchImpl: fakeFetch({}) }), /RULE_0/);
});

test('the committed entity.json is a client record: firm site in sameAs, no parent, nothing self-referential', () => {
  const entity = require('../data/entities/entity.json');
  assert.equal(entity.site_kind, 'client');
  assert.equal(entity.parentOrganization, null);
  assert.ok(entity.sameAs.includes('https://wisecovington.com'));
  assert.ok(entity.sameAs.every((u) => !new URL(u).hostname.endsWith('horselegalguide.com')));
});

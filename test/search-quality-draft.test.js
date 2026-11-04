'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const q = require('../scripts/lib/search_quality_draft');
const queue = require('../scripts/search_loop/owner_queue');

test('quality repair is inert until the same admin queue approves it, and revoke restores the original', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hlg-quality-'));
  const cwd = process.cwd();
  const forced = process.env.PREVIEW_SITE_CHANGES;
  delete process.env.PREVIEW_SITE_CHANGES;
  fs.mkdirSync(path.join(root, 'data/site_changes'), {recursive:true});
  fs.writeFileSync(path.join(root, 'data/site_changes/queue.json'), JSON.stringify({changes:[{id:q.CHANGE,status:'pending',queued_at:'2026-11-03'}]}));
  process.chdir(root);
  try {
    for (const p of q.intents) {
      const title = ({'purchase-contract':'Do I need a contract to buy a horse?', 'lease-unsoundness':'A leased horse became unsound. Who pays?', 'demand-letter':'I received a demand letter. What should I do first?', 'trainer-owner-liability':'Trainer Liability vs Owner Liability'})[p.id];
      assert.equal(q.profileFor(title), p);
      const body = `<header><h1>${title}</h1><p>Old generic copy.</p></header><section class="answer-shape-module" data-query-family="comparison" data-answer-shape="top_comparison_table"><p>generic</p></section><a href="/leases/">Lease guides</a><a href="/leases/">Lease guides again</a><section class="routing-block" data-editable-zone="routing_block"><p>Educational only; not legal advice.</p></section>`;
      const input = {body,title,url:'/some-other-route/'};
      assert.equal(q.improveBody(input).body,body,'pending changes nothing, including unlisted URLs');
      const preview = q.improveBody({...input,preview:true}).body;
      assert.ok(preview.includes(p.lead));
      assert.ok(!preview.includes('Old generic copy'));
      assert.ok(preview.includes('data-answer-shape="top_comparison_table"'));
      assert.ok(preview.includes('data-editable-zone="routing_block"'), 'the original routing and disclaimer survive');
      assert.equal((preview.match(/href="\/leases\/"/g)||[]).length,1,'navigation destination survives once');
      assert.equal((preview.match(/<h1>/g)||[]).length,1);
    }
    queue.decide([`change:${q.CHANGE}`],'approve');
    const body='<h1>A leased horse became unsound. Who pays?</h1>';
    const after=q.improveBody({body,url:'/not-a-sample/'});
    assert.notEqual(after.body,body);
    const decided=JSON.parse(fs.readFileSync('data/site_changes/queue.json')).changes[0].decided_at;
    assert.equal(after.dateModified,decided,'actual approval date, not queued date or a rolling freshness claim');
    queue.decide([`change:${q.CHANGE}`],'reject');
    assert.equal(q.improveBody({body,url:'/not-a-sample/'}).body,body);
    assert.equal(q.improveBody({body:'<h1>Unrelated question</h1>',url:'/unrelated/'}).body,'<h1>Unrelated question</h1>');
  } finally { if (forced === undefined) delete process.env.PREVIEW_SITE_CHANGES; else process.env.PREVIEW_SITE_CHANGES = forced; process.chdir(cwd); fs.rmSync(root,{recursive:true,force:true}); }
});


test('an actual modification date does not invent an original publication date', () => {
  const {writeJsonLd} = require('../scripts/lib/write_jsonld');
  const doc = JSON.parse(writeJsonLd('article','Example','Example description','/example/',{dateModified:'2026-11-03'}));
  const nodes=doc['@graph'].filter(n=>n['@type']==='Article'||n['@type']==='WebPage');
  assert.equal(nodes.length,2);
  for(const node of nodes){
    assert.equal(node.dateModified,'2026-11-03');
    assert.equal('datePublished' in node,false);
  }
});

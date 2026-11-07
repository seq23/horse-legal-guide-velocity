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

test('every generated query page gets the template repair once approved, and none of it while pending', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hlg-quality-tpl-'));
  const cwd = process.cwd();
  const forced = process.env.PREVIEW_SITE_CHANGES;
  delete process.env.PREVIEW_SITE_CHANGES;
  fs.mkdirSync(path.join(root, 'data/site_changes'), {recursive:true});
  fs.writeFileSync(path.join(root, 'data/site_changes/queue.json'), JSON.stringify({changes:[{id:q.CHANGE,status:'pending',queued_at:'2026-11-03'}]}));
  process.chdir(root);
  try {
    const answer = 'This question belongs to the boarding cluster. The useful move is to identify the agreement.';
    const body = `<header class="content-header"><span class="eyebrow">Scenario page</span><h1>Can a barn keep a horse for unpaid board?</h1><p class="muted">General educational information for equestrians.</p></header>
<section class="signal-block"><h2>Real question patterns this page is built around</h2><ul><li>can a barn keep a horse for unpaid board</li></ul></section>
<section class="accordion-section faq-accordion" data-editable-zone="faq_block"><h2>Signal-backed FAQ</h2><details open><summary>What should someone know about can a barn keep a horse for unpaid board?</summary><p>Start with the documents.</p></details>
<details><summary>a barn keep a horse for unpaid board</summary><p>${answer}</p></details>
<details><summary>Barn Keep a Horse for Unpaid Board</summary><p>${answer}</p></details>
<details><summary>What Is a Stable Lien?</summary><p>${answer}</p></details>
<details><summary>Who Owns the Horse During a Dispute?</summary><p>${answer}</p></details></section>
<nav><a href="/hubs/boarding-training-and-barn-operations/">Back to Boarding Training And Barn Operations</a> <a href="/reference/what-equine-legal-issues-should-someone-consider-in-x/">What equine legal issues should someone consider in X?</a></nav>`;
    const input = {body, title:'Can a barn keep a horse for unpaid board?', url:'/scenario/any-generated-page/'};
    assert.equal(q.improveBody(input).body, body, 'pending: byte-identical');
    const after = q.improveBody({...input, preview:true});
    const out = after.body;
    assert.ok(out.includes('class="signal-block"') && !/signal-block[\s\S]*?<ul>/.test(out.split('faq-accordion')[0]), 'provenance note stays, the query-variant list is gone');
    const def = out.match(/<p class="site-definition">([^<]*)<\/p>/)?.[1];
    assert.ok(def, 'a definition sits under the H1');
    const n = def.split(/\s+/).length;
    assert.ok(n >= 40 && n <= 60 && /\bis\b/.test(def), `definition is 40-60 words and defines (${n})`);
    assert.ok(!def.toLowerCase().includes('unpaid board'), 'the definition does not restate the H1');
    assert.match(out, /rel="author">Wise Covington PLLC<\/a> · Updated <time datetime="2026-11-03">/);
    assert.equal(after.dateModified, '2026-11-03');
    const qs = [...out.matchAll(/<summary>([^<]*)<\/summary>/g)].map(m => m[1]);
    assert.deepEqual(qs, ['What Is a Stable Lien?'], 'H1 restatements, fragments and repeated boilerplate answers are dropped');
    assert.match(out, /<details open><summary>What Is a Stable Lien\?/, 'the first kept entry stays open');
    assert.match(out, /href="\/reference\/what-equine-legal-issues-should-someone-consider-in-x\/">X\?<\/a>/, 'reference link keeps its target, loses the repeated prefix');
    assert.equal(q.improveBody({body:'<h1>Plain page</h1><p class="muted">x</p>', url:'/about/', preview:true}).body, '<h1>Plain page</h1><p class="muted">x</p>', 'pages the query generator did not build are untouched');
  } finally { if (forced === undefined) delete process.env.PREVIEW_SITE_CHANGES; else process.env.PREVIEW_SITE_CHANGES = forced; process.chdir(cwd); fs.rmSync(root,{recursive:true,force:true}); }
});

test('editorial, hub and section pages get the publisher line and lose the topic slotted into every sentence, only once approved', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hlg-quality-ed-'));
  const cwd = process.cwd();
  const forced = process.env.PREVIEW_SITE_CHANGES;
  delete process.env.PREVIEW_SITE_CHANGES;
  fs.mkdirSync(path.join(root, 'data/site_changes'), {recursive:true});
  fs.writeFileSync(path.join(root, 'data/site_changes/queue.json'), JSON.stringify({changes:[{id:q.CHANGE,status:'pending',queued_at:'2026-11-03'}]}));
  process.chdir(root);
  try {
    const t = 'What Happens If a Horse Sale Goes Wrong';
    const body = `<nav><a href="/">Home</a> · <span>${t}</span></nav><header class="content-header"><span class="eyebrow">Insight · 2026-05-07</span><h1>Money, possession, and risk transfer for ${t}</h1></header>
<section class="quick-answer-block"><h2>Quick answer</h2><p><strong>The practical question behind ${t} is not answered safely by repeating a general overview.</strong></p></section>
<article><p>&lt;!-- UNIQUE_SELF_HEAL_START --&gt;</p> <h2>Decision sequence</h2><ol><li>Define the narrow decision: what must be decided about <strong>${t}</strong> before anyone acts?</li></ol>
<p>Imagine one operational detail tied to <strong>${t}</strong>.</p><table><tr><td>Names and signature authority tied to ${t}</td></tr></table>
<ul><li><a href="/insights/x/">${t}</a></li></ul></article>`;
    const input = {body, title: t, url: '/insights/2026-05-07/a-plain-english-note/'};
    assert.equal(q.improveBody(input).body, body, 'pending: byte-identical');
    const out = q.improveBody({...input, preview: true});
    const visible = out.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.ok((visible.match(new RegExp(t, 'gi')) || []).length <= 3, 'the topic is named at most three times');
    assert.match(out.body, /<h1>Money, possession, and risk transfer for What Happens If a Horse Sale Goes Wrong<\/h1>/, 'the H1 is kept');
    assert.match(out.body, /<a href="\/insights\/x\/">What Happens If a Horse Sale Goes Wrong<\/a>/, 'link labels are kept');
    assert.match(out.body, /The practical question here is not answered/);
    assert.match(out.body, /tied to <strong>this topic<\/strong>/);
    assert.match(out.body, /rel="author">Wise Covington PLLC<\/a> · Updated <time datetime="2026-11-03">/);
    assert.ok(!out.body.includes('UNIQUE_SELF_HEAL'), 'the leaked marker is gone');
    assert.equal(out.dateModified, '2026-11-03');
    // Negative: a page outside the content sections, and a page that names its topic three times, are untouched.
    assert.equal(q.improveBody({...input, url: '/about/', preview: true}).body.includes('rel="author"'), false);
    const calm = `<h1>${t}</h1><p>${t} is a question.</p><p>About ${t}.</p><p class="x">rel="author"</p>`;
    assert.equal(q.dedupeTopic(calm), calm);
  } finally { if (forced === undefined) delete process.env.PREVIEW_SITE_CHANGES; else process.env.PREVIEW_SITE_CHANGES = forced; process.chdir(cwd); fs.rmSync(root,{recursive:true,force:true}); }
});

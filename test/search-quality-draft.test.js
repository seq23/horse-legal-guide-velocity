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
  fs.writeFileSync(path.join(root, 'data/site_changes/queue.json'), JSON.stringify({changes:[{id:q.SHAPE,status:'pending',queued_at:'2026-11-03'}]}));
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
  fs.writeFileSync(path.join(root, 'data/site_changes/queue.json'), JSON.stringify({changes:[{id:q.SHAPE,status:'pending',queued_at:'2026-11-03'}]}));
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

test('the reshape goes live on its own; the new topic writing waits for the owners', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hlg-quality-split-'));
  const cwd = process.cwd();
  const forced = process.env.PREVIEW_SITE_CHANGES;
  delete process.env.PREVIEW_SITE_CHANGES;
  fs.mkdirSync(path.join(root, 'data/site_changes'), {recursive:true});
  fs.writeFileSync(path.join(root, 'data/site_changes/queue.json'), JSON.stringify({changes:[
    {id:q.SHAPE,status:'approved',queued_at:'2026-11-03',decided_at:'2026-11-07',approved_by:'Sequoia Taylor (site manager)'},
    {id:q.CHANGE,status:'pending',queued_at:'2026-11-03'}]}));
  process.chdir(root);
  try {
    const title = 'A leased horse became unsound. Who pays?';
    const lease = q.intents.find(p => p.id === 'lease-unsoundness');
    const body = `<header class="content-header"><span class="eyebrow">Scenario page</span><h1>${title}</h1><p class="muted">General educational information for equestrians.</p></header>
<section class="signal-block"><h2>Real question patterns this page is built around</h2><ul><li>leased horse unsound who pays</li></ul></section>`;
    const live = q.improveBody({body, title, url:'/scenario/a-leased-horse-became-unsound-who-pays/'});
    assert.match(live.body, /<p class="site-definition">/, 'the reshape is live');
    assert.match(live.body, /rel="author">Wise Covington PLLC<\/a> · Updated <time datetime="2026-11-07">/, 'dated the day it went live');
    assert.ok(!/Real question patterns/.test(live.body));
    assert.equal(live.dateModified, '2026-11-07');
    for (const p of q.intents) {
      assert.ok(!live.body.includes(p.lead), 'no new topic writing while the owners have not approved it');
      assert.ok(!live.body.includes(p.source.replace(/&/g, '&amp;')) || p.source === 'https://wisecovington.com', 'no new legal source while pending');
    }
    assert.ok(!/ncleg\.gov/.test(live.body));
    // The owners approve the topic writing through the same queue: it then replaces the template.
    queue.decide([`change:${q.CHANGE}`], 'approve');
    const after = q.improveBody({body, title, url:'/scenario/a-leased-horse-became-unsound-who-pays/'});
    assert.ok(after.body.includes(lease.lead));
    // Revoking the reshape alone leaves an unrelated page byte-identical.
    const sc = JSON.parse(fs.readFileSync('data/site_changes/queue.json'));
    sc.changes[0].status = 'declined';
    fs.writeFileSync('data/site_changes/queue.json', JSON.stringify(sc));
    const other = body.replace(title, 'Can a barn keep a horse for unpaid board?');
    assert.equal(q.improveBody({body: other, title: 'x', url:'/scenario/other/'}).body, other);
  } finally { if (forced === undefined) delete process.env.PREVIEW_SITE_CHANGES; else process.env.PREVIEW_SITE_CHANGES = forced; process.chdir(cwd); fs.rmSync(root,{recursive:true,force:true}); }
});

test('new claims never go live on the site manager\'s approval: only the owners approve the topic writing', () => {
  const {readQueue} = require('../scripts/lib/site_changes');
  const changes = readQueue(path.join(__dirname, '..')).changes;
  const topics = changes.find(c => c.id === q.CHANGE);
  const shape = changes.find(c => c.id === q.SHAPE);
  assert.ok(topics && shape, 'both rows are in the real queue');
  assert.ok(!(topics.status === 'approved' && /site manager/i.test(topics.approved_by || '')), 'the topic writing is approved only by the owners in /admin/');
  if (shape.status === 'approved') assert.match(shape.decided_at || '', /^\d{4}-\d{2}-\d{2}$/, 'the reshape carries its real go-live date');
});

test('the shared checklist leaves every query page for one page once the reshape is approved, and the insight opening grows from its own paragraph', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hlg-quality-checklist-'));
  const cwd = process.cwd();
  const forced = process.env.PREVIEW_SITE_CHANGES;
  delete process.env.PREVIEW_SITE_CHANGES;
  fs.mkdirSync(path.join(root, 'data/site_changes'), {recursive:true});
  const setQueue = (status) => fs.writeFileSync(path.join(root, 'data/site_changes/queue.json'), JSON.stringify({changes:[{id:q.SHAPE,status,queued_at:'2026-11-03',decided_at:'2026-11-07'}]}));
  setQueue('pending');
  // renderLayout reads the site config, templates and the one action from cwd.
  for (const rel of ['data/system/config.json', 'data/entities', 'data/firm', 'search-loop.config.json', 'templates', 'config']) fs.cpSync(path.join(cwd, rel), path.join(root, rel), {recursive: true});
  // write_pages.js reads repo data relative to cwd only at build time; requiring it here is side-effect free.
  const { SHARED_CHECKLIST } = require('../scripts/build/write_pages');
  const { writeSharedChecklist } = require('../scripts/build/write_shared_checklist');
  process.chdir(root);
  try {
    const own = '<section class="answer-shape-module" data-editable-zone="top_answer_module"><h2>Timeline and process map</h2><p>own module</p></section>';
    const shared = Object.values(SHARED_CHECKLIST).join('\n');
    const body = `<header class="content-header"><span class="eyebrow">Scenario page</span><h1>Can a barn keep a horse for unpaid board?</h1><p class="muted">x</p></header>
<section class="quick-answer-block"><h2>Quick answer</h2><p>Own answer.</p></section>${own}
<section class="signal-block"><h2>Real question patterns this page is built around</h2><ul><li>q</li></ul></section>
<section><h2>What matters first</h2><p>This is a boarding scenario.</p></section>
${shared}`;
    const input = {body, title:'Can a barn keep a horse for unpaid board?', url:'/scenario/any/'};
    assert.equal(q.improveBody(input).body, body, 'pending: byte-identical');
    const dist = path.join(root, 'dist');
    assert.equal(writeSharedChecklist(dist), null, 'no shared page while pending');
    setQueue('approved');
    const out = q.improveBody(input).body;
    for (const h of ['What matters first', 'Fast triage framework', 'What to gather before you act', 'What not to do', 'Practical next move', 'Common mistakes', 'What to do next', 'What usually decides the answer']) {
      assert.ok(!out.includes(`<h2>${h}</h2>`), `${h} left the page`);
    }
    assert.equal((out.match(new RegExp(`href="${q.CHECKLIST_URL}"`, 'g')) || []).length, 1, 'one link to the shared checklist');
    assert.ok(out.includes('own module') && out.includes('Own answer.'), 'what is the page\'s own stays');
    // The shared page holds each checklist section's text exactly once.
    const html = fs.readFileSync(path.join(writeSharedChecklist(dist), 'index.html'), 'utf8');
    for (const sec of Object.values(SHARED_CHECKLIST)) {
      const firstItem = sec.match(/<(?:td|li|p)>([^<]{20,})</)[1];
      assert.equal(html.split(firstItem).length - 1, 1, `on the shared page once: ${firstItem.slice(0, 40)}`);
    }
    // Insight opening: the quick answer takes the next sentences of the page's own first paragraph, up to 60 words.
    const para = 'The practical question here is not answered by a general overview. This version focuses on risk. A responsible first pass separates the parties, documents, timing, money, possession, communications, and state-specific facts before anyone treats a generic answer as a legal conclusion. A fourth sentence that would take the opening well past sixty words, because it keeps going about records, timelines, invoices, messages and every other document a reader might gather, is never added.';
    const ed = `<header class="content-header"><h1>Do I need a contract?</h1></header><section class="quick-answer-block" data-answer-summary="true"><h2>Quick answer</h2><p><strong>The practical question here is not answered by a general overview. This version focuses on risk.</strong></p></section><article><h2>Citation-ready answer</h2>\n<p>${para}</p></article>`;
    const opened = q.improveBody({body: ed, title: 'Do I need a contract?', url: '/insights/2026-04-25/x/'}).body;
    const qa = opened.match(/quick-answer-block[\s\S]*?<strong>([\s\S]*?)<\/strong>/)[1];
    const n = qa.split(/\s+/).length;
    assert.ok(n >= 40 && n <= 60, `opening is 40-60 words (${n})`);
    assert.ok(para.startsWith(qa), 'only the page\'s own sentences, in order: ' + qa);
    const other = ed.replace(para, 'A different paragraph that does not begin with the quick answer.');
    assert.equal(q.improveBody({body: other, title: 'Do I need a contract?', url: '/insights/2026-04-25/x/'}).body.includes('A responsible first pass'), false, 'nothing borrowed from elsewhere');
  } finally { if (forced === undefined) delete process.env.PREVIEW_SITE_CHANGES; else process.env.PREVIEW_SITE_CHANGES = forced; process.chdir(cwd); fs.rmSync(root,{recursive:true,force:true}); }
});

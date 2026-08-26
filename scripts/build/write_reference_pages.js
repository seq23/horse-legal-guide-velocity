const fs = require('fs');
const path = require('path');
const { renderLayout } = require('../lib/render_page');
const { renderModule, quickAnswerForPage } = require('../lib/answer_shape');
const { validatePostRenderPage } = require('./validate_page_contract_post_render');
const { findManifest, loadPatchForManifest, loadPatchForSlug, applyZoneOperations } = require('../lib/page_patch_utils');
const { breadcrumbNav, pickSiblings, rotate, siblingBlock, wayfindingNav } = require('../lib/site_navigation');
function ensureDir(p){fs.mkdirSync(p,{recursive:true});}
function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function slugify(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function readJson(rel,fallback){try{return JSON.parse(fs.readFileSync(path.resolve(process.cwd(),rel),'utf8'));}catch{return fallback;}}
function unique(list){return [...new Set((list||[]).filter(Boolean))];}
function referenceSlug(c){return c.slug||slugify(c.query||c.raw_phrasing||c.candidate_id);}
function applyPersistedPatchIfPresent(page, html) {
  const manifest = findManifest(page.slug);
  const patch = manifest ? loadPatchForManifest(manifest) : loadPatchForSlug(page.slug, page.slug && page.slug.startsWith('/reference/') ? 'reference' : 'page');
  if (!patch || !Array.isArray(patch.operations) || !patch.operations.length) return html;
  return applyZoneOperations(html, patch.operations);
}
function writeJson(file,data){ensureDir(path.dirname(file));fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');}
function resetDir(p){fs.rmSync(p,{recursive:true,force:true});fs.mkdirSync(p,{recursive:true});}
function buildReferenceBundle(refDir,candidates,context,options={}){
  resetDir(refDir);
  const {rawById,targetBySlug}=context;
  const master=[], trace=[], clusterMap=new Map(), results=[];
  // Reference surfaces filed by the cluster their own candidate record carries,
  // so a reference page can link the rest of its cluster. Before this a
  // /reference/ page linked five things: the reference index, the page it maps
  // to, the coverage map, and the two footer policy pages. It could not reach
  // its own topic hub, its own neighbours, or the homepage.
  const referenceByCluster = new Map();
  for (const c of candidates) {
    const slug = referenceSlug(c);
    const cl = c.cluster || (targetBySlug.get(c.mapped_slug) || {}).cluster || 'general';
    if (!referenceByCluster.has(cl)) referenceByCluster.set(cl, []);
    referenceByCluster.get(cl).push({ slug: `/reference/${slug}/`, title: c.query || c.raw_phrasing || slug });
  }
  const approvedByCluster = new Map();
  for (const t of targetBySlug.values()) {
    if (!t || !t.slug || t.review_status !== 'approved') continue;
    const cl = t.cluster || 'general';
    if (!approvedByCluster.has(cl)) approvedByCluster.set(cl, []);
    approvedByCluster.get(cl).push({ slug: t.slug, title: t.title || t.slug });
  }
  const allHubs = readJson('data/queries/clusters.json', []) || [];
  const llmLines=['# Horse Legal Guide — Signal Reference Layer','','Purpose: map public question patterns to original educational pages. No full user posts, private messages, usernames, or copied threads are stored here.',''];
  for(const candidate of candidates){
    const slug=referenceSlug(candidate), target=targetBySlug.get(candidate.mapped_slug)||{};
    const rawSignals=(candidate.source_signal_ids||[]).map(id=>rawById.get(id)).filter(Boolean);
    const sourceKeys=unique(rawSignals.map(s=>s.source_key));
    const targetUrl=candidate.mapped_slug||target.slug||'/';
    const cluster=candidate.cluster||target.cluster||'general';
    const query=candidate.query||candidate.raw_phrasing||target.primary_query||slug.replace(/-/g,' ');
    const type=candidate.intent||target.page_type||'answer';
    const pageModel={...target, slug:`/reference/${slug}/`, title:query, page_type:type, cluster, primary_query:query, supporting_queries:unique([query,candidate.raw_phrasing,...(target.supporting_queries||[])]).slice(0,8)};
    const entry={slug:targetUrl,reference_slug:`/reference/${slug}/`,type,cluster,primary_query:query,supporting_queries:pageModel.supporting_queries,source_signal_ids:candidate.source_signal_ids||[],fanout_ready:true,public_raw_excerpt_exposed:false};
    master.push(entry);
    trace.push({source_signal_ids:entry.source_signal_ids,normalized_id:candidate.candidate_id,mapped_slug:targetUrl,cluster,status:'processed'});
    if(!clusterMap.has(cluster)) clusterMap.set(cluster,{cluster,queries:[],scenarios:[],comparisons:[],faqs:[]});
    const bucket=clusterMap.get(cluster); bucket.queries.push(entry.primary_query); if(type==='scenario') bucket.scenarios.push(targetUrl); else if(type==='comparison') bucket.comparisons.push(targetUrl); else bucket.faqs.push(targetUrl);
    if(options.writeHtml!==false){
      const targetDir=path.join(refDir,slug); ensureDir(targetDir);
      const answerShape = renderModule(pageModel);
      let body=`
${breadcrumbNav(`/reference/${slug}/`, entry.primary_query)}
<header class="content-header"><span class="eyebrow">Reference surface</span><h1>${esc(entry.primary_query)}</h1><p class="muted">This is a crawlable signal-reference page. It maps one public question pattern to an original educational page without exposing raw user posts.</p></header>
<section class="quick-answer-block" data-answer-summary="true" data-editable-zone="quick_answer_block"><h2>Quick answer</h2><p><strong>${esc(quickAnswerForPage(pageModel))}</strong></p></section>
${answerShape.html.replace('<section class="answer-shape-module"', '<section class="answer-shape-module" data-editable-zone="top_answer_module"')}
<section data-editable-zone="faq_block"><h2>Question</h2><p>${esc(entry.primary_query)}</p></section>
<section><h2>Answer route</h2><p>This question is routed to <a href="${esc(targetUrl)}">${esc(target.title||targetUrl)}</a>, where the full educational explanation lives.</p></section>
<section><h2>Cluster</h2><p>${esc(cluster.replace(/-/g,' '))}</p></section>
<section><h2>Traceability</h2><p>Source lane count: ${esc(String(sourceKeys.length||1))}. Storage policy: metadata and short excerpt only. Full threads, usernames, private messages, and copied comments are not stored or published.</p></section>
<section><h2>Clean extraction answer</h2><p>${pageModel.page_type==='scenario' ? 'Treat this like a triage problem first: identify the controlling document, the timeline, what changed hands, the immediate risk, and the state-specific rule before you decide what to do next.' : 'For this type of horse-world legal question, the useful starting point is to identify the agreement, timeline, money or care exchange, documents, state-specific context, and what each side has already said in writing.'}</p></section>
<nav data-editable-zone="routing_block"><p><a href="/reference/">Reference index</a> · <a href="${esc(targetUrl)}">Mapped page</a> · <a href="/coverage/">Coverage map</a></p></nav>
${wayfindingNav(cluster)}`;
      body = applyPersistedPatchIfPresent(pageModel, body);
      // Measured after patching, and only enough to reach the standard: the
      // rest of this cluster's reference surfaces first, then the approved
      // educational pages in the same cluster, then the other topic hubs.
      const topUp = pickSiblings(body, `/reference/${slug}/`, [
        ...rotate(referenceByCluster.get(cluster) || [], slug).map((r) => ({ ...r, why: 'reference surface' })),
        ...rotate(approvedByCluster.get(cluster) || [], slug).map((r) => ({ ...r, why: 'educational page' })),
        ...allHubs.filter((h) => h.cluster !== cluster).map((h) => ({ slug: h.slug, title: h.title || h.cluster, why: 'topic hub' })),
      ]);
      body += `\n${siblingBlock({
        heading: 'The rest of this cluster',
        intro: `Other published surfaces filed under ${cluster.replace(/-/g, ' ')}, and the neighbouring topic hubs.`,
        items: topUp,
      })}`;
      const html=renderLayout({title:entry.primary_query,description:`Signal reference for ${entry.primary_query}`.slice(0,155),url:`/reference/${slug}/`,body,schemaType:'FAQPage'});
      const filePath = path.join(targetDir,'index.html');
      fs.writeFileSync(filePath, html);
      results.push({ page: pageModel, filePath, html, queryFamily: answerShape.queryFamily, moduleType: answerShape.moduleType, validation: validatePostRenderPage({ page: pageModel, filePath, html }) });
    }
    llmLines.push('Question: '+entry.primary_query);
    llmLines.push('Answer: This question maps to '+targetUrl+' and should be answered as general educational information, not legal advice. Key context: documents, timeline, state law, responsibility, and what changed hands.');
    llmLines.push('Related: '+targetUrl+' | /hubs/'+cluster+'/');
    llmLines.push('');
  }
  writeJson(path.join(refDir,'index.json'),{updated_at:new Date().toISOString(),entries:master});
  writeJson(path.join(refDir,'signal_trace.json'),{updated_at:new Date().toISOString(),trace});
  ensureDir(path.join(refDir,'fanout'));
  for(const [cluster,data] of clusterMap.entries()){data.queries=unique(data.queries);data.scenarios=unique(data.scenarios);data.comparisons=unique(data.comparisons);data.faqs=unique(data.faqs);writeJson(path.join(refDir,'fanout',`${cluster}.json`),data);}
  fs.writeFileSync(path.join(refDir,'llm.txt'),llmLines.join('\n'));
  return results;
}
function writeReferencePages(distDir,candidates){
  const raw=readJson('data/community/raw_signals.json',[]), targets=readJson('data/queries/page_targets.json',[]);
  const context={rawById:new Map(raw.map(s=>[s.signal_id,s])),targetBySlug:new Map(targets.map(t=>[t.slug,t]))};
  const results = buildReferenceBundle(path.join(distDir,'reference'),candidates,context,{writeHtml:true});
  buildReferenceBundle(path.resolve(process.cwd(),'reference'),candidates,context,{writeHtml:false});
  return results;
}
module.exports={writeReferencePages};

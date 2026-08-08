#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const startedAt=new Date().toISOString();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hlg-assisted-e2e-'));
const checks=[];
function ensure(condition,name,detail=''){checks.push({name,ok:Boolean(condition),detail});if(!condition)throw new Error(`${name}: ${detail}`);}
function mkdir(rel){fs.mkdirSync(path.join(temp,rel),{recursive:true});}
function writeJson(rel,value){const file=path.join(temp,rel);mkdir(path.dirname(rel));fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
function readJson(rel){return JSON.parse(fs.readFileSync(path.join(temp,rel),'utf8'));}
function copy(rel){const target=path.join(temp,rel);mkdir(path.dirname(rel));fs.copyFileSync(path.join(root,rel),target);}
function run(args,env={}){const result=spawnSync(process.execPath,args,{cwd:temp,encoding:'utf8',env:{...process.env,...env}});return {status:result.status,stdout:result.stdout,stderr:result.stderr};}
try{
  const admin=await import(pathToFileURL(path.join(root,'functions/_shared/github_admin.js')).href);
  const session={login:'fixture-owner'};
  const signed=await admin.signPayload('fixture-secret',{purpose:'session',exp:Math.floor(Date.now()/1000)+60});
  ensure((await admin.verifyPayload('fixture-secret',signed))?.purpose==='session','signed session verifies');
  ensure((await admin.verifyPayload('wrong-secret',signed))===null,'wrong signing secret rejected');
  const approval=admin.actionPlan('approve_selected',{ids:['draft-fixture']},session);
  ensure(approval.workflow==='admin-bulk-content-actions.yml'&&approval.inputs.action==='approve_many','approval dispatch is allowlisted');
  let missingIds=false;try{admin.actionPlan('approve_selected',{ids:[]},session);}catch{missingIds=true;}
  ensure(missingIds,'approval requires selected IDs');
  let badDate=false;try{admin.actionPlan('set_publish_date_selected',{ids:['draft-fixture'],publish_date:'tomorrow'},session);}catch{badDate=true;}
  ensure(badDate,'invalid publish date rejected');
  let badRemediation=false;try{admin.actionPlan('approve_remediation',{ids:['proposal-fixture'],approved_action:'automatic_everything'},session);}catch{badRemediation=true;}
  ensure(badRemediation,'unsupported remediation rejected');
  const assetContext={request:new Request('https://horselegalguide.com/api/admin/action'),env:{ASSETS:{fetch:async(request)=>{const pathname=new URL(request.url).pathname;if(pathname==='/admin/editorial_manifest.json')return new Response(JSON.stringify({items:[{entry_id:'draft-fixture'}]}),{status:200,headers:{'content-type':'application/json'}});return new Response('{}',{status:404});}}}};
  ensure((await admin.validateSelectedIds(assetContext,'approve_selected',['draft-fixture'])).length===1,'current manifest selection accepted');
  let staleRejected=false;try{await admin.validateSelectedIds(assetContext,'approve_selected',['draft-stale']);}catch{staleRejected=true;}
  ensure(staleRejected,'unknown or stale selection rejected before dispatch');

  copy('scripts/query/admit_provider_candidates.js');
  writeJson('data/query_intelligence/provider_opportunities.json',{schema_version:'1.0.0',opportunities:[
    {opportunity_id:'provider-opportunity-fixture',query:'What should be in a horse co-ownership agreement?',type:'new_candidate',metrics:{impressions:40,clicks:0},status:'pending_owner_review',automatic_approval:false,automatic_publication:false,live_page_change_authorized:false},
    {opportunity_id:'provider-opportunity-existing',query:'Horse sale contract',type:'improve_existing',metrics:{impressions:90,clicks:2},status:'pending_owner_review',automatic_approval:false,automatic_publication:false,live_page_change_authorized:false}
  ]});
  writeJson('data/system/editorial_backlog.json',[]);writeJson('data/system/content_calendar.json',[]);
  const admit=run(['scripts/query/admit_provider_candidates.js','provider-opportunity-fixture','provider-opportunity-existing']);
  ensure(admit.status===0,'provider candidate admission succeeds',admit.stderr||admit.stdout);
  const backlog=readJson('data/system/editorial_backlog.json');
  ensure(backlog.length===1,'only new-candidate opportunity admitted');
  ensure(backlog[0].status==='pending'&&backlog[0].review_status==='pending'&&backlog[0].approval_required===true,'admitted provider draft remains pending and approval-required');
  const secondAdmit=run(['scripts/query/admit_provider_candidates.js','provider-opportunity-fixture']);
  ensure(secondAdmit.status===0&&readJson('data/system/editorial_backlog.json').length===1,'provider admission is idempotent');

  copy('scripts/remediation/manage_remediations.js');copy('scripts/remediation/apply_search_controls.js');
  const proposal={proposal_id:'remediation-fixture',ledger_id:'fixture',status:'pending_owner_approval',approved_action:null,approved_by:null,approved_at:null,applied_at:null,rejected_at:null,candidate_primary:'/faq/fixture-primary/',members:['/faq/fixture-primary/','/reference/fixture-duplicate/'],families:['faq','reference'],reasons:['high_body_similarity'],maximum_body_similarity:0.99,suggested_actions:['noindex_keep_llm','canonical_to_primary','redirect_to_primary','differentiate_patch'],approval_required_for_live_change:true,automatic_live_change:false,patch_plan:null};
  writeJson('data/remediation/remediation_queue.json',{schema_version:'1.0.0',policy:'Owner approval required.',summary:{total:1,pending_owner_approval:1,approved:0,applied:0,rejected:0},proposals:[proposal]});
  writeJson('data/remediation/applied_search_controls.json',{schema_version:'1.0.0',policy:'Only owner-approved controls.',controls:[]});
  const earlyApply=run(['scripts/remediation/manage_remediations.js','apply','','remediation-fixture'],{REQUESTED_BY:'fixture-owner'});
  ensure(earlyApply.status!==0&&`${earlyApply.stdout}${earlyApply.stderr}`.includes('not owner-approved'),'unapproved live remediation is blocked');
  const approve=run(['scripts/remediation/manage_remediations.js','approve','noindex_keep_llm','remediation-fixture'],{REQUESTED_BY:'fixture-owner'});
  ensure(approve.status===0,'owner approval is recorded',approve.stderr||approve.stdout);
  let queue=readJson('data/remediation/remediation_queue.json');
  ensure(queue.proposals[0].status==='approved'&&queue.proposals[0].approved_by==='fixture-owner','approval evidence is durable');
  const apply=run(['scripts/remediation/manage_remediations.js','apply','','remediation-fixture'],{REQUESTED_BY:'fixture-owner'});
  ensure(apply.status===0,'approved remediation applies',apply.stderr||apply.stdout);
  queue=readJson('data/remediation/remediation_queue.json');const controls=readJson('data/remediation/applied_search_controls.json');
  ensure(queue.proposals[0].status==='applied'&&controls.controls.length===1,'applied proposal creates one evidence-backed search control');

  mkdir('dist/reference/fixture-duplicate');
  fs.writeFileSync(path.join(temp,'dist/reference/fixture-duplicate/index.html'),'<!doctype html><html><head><link rel="canonical" href="https://horselegalguide.com/reference/fixture-duplicate/"></head><body>Fixture</body></html>');
  mkdir('dist');fs.writeFileSync(path.join(temp,'dist/sitemap-pages.xml'),'<?xml version="1.0"?><urlset><url><loc>https://horselegalguide.com/reference/fixture-duplicate/</loc></url><url><loc>https://horselegalguide.com/faq/fixture-primary/</loc></url></urlset>');
  fs.writeFileSync(path.join(temp,'dist/_redirects'),'');
  const applyBuild=run(['scripts/remediation/apply_search_controls.js']);
  ensure(applyBuild.status===0,'approved search control applies to dist',applyBuild.stderr||applyBuild.stdout);
  const html=fs.readFileSync(path.join(temp,'dist/reference/fixture-duplicate/index.html'),'utf8');const sitemap=fs.readFileSync(path.join(temp,'dist/sitemap-pages.xml'),'utf8');
  ensure(html.includes('noindex,follow'),'approved noindex control appears in rendered page');
  ensure(!sitemap.includes('/reference/fixture-duplicate/'),'approved noindex route removed from public sitemap');

  const report={schema_version:'1.0.0',started_at:startedAt,finished_at:new Date().toISOString(),ok:true,truth_boundary:'Isolated local behavior proof. Does not prove deployed Cloudflare OAuth, live GitHub workflow dispatch, or provider credentials.',checks,manual_approval_preserved:true,automatic_approval:false,automatic_publication:false,unapproved_live_remediation_blocked:true};
  fs.mkdirSync(path.join(root,'reports/integration'),{recursive:true});fs.writeFileSync(path.join(root,'reports/integration/assisted_operations_e2e.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Assisted operations E2E OK (${checks.length} assertions).`);
}catch(error){
  const report={schema_version:'1.0.0',started_at:startedAt,finished_at:new Date().toISOString(),ok:false,error:error.stack||error.message,checks};
  fs.mkdirSync(path.join(root,'reports/integration'),{recursive:true});fs.writeFileSync(path.join(root,'reports/integration/assisted_operations_e2e.json'),JSON.stringify(report,null,2)+'\n');
  console.error(error.stack||error.message);process.exitCode=1;
}finally{fs.rmSync(temp,{recursive:true,force:true});}

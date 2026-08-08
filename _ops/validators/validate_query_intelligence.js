const fs=require('fs');const path=require('path');
function fail(m){console.error(`QUERY_INTELLIGENCE_FAIL: ${m}`);process.exitCode=1;}
function read(rel){const p=path.resolve(process.cwd(),rel);if(!fs.existsSync(p)){fail(`${rel} missing`);return '';}return fs.readFileSync(p,'utf8');}
function json(rel){try{return JSON.parse(read(rel));}catch(e){fail(`${rel} invalid JSON: ${e.message}`);return {};}}
for(const rel of ['scripts/query/build_provider_query_intelligence.js','scripts/query/admit_provider_candidates.js','.github/workflows/query-intelligence.yml','data/query_intelligence/provider_opportunities.json','reports/query_intelligence/provider_opportunities.json'])read(rel);
const intel=json('data/query_intelligence/provider_opportunities.json');
if(!String(intel.policy||'').includes('may not approve'))fail('Provider intelligence policy must prohibit automatic approval.');
const allowedTypes=new Set(['new_candidate','improve_existing','differentiate_existing','cannibalization_review']);
const allowedStatuses=new Set(['pending_owner_review','admitted_as_pending_draft']);
for(const item of intel.opportunities||[]){
  if(!item.opportunity_id||!item.query)fail(`Malformed opportunity: ${JSON.stringify(item).slice(0,180)}`);
  if(!allowedTypes.has(item.type))fail(`${item.opportunity_id} invalid type ${item.type}`);
  if(!allowedStatuses.has(item.status))fail(`${item.opportunity_id} invalid status ${item.status}`);
  if(item.automatic_approval!==false||item.automatic_publication!==false||item.live_page_change_authorized!==false)fail(`${item.opportunity_id} violates approval boundary`);
  if(item.status==='admitted_as_pending_draft'&&!item.admitted_entry_id)fail(`${item.opportunity_id} admitted without pending entry ID`);
}
const backlog=json('data/system/editorial_backlog.json');
for(const entry of Array.isArray(backlog)?backlog:[]){if(!entry.provider_opportunity_id)continue;if(entry.status!=='pending'||entry.review_status!=='pending'||entry.approval_required!==true)fail(`${entry.entry_id} provider candidate is not pending and approval-required`);}
const admit=read('scripts/query/admit_provider_candidates.js');for(const marker of ["item.type!=='new_candidate'","status:'pending'","review_status:'pending'","approval_required:true","automatic_approval:false","automatic_publication:false"])if(!admit.includes(marker))fail(`Candidate admission missing marker ${marker}`);
const workflow=read('.github/workflows/query-intelligence.yml');for(const marker of ['workflow_dispatch:','admit_candidates','generate:drafts','content:self-heal','content:prevalidate','validate:all'])if(!workflow.includes(marker))fail(`Query intelligence workflow missing ${marker}`);
if(!process.exitCode)console.log(`Provider query-intelligence contract OK (${(intel.opportunities||[]).length} recommendations; admissions remain pending, self-healed, prevalidated, and client-approved).`);

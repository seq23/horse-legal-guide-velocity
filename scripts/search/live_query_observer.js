/**
 * Observe which public sources a live web-search layer actually cites for the
 * measurement panel, and whether horselegalguide.com is among them.
 *
 * Why the provider order is what it is.
 *
 * This observer has never once produced a successful observation. Every row in
 * data/search/query_observations.json and query_observation_history.json - 30 of
 * them, every run - is `provider_error`. Two separate faults produced that:
 *
 *   1. The model name was retired. gemini-2.5-flash-lite returns
 *      404 "no longer available to new users". Fixed separately by pinning the
 *      moving alias gemini-flash-lite-latest.
 *   2. The grounded path itself is blocked on this project. Gemini's
 *      tools:[{google_search:{}}] returns 429 RESOURCE_EXHAUSTED here,
 *      reproduced across three models and persistent, while plain
 *      generateContent on the same key returns 200. So fixing (1) alone would
 *      have swapped a 404 for a 429 and left the file exactly as empty.
 *
 * OpenRouter's web plugin does work on this account and returns the pages the
 * answer was built from as message.annotations[].url_citation. It is therefore
 * the primary provider. Gemini grounding is kept as a fallback rather than
 * deleted: it is the only provider here that reads Google's own index, so if the
 * quota block lifts it is the better measurement.
 *
 * Truth boundary: these are citation/surfacing observations, not organic rank.
 * rank_verified:false is recorded on every row for that reason.
 *
 * Rule 0: this stage may not exit 0 having done nothing. If every provider fails
 * for every panel query it records a named stop. A silent green run is what let
 * 30 dead rows look like a working integration.
 *
 * What decides red from a clean stop is WHY every provider failed, and the two
 * are not the same fault:
 *
 *   - Owner-held: 401/403 (key rejected or revoked), 402 (OpenRouter out of
 *     credits), 429 (Gemini quota exhausted), or no key configured at all.
 *     Nobody but the account owner can clear these, and a permanently red lane
 *     for a billing balance teaches everyone to ignore the monitor. These stop
 *     with a name, the provider, the HTTP status and the owner action, and exit
 *     0. Nothing is recorded as observed and provider_state stays DEGRADED.
 *   - Anything else: 5xx, connection failures, JSON that will not parse, a
 *     response shape the observer does not understand. That is a real break in
 *     the provider integration and it still exits non-zero. Making the whole
 *     blackout unconditionally green would convert exactly this case into a
 *     silent no-op, which is the defect the paragraph above exists to prevent.
 *
 * Observation resumes on the next run the moment credits or quota return; no
 * provider is disabled by any of this.
 */
const fs=require('fs');const path=require('path');
// OpenRouter bills the web plugin per REQUEST on the parallel engine with 10
// results included - measured at $0.00127/call on this account against ~$0.04
// on the default engine's per-result billing. Identical url_citation schema.
const WEB_ENGINE=process.env.OPENROUTER_WEB_ENGINE||'parallel';
const WEB_MODE=process.env.OPENROUTER_WEB_MODE||'turbo';
// The only HTTP statuses that mean "the account owner has to do something",
// never "the integration is broken". 401/403 key rejected, 402 out of credits,
// 429 quota or rate limit exhausted.
const OWNER_HELD_HTTP_STATUS=new Set([401,402,403,429]);
const OWNER_ACTION_BY_STATUS={401:'the API key was rejected - re-issue it and update the repository secret',403:'the API key is forbidden for this call - check the key\'s permissions/billing state on the provider account',402:'the account is out of credits - add credits (OpenRouter: https://openrouter.ai/settings/credits)',429:'the account quota or rate limit is exhausted - raise the quota or wait for the window to reset'};
function providerError(status,text){const e=new Error(`${status}: ${String(text).slice(0,500)}`);e.httpStatus=status;return e;}
// Every recorded failure must be classifiable. An attempt with no HTTP status -
// a timeout, a DNS failure, a JSON parse error, an unexpected body - is by
// definition not owner-held and keeps the lane red.
function isOwnerHeldAttempt(a){return Number.isInteger(a?.http_status)&&OWNER_HELD_HTTP_STATUS.has(a.http_status);}
function blackoutProviderStatuses(observations){
  const byKey=new Map();
  for(const o of observations)for(const a of o.provider_attempts||[]){
    if(a.status==='ok')continue;
    const key=`${a.provider}:${a.http_status??'no_http_status'}`;
    const row=byKey.get(key)||{provider:a.provider,http_status:Number.isInteger(a.http_status)?a.http_status:null,owner_held:isOwnerHeldAttempt(a),attempts:0,sample_error:String(a.error||'').slice(0,300)};
    row.attempts+=1;byKey.set(key,row);
  }
  return [...byKey.values()];
}
function read(rel,fallback){try{return JSON.parse(fs.readFileSync(path.resolve(process.cwd(),rel),'utf8'));}catch{return fallback;}}
function write(rel,v){const p=path.resolve(process.cwd(),rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');}
function clean(v){return String(v||'').replace(/\s+/g,' ').trim();}function host(u){try{return new URL(u).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}}function attributedHost(c){const title=String(c?.title||'').trim().toLowerCase().replace(/^www\./,'');if(/^[a-z0-9.-]+\.[a-z]{2,}$/.test(title))return title;return host(c?.url||'');}function isHorseCitation(c){const h=attributedHost(c);return h==='horselegalguide.com'||h.endsWith('.horselegalguide.com')||String(c?.title||'').toLowerCase().includes('horselegalguide.com');}
function strip(h){return clean(String(h||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '));}
function localFeatures(route){const p=path.resolve(process.cwd(),'dist',String(route||'/').replace(/^\/+|\/+$/g,''),'index.html');if(!fs.existsSync(p))return {route,status:'missing'};const h=fs.readFileSync(p,'utf8');const pick=(re)=>clean((h.match(re)||[])[1]||'');return {route,status:'ok',title:pick(/<title[^>]*>([\s\S]*?)<\/title>/i),description:pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i),h1:pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i),headings:[...h.matchAll(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi)].slice(0,25).map(m=>strip(m[1])),text_chars:strip(h).length,internal_links:(h.match(/href=["']\//g)||[]).length};}
async function pageFeatures(url){try{const r=await fetch(url,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 HorseLegalGuideSearchObserver/1.0'},signal:AbortSignal.timeout(12000)});const h=await r.text();if(!r.ok)return {url,status:'http_error',http_status:r.status};const pick=(re)=>clean((h.match(re)||[])[1]||'');return {url,resolved_url:r.url,status:'ok',http_status:r.status,title:pick(/<title[^>]*>([\s\S]*?)<\/title>/i),h1:pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i),headings:[...h.matchAll(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi)].slice(0,25).map(m=>strip(m[1])),text_chars:strip(h).length};}catch(e){return {url,status:'fetch_failed',error:e.message};}}
function parts(body){const c=body?.candidates?.[0]||{},g=c.groundingMetadata||{};return {answer:(c.content?.parts||[]).map(p=>p.text||'').join('\n'),search_queries:g.webSearchQueries||[],citations:(g.groundingChunks||[]).map(x=>x.web||x).filter(x=>x&&x.uri).map(x=>({url:x.uri,title:x.title||''}))};}
function promptFor(item){return `Use live web search to investigate this exact equine-law information query: ${JSON.stringify(item.query)}. The intended Horse Legal Guide page is https://horselegalguide.com${item.target_page}. Identify which public sources search surfaces/cites, whether horselegalguide.com is among those citations, and the strongest competing pages. Do not state or infer literal organic ranking positions. Do not treat competitor snippets as legal authority.`;}

// OpenRouter's `web` plugin runs the query against a live search index and
// returns each page the answer used as message.annotations[].url_citation.
// That annotation list IS the citation observation - it is not the model
// recalling a domain from training, which would prove nothing about retrieval.
async function observeOpenRouter(item,env){
  const model=env.OPENROUTER_SEARCH_MODEL||'openai/gpt-4o-mini';
  const maxResults=Math.max(1,Math.min(20,Number(env.OPENROUTER_WEB_MAX_RESULTS||10)));
  const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${env.OPENROUTER_API_KEY}`},body:JSON.stringify({model,temperature:0,max_tokens:600,plugins:[{id:'web',engine:WEB_ENGINE,mode:WEB_MODE,max_results:maxResults}],messages:[{role:'user',content:promptFor(item)}]}),signal:AbortSignal.timeout(Number(env.LIVE_QUERY_TIMEOUT_MS||45000))});
  const t=await r.text();
  if(!r.ok)throw providerError(r.status,t);
  const body=JSON.parse(t);const message=body?.choices?.[0]?.message||{};
  const seen=new Set();const citations=[];
  for(const a of message.annotations||[]){const c=a?.url_citation;if(!c?.url||seen.has(c.url))continue;seen.add(c.url);citations.push({url:c.url,title:clean(c.title||'')});}
  return {provider:'openrouter_web_search',model,answer:clean(message.content||''),search_queries:[item.query],citations};
}

// Gemini with tools:[{google_search:{}}] reads Google's own index, which is the
// stronger measurement when it is available. It is second because it is
// currently 429 RESOURCE_EXHAUSTED on this project.
async function observeGemini(item,env){
  const model=env.GEMINI_SEARCH_MODEL||'gemini-flash-lite-latest';
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:promptFor(item)}]}],tools:[{google_search:{}}],generationConfig:{temperature:.1}}),signal:AbortSignal.timeout(Number(env.GEMINI_SEARCH_TIMEOUT_MS||30000))});
  const t=await r.text();
  if(!r.ok)throw providerError(r.status,t);
  return {provider:'gemini_google_search_grounding',model,...parts(JSON.parse(t))};
}

function providerChain(env){
  const chain=[];
  if(env.OPENROUTER_API_KEY)chain.push({key:'openrouter_web_search',run:observeOpenRouter});
  if(env.GEMINI_API_KEY)chain.push({key:'gemini_google_search_grounding',run:observeGemini});
  const only=String(env.LIVE_QUERY_PROVIDER||'').trim();
  return only?chain.filter(p=>p.key.startsWith(only)):chain;
}

// Try providers in order and keep every failure. An observation that fell back
// records which provider answered, so a row can never be read as evidence about
// a provider that did not produce it.
async function observeOne(item,env,chain){
  const attempts=[];
  for(const p of chain){
    try{const result=await p.run(item,env);attempts.push({provider:p.key,status:'ok'});return {result,attempts};}
    catch(e){attempts.push({provider:p.key,status:'provider_error',http_status:Number.isInteger(e?.httpStatus)?e.httpStatus:null,error:e.message});}
  }
  return {result:null,attempts};
}

function diagnose(item,own,cites,siteSurfaced,competitors){const reasons=[];const surface=`${own.title||''} ${own.description||''} ${own.h1||''}`.toLowerCase();const qt=item.query.toLowerCase();if(own.status!=='ok')reasons.push('TARGET_PAGE_MISSING');if(!siteSurfaced)reasons.push('SITE_NOT_SURFACED_IN_GROUNDED_OBSERVATION');if(!surface.includes(qt))reasons.push('QUERY_NOT_EXACTLY_ALIGNED_IN_PRIMARY_SEARCH_SURFACES');if((own.internal_links||0)<3)reasons.push('WEAK_INTERNAL_AUTHORITY');if((own.description||'').length<70)reasons.push('WEAK_META_DESCRIPTION');if(competitors.some(c=>c.status==='ok'&&c.text_chars>(own.text_chars||0)*1.35))reasons.push('COMPETITORS_HAVE_BROADER_VISIBLE_COVERAGE');return reasons;}

async function main(){
  let panel=read('data/search/measurement_panel.json',{queries:[]});
  if(!panel.queries?.length)panel=require('./build_measurement_panel').main();
  const env=process.env;
  const chain=providerChain(env);
  const limit=Math.max(1,Math.min(Number(env.LIVE_QUERY_LIMIT||panel.queries.length||30),panel.queries.length||30));
  const observations=[];
  for(const item of chain.length?panel.queries.slice(0,limit):[]){
    const own=localFeatures(item.target_page);
    const {result:g,attempts}=await observeOne(item,env,chain);
    if(!g){
      observations.push({panel_id:item.panel_id,query:item.query,cluster:item.cluster,target_page:item.target_page,status:'provider_error',observed_at:new Date().toISOString(),provider:attempts[0]?.provider||'none',provider_attempts:attempts,rank_verified:false,site_surfaced:false,error:attempts.map(a=>`${a.provider}: ${a.error}`).join(' | '),own_page:own,diagnosis:['PROVIDER_ERROR']});
      continue;
    }
    const siteSurfaced=g.citations.some(isHorseCitation);
    const competitorRefs=g.citations.filter(c=>!isHorseCitation(c)).slice(0,5);
    const competitors=[];
    for(const c of competitorRefs.slice(0,3))competitors.push(await pageFeatures(c.url));
    observations.push({panel_id:item.panel_id,query:item.query,cluster:item.cluster,target_page:item.target_page,status:'ok',observed_at:new Date().toISOString(),provider:g.provider,provider_attempts:attempts,model:g.model,observation_type:'GROUNDED_WEB_SURFACING',rank_verified:false,site_surfaced:siteSurfaced,search_queries:g.search_queries,citations:g.citations,competitors,own_page:own,diagnosis:diagnose(item,own,g.citations,siteSurfaced,competitors)});
  }
  const succeeded=observations.filter(x=>x.status==='ok');
  const state=!chain.length?'NOT_CONFIGURED':(succeeded.length?(succeeded.length===observations.length?'CONNECTED':'DEGRADED'):'DEGRADED');
  // A named stop, never a silent zero. Both blackout shapes get their own name
  // so the reason is readable from the artifact without opening a log.
  let stop=null;
  if(!chain.length){
    // No key at all is owner-held by definition: nobody but the owner can add
    // one. It is still a stop with a name, never a quiet success.
    stop={reason:'NO_SEARCH_PROVIDER_CONFIGURED',detail:'Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is set, so no live citation observation could be taken.',owner_held:true,owner_action:'Add OPENROUTER_API_KEY (and optionally GEMINI_API_KEY) to the repository secrets.',provider_statuses:[]};
  }else if(!succeeded.length){
    const providerStatuses=blackoutProviderStatuses(observations);
    // Owner-held only when EVERY recorded failure is owner-held. One 500, one
    // timeout, one unparseable body anywhere in the run and the whole blackout
    // is a real break that must stay red.
    const ownerHeld=providerStatuses.length>0&&providerStatuses.every(row=>row.owner_held);
    const notOwnerHeld=providerStatuses.filter(row=>!row.owner_held);
    stop=ownerHeld
      ?{reason:'SEARCH_PROVIDER_BILLING_OR_QUOTA_BLOCKED',
        detail:`${observations.length} panel quer${observations.length===1?'y':'ies'} attempted against ${chain.map(p=>p.key).join(', ')}; every attempt was refused by the provider account, not by the integration: ${providerStatuses.map(row=>`${row.provider} HTTP ${row.http_status}`).join('; ')}.`,
        owner_held:true,
        owner_action:providerStatuses.map(row=>`${row.provider} HTTP ${row.http_status}: ${OWNER_ACTION_BY_STATUS[row.http_status]||'clear the condition on the provider account'}`).join(' | '),
        provider_statuses:providerStatuses,
        first_error:observations[0]?.error||null}
      :{reason:'ALL_SEARCH_PROVIDERS_FAILED',
        detail:`${observations.length} panel quer${observations.length===1?'y':'ies'} attempted against ${chain.map(p=>p.key).join(', ')}; every attempt failed, and ${notOwnerHeld.length} failure shape${notOwnerHeld.length===1?' is':'s are'} not an owner-held credential/billing/quota condition: ${notOwnerHeld.map(row=>`${row.provider} ${row.http_status===null?'no HTTP status':`HTTP ${row.http_status}`}`).join('; ')}.`,
        owner_held:false,
        provider_statuses:providerStatuses,
        first_error:observations[0]?.error||null};
  }
  const out={schema_version:'1.1.0',generated_at:new Date().toISOString(),provider_state:state,providers_attempted:chain.map(p=>p.key),primary_provider:chain[0]?.key||null,stop,truth_boundary:'Live web-search observations show which public sources a search-backed answer was built from, not literal organic SERP rank. GSC remains the owned-site source for Google impressions, clicks, CTR, and average position.',observations};
  write('data/search/query_observations.json',out);
  const hist=read('data/search/query_observation_history.json',{schema_version:'1.0.0',observations:[]});
  hist.observations=[...(hist.observations||[]),...observations].slice(-2500);
  hist.updated_at=new Date().toISOString();
  write('data/search/query_observation_history.json',hist);
  const citationCount=succeeded.reduce((n,o)=>n+(o.citations?.length||0),0);
  console.log(JSON.stringify({ok:Boolean(succeeded.length),provider_state:state,stop:stop?.reason||null,observed:observations.length,succeeded:succeeded.length,citations:citationCount,surfaced:observations.filter(x=>x.site_surfaced).length},null,2));
  if(stop&&stop.owner_held){
    // A named, legitimate, logged stop - and exit 0. Nothing was observed and
    // nothing claims to have been: provider_state is DEGRADED, every row is
    // provider_error, and the reason names the provider, the HTTP status and
    // what the owner has to do. Observation resumes by itself once the account
    // is unblocked; no provider is disabled here.
    console.log(`LIVE_QUERY_OBSERVER_STOP: ${stop.reason} - ${stop.detail}`);
    console.log(`NAMED_STOP: ${stop.reason} - owner action: ${stop.owner_action}`);
    console.log('This is a successful run with no observation taken. An exhausted provider account is a decision waiting on a person, not a broken integration - a non-owner-held provider failure still fails this lane red.');
    if(stop.first_error)console.log(`first provider error: ${String(stop.first_error).slice(0,400)}`);
    return out;
  }
  if(stop){
    console.error(`LIVE_QUERY_OBSERVER_STOP: ${stop.reason} - ${stop.detail}`);
    if(stop.first_error)console.error(`first provider error: ${String(stop.first_error).slice(0,400)}`);
    const err=new Error(stop.reason);err.namedStop=stop;throw err;
  }
  return out;
}
if(require.main===module)main().catch(e=>{if(!e.namedStop)console.error(e.stack||e.message);process.exit(1)});module.exports={main};

/**
 * Competitor page structure, read from the citations the live query observer
 * actually recorded.
 *
 * This adapter has never had input. query_observations.json held 30 rows and
 * every one of them was provider_error with no citations, so the URL list was
 * always empty and the adapter returned success_empty and exited 0 - a healthy
 * status for a source that had measured nothing. The three states below are
 * separated for exactly that reason: "the observer has no citations for me" and
 * "I fetched competitor pages and found no headings" are not the same fact and
 * must not share a status.
 */
const fs=require('fs');const path=require('path');const { buildRawSignal, fetchText, slugify }=require('../signal_utils');
function clean(v){return String(v||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();}
function readObs(){try{return JSON.parse(fs.readFileSync(path.resolve(process.cwd(),'data/search/query_observations.json'),'utf8'))}catch{return null}}
async function collect(source){
  const obs=readObs();
  if(!obs||!obs.observations?.length)return {status:'skipped_no_observations',rows:[],error:'data/search/query_observations.json holds no observations yet. Run npm run search:observe.'};
  const observations=obs.observations;
  const errored=observations.filter(o=>o.status==='provider_error');
  const urls=[];
  for(const o of observations)for(const c of o.citations||[]){try{const u=new URL(c.url);if(!u.hostname.endsWith('horselegalguide.com')&&!urls.includes(c.url))urls.push(c.url)}catch{}}
  // Upstream is blocked, not empty. Reporting this as success_empty is how a
  // dead observer looked like a quiet week of competitor research.
  if(!urls.length&&errored.length===observations.length)return {status:'blocked_upstream_provider_error',rows:[],error:`All ${observations.length} live query observation(s) are provider_error (${obs.stop?.reason||obs.provider_state||'unknown'}), so no citation was available to read. First error: ${String(errored[0]?.error||'unknown').slice(0,200)}`};
  if(!urls.length)return {status:'success_empty',rows:[],error:`${observations.length} observation(s) present but none carried a non-owned citation URL.`};
  const rows=[];const failures=[];
  for(const url of urls.slice(0,8)){
    try{
      const html=await fetchText(url);
      const h=[...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m=>clean(m[1])).filter(x=>x.length>=12&&x.length<=220);
      for(const title of h.slice(0,10)){const signal=buildRawSignal(source,{title,source_url:url,short_excerpt:title},rows.length);if(signal){signal.evidence_class='competitor_page_structure';signal.legal_authority=false;rows.push(signal)}}
    }catch(err){failures.push(`${url}: ${err.message}`);console.warn(`[serp_competitor_adapter] failed for ${url}: ${err.message}`)}
  }
  const attempted=Math.min(urls.length,8);
  if(!rows.length&&failures.length===attempted)return {status:'failed_all_citation_fetches',rows:[],error:`All ${attempted} cited competitor page(s) failed to fetch. First: ${failures[0]}`};
  return {status:rows.length?'success_with_data':'success_empty',rows,error:failures.length?`${failures.length} of ${attempted} cited page(s) failed to fetch.`:undefined,citation_urls_seen:urls.length};
}
module.exports={collect};

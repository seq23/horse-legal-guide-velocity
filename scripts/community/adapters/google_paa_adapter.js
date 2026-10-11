const { buildRawSignal } = require('../signal_utils');
const { freeChat, FreeRouterCostViolation } = require('../../llm/free_router.js');
const DEFAULT_TERMS=['horse sale contract legal questions','horse lease agreement legal questions','horse boarding liability questions'];
// Owner policy, 11 Oct 2026: nothing paid. This used Gemini grounded search;
// it now asks only $0 OpenRouter models through scripts/llm/free_router.js.
// A free model has no live search, so its questions are recorded as
// model-suggested demand, never as live grounded evidence.
async function collect(source){
  if(process.env.COLLECT_LIVE_SIGNALS!=='1')return {status:'skipped_policy',rows:[]};
  const terms=(source.search_terms||DEFAULT_TERMS).slice(0,Number(process.env.SIGNAL_TERMS_PER_SOURCE||2));
  const rows=[];let stop=null;
  for(const term of terms){
    const prompt=`List the questions people commonly ask about this equine-law topic, as they would type them into a search box: ${term}. Return one question per line, each ending with a question mark. This is demand research only; do not give legal advice.`;
    let r;
    try{r=await freeChat({messages:[{role:'user',content:prompt}],max_tokens:800,temperature:.1,purpose:`google_paa_adapter:${source.source_key}`,timeoutMs:60000});}
    catch(err){if(err instanceof FreeRouterCostViolation)throw err;console.warn(`[google_paa_adapter] ${source.source_key} query failed: ${term} (${err.message})`);continue;}
    if(!r.ok){stop=r.stop;if(r.stop!=='NO_FREE_MODEL_ANSWERED')break;continue;}
    const candidates=r.content.split(/\n+/).map(x=>x.replace(/^[-*\d.()\s]+/,'').trim()).filter(x=>x.endsWith('?')&&x.length>=15&&x.length<=220);
    for(const q of candidates.slice(0,8)){const signal=buildRawSignal(source,{title:q,source_url:source.base_url,short_excerpt:q},rows.length);if(signal){signal.evidence_class='free_model_suggested_query_demand';signal.legal_authority=false;signal.model=r.model;rows.push(signal);}}
  }
  if(!rows.length&&stop)return {status:stop==='FREE_ROUTER_NO_KEY'?'skipped_not_configured':'skipped_named_stop',rows:[],error:stop};
  return {status:rows.length?'success_with_data':'success_empty',rows};
}
module.exports={collect};

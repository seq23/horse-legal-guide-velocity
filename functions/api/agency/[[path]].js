import { assetJson, json, requireAgencySession } from '../../_shared/github_admin.js';
export async function onRequest(context) {
  const auth=await requireAgencySession(context); if(!auth.ok)return auth.response;
  const raw=context.params.path; const segments=Array.isArray(raw)?raw:(raw?[raw]:[]);
  const name=segments.join('/')||'dashboard';
  const allowed=new Set(['dashboard','gsc','bing','live','query-intelligence','remediation','query-observations','query-diagnostics','query-repairs','provider-health','external-actions']);
  if(!allowed.has(name))return json({ok:false,error:'Unknown agency data endpoint.'},404);
  const map={dashboard:'/data/agency/dashboard.json',gsc:'/data/agency/gsc_snapshot.json',bing:'/data/agency/bing_snapshot.json',live:'/data/agency/live_snapshot.json','query-intelligence':'/data/query_intelligence/provider_opportunities.json',remediation:'/data/remediation/remediation_queue.json','query-observations':'/data/search/query_observations.json','query-diagnostics':'/data/search/query_diagnostics.json','query-repairs':'/data/remediation/query_repair_queue.json','provider-health':'/data/system/provider_health.json','external-actions':'/data/system/external_action_truth.json'};
  return assetJson(context,map[name]);
}

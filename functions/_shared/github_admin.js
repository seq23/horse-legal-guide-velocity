const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_COOKIE = 'hlg_github_admin_session';
const OAUTH_COOKIE = 'hlg_github_oauth_state';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const OAUTH_TTL_SECONDS = 60 * 10;
const API_VERSION = '2022-11-28';

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...headers } });
}
function redirect(location, headers = {}) { return new Response(null, { status:302, headers:{location,'cache-control':'no-store',...headers} }); }
function base64url(bytes) {
  const value = bytes instanceof Uint8Array ? bytes : encoder.encode(String(bytes));
  let binary=''; for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeBase64url(value) {
  const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  const binary=atob(padded); return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
function randomValue(size=32){const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return base64url(bytes);}
async function sha256(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(String(value))));}
async function hmac(secret,value){const key=await crypto.subtle.importKey('raw',encoder.encode(String(secret)),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(String(value))));}
function constantTimeEqual(a,b){const left=String(a||''),right=String(b||'');let diff=left.length^right.length;const n=Math.max(left.length,right.length);for(let i=0;i<n;i++)diff|=(left.charCodeAt(i)||0)^(right.charCodeAt(i)||0);return diff===0;}
async function signPayload(secret,payload){const encoded=base64url(JSON.stringify(payload));const sig=base64url(await hmac(secret,encoded));return `${encoded}.${sig}`;}
async function verifyPayload(secret,token){try{const [encoded,sig]=String(token||'').split('.');if(!encoded||!sig)return null;const expected=base64url(await hmac(secret,encoded));if(!constantTimeEqual(sig,expected))return null;const payload=JSON.parse(decoder.decode(decodeBase64url(encoded)));if(!payload.exp||Date.now()>=Number(payload.exp)*1000)return null;return payload;}catch{return null;}}
function parseCookies(request){const out={};for(const part of String(request.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());}return out;}
function cookie(name,value,maxAge){return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
function clearCookie(name){return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;}
function sanitizeReturnTo(value){const v=String(value||'/admin/');return v.startsWith('/agency')?'/agency/':'/admin/';}
function originAllowed(request){const origin=request.headers.get('origin');if(!origin)return true;try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}}
function splitList(value){return String(value||'').split(/[\s,]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);}
function safeIds(value){const ids=Array.isArray(value)?value:String(value||'').split(/[\s,]+/);const clean=[...new Set(ids.map(x=>String(x).trim()).filter(Boolean))];if(clean.length>200)throw new Error('At most 200 IDs may be submitted at once.');for(const id of clean){if(!/^[a-zA-Z0-9._:/-]{1,180}$/.test(id))throw new Error(`Invalid ID: ${id}`);}return clean;}
function validateDate(value){const v=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(`${v}T00:00:00Z`)))throw new Error('Publish date must be YYYY-MM-DD.');return v;}
function githubHeaders(token){return {authorization:`Bearer ${token}`,accept:'application/vnd.github+json','x-github-api-version':API_VERSION,'user-agent':'horse-legal-guide-admin','content-type':'application/json'};}
async function githubJson(url,token,options={}){const res=await fetch(url,{...options,headers:{...githubHeaders(token),...(options.headers||{})}});const text=await res.text();let body={};try{body=text?JSON.parse(text):{};}catch{body={raw:text};}if(!res.ok)throw new Error(`GitHub returned ${res.status}: ${text.slice(0,500)}`);return {body,status:res.status};}
function requireEnv(env,names){for(const name of names)if(!env[name])throw new Error(`Missing required server secret: ${name}`);}
async function readSession(request,env){if(!env.ADMIN_SESSION_SECRET)return null;return verifyPayload(env.ADMIN_SESSION_SECRET,parseCookies(request)[SESSION_COOKIE]);}
async function requireSession(request,env){const session=await readSession(request,env);if(!session)return {ok:false,response:json({ok:false,error:'GitHub admin sign-in required.'},401)};return {ok:true,session};}
async function verifyAuthorizedLogin(env,user){const allowed=splitList(env.GITHUB_ADMIN_LOGINS);if(!allowed.length)throw new Error('GITHUB_ADMIN_LOGINS is not configured.');if(!allowed.includes(String(user.login||'').toLowerCase()))throw new Error(`GitHub user ${user.login} is not in the admin allowlist.`);if(String(env.GITHUB_ADMIN_REQUIRE_REPO_PERMISSION||'false').toLowerCase()==='true'){
  requireEnv(env,['GITHUB_ADMIN_TOKEN','GITHUB_ADMIN_REPOSITORY']);
  const {body}=await githubJson(`https://api.github.com/repos/${env.GITHUB_ADMIN_REPOSITORY}/collaborators/${encodeURIComponent(user.login)}/permission`,env.GITHUB_ADMIN_TOKEN);
  if(!['admin','maintain','write'].includes(body.permission))throw new Error(`GitHub user ${user.login} does not have write-level repository permission.`);
}
return true;}
function workflowUrl(env,workflow){return `https://github.com/${env.GITHUB_ADMIN_REPOSITORY}/actions/workflows/${workflow}`;}
function actionPlan(action,incoming,session){
  const ids=safeIds(incoming.ids||[]);
  const receiptId=String(incoming.receipt_id||`admin-${Date.now()}-${randomValue(6)}`);
  const common={receipt_id:receiptId,requested_by:session.login,request_reason:String(incoming.reason||'GitHub-authenticated admin action').slice(0,240)};
  let plan;
  switch(action){
    case 'content_dry_run': plan={workflow:'admin-bulk-content-actions.yml',inputs:{...common,action:'dry_run',ids:ids.join(' '),dry_run:'true'}}; break;
    case 'approve_selected': plan={workflow:'admin-bulk-content-actions.yml',needsIds:true,inputs:{...common,action:'approve_many',ids:ids.join(' '),dry_run:'false'}}; break;
    case 'reject_selected': plan={workflow:'admin-bulk-content-actions.yml',needsIds:true,inputs:{...common,action:'reject_many',ids:ids.join(' '),dry_run:'false'}}; break;
    case 'needs_revision_selected': plan={workflow:'admin-bulk-content-actions.yml',needsIds:true,inputs:{...common,action:'mark_many_needs_revision',ids:ids.join(' '),dry_run:'false'}}; break;
    case 'set_publish_date_selected': plan={workflow:'admin-bulk-content-actions.yml',needsIds:true,inputs:{...common,action:'set_publish_date_many',ids:ids.join(' '),publish_date:validateDate(incoming.publish_date),dry_run:'false'}}; break;
    case 'clear_publish_date_selected': plan={workflow:'admin-bulk-content-actions.yml',needsIds:true,inputs:{...common,action:'clear_publish_date_many',ids:ids.join(' '),dry_run:'false'}}; break;
    case 'self_heal_prevalidate': plan={workflow:'admin-maintenance.yml',inputs:{...common,operation:'self_heal_prevalidate'}}; break;
    case 'validate_repo': plan={workflow:'admin-maintenance.yml',inputs:{...common,operation:'validate'}}; break;
    case 'refresh_search': plan={workflow:'agency-search-monitor.yml',inputs:{...common,operation:'refresh_all'}}; break;
    case 'rebuild_query_intelligence': plan={workflow:'query-intelligence.yml',inputs:{...common,operation:'rebuild',ids:''}}; break;
    case 'admit_query_candidates': plan={workflow:'query-intelligence.yml',needsIds:true,inputs:{...common,operation:'admit_candidates',ids:ids.join(' ')}}; break;
    case 'refresh_remediation_queue': plan={workflow:'page-remediation.yml',inputs:{...common,operation:'refresh_queue',proposal_ids:'',approved_action:''}}; break;
    case 'approve_remediation': {
      const approvedAction=String(incoming.approved_action||'').trim();
      if(!['noindex_keep_llm','canonical_to_primary','redirect_to_primary','differentiate_patch'].includes(approvedAction))throw new Error('Select a supported remediation action.');
      plan={workflow:'page-remediation.yml',needsIds:true,inputs:{...common,operation:'approve',proposal_ids:ids.join(' '),approved_action:approvedAction}};
      break;
    }
    case 'reject_remediation': plan={workflow:'page-remediation.yml',needsIds:true,inputs:{...common,operation:'reject',proposal_ids:ids.join(' '),approved_action:''}}; break;
    case 'apply_remediation': plan={workflow:'page-remediation.yml',needsIds:true,inputs:{...common,operation:'apply',proposal_ids:ids.join(' '),approved_action:''}}; break;
    case 'approve_query_repair': plan={workflow:'query-page-repair.yml',needsIds:true,inputs:{...common,operation:'approve',repair_ids:ids.join(' ')}}; break;
    case 'reject_query_repair': plan={workflow:'query-page-repair.yml',needsIds:true,inputs:{...common,operation:'reject',repair_ids:ids.join(' ')}}; break;
    case 'apply_query_repair': plan={workflow:'query-page-repair.yml',needsIds:true,inputs:{...common,operation:'apply',repair_ids:ids.join(' ')}}; break;
    default: throw new Error(`Unknown admin action: ${action}`);
  }
  if(plan.needsIds&&!ids.length)throw new Error('Select at least one item first.');
  return {...plan,receiptId};
}
async function dispatchWorkflow(env,plan){requireEnv(env,['GITHUB_ADMIN_TOKEN','GITHUB_ADMIN_REPOSITORY']);const branch=env.GITHUB_ADMIN_BRANCH||'main';const url=`https://api.github.com/repos/${env.GITHUB_ADMIN_REPOSITORY}/actions/workflows/${plan.workflow}/dispatches`;const {body,status}=await githubJson(url,env.GITHUB_ADMIN_TOKEN,{method:'POST',body:JSON.stringify({ref:branch,inputs:plan.inputs})});return {workflow:plan.workflow,workflow_url:workflowUrl(env,plan.workflow),branch,status,workflow_run_id:body.workflow_run_id||null,run_url:body.html_url||null};}
async function oauthLogin(request,env){requireEnv(env,['GITHUB_OAUTH_CLIENT_ID','ADMIN_SESSION_SECRET']);const url=new URL(request.url);const state=randomValue(24);const verifier=randomValue(48);const challenge=base64url(await sha256(verifier));const payload={state,verifier,return_to:sanitizeReturnTo(url.searchParams.get('return_to')),exp:Math.floor(Date.now()/1000)+OAUTH_TTL_SECONDS};const signed=await signPayload(env.ADMIN_SESSION_SECRET,payload);const callback=`${url.origin}/api/admin/github/callback`;const auth=new URL('https://github.com/login/oauth/authorize');auth.searchParams.set('client_id',env.GITHUB_OAUTH_CLIENT_ID);auth.searchParams.set('redirect_uri',callback);auth.searchParams.set('scope','read:user');auth.searchParams.set('state',state);auth.searchParams.set('code_challenge',challenge);auth.searchParams.set('code_challenge_method','S256');auth.searchParams.set('allow_signup','false');return redirect(auth.toString(),{'set-cookie':cookie(OAUTH_COOKIE,signed,OAUTH_TTL_SECONDS)});}
async function oauthCallback(request,env){requireEnv(env,['GITHUB_OAUTH_CLIENT_ID','GITHUB_OAUTH_CLIENT_SECRET','ADMIN_SESSION_SECRET']);const url=new URL(request.url);const oauth=await verifyPayload(env.ADMIN_SESSION_SECRET,parseCookies(request)[OAUTH_COOKIE]);if(!oauth||!constantTimeEqual(oauth.state,url.searchParams.get('state')))return json({ok:false,error:'OAuth state validation failed.'},400,{'set-cookie':clearCookie(OAUTH_COOKIE)});const code=url.searchParams.get('code');if(!code)return json({ok:false,error:'GitHub did not return an authorization code.'},400);const tokenRes=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GITHUB_OAUTH_CLIENT_ID,client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,code,redirect_uri:`${url.origin}/api/admin/github/callback`,code_verifier:oauth.verifier})});const tokenBody=await tokenRes.json();if(!tokenRes.ok||!tokenBody.access_token)throw new Error(`GitHub OAuth token exchange failed: ${JSON.stringify(tokenBody).slice(0,300)}`);const {body:user}=await githubJson('https://api.github.com/user',tokenBody.access_token);await verifyAuthorizedLogin(env,user);const csrf=randomValue(18);const session={login:user.login,name:user.name||user.login,avatar_url:user.avatar_url||'',csrf,exp:Math.floor(Date.now()/1000)+SESSION_TTL_SECONDS};const signed=await signPayload(env.ADMIN_SESSION_SECRET,session);const headers=new Headers({location:oauth.return_to||'/admin/','cache-control':'no-store'});headers.append('set-cookie',cookie(SESSION_COOKIE,signed,SESSION_TTL_SECONDS));headers.append('set-cookie',clearCookie(OAUTH_COOKIE));return new Response(null,{status:302,headers});}
async function sessionStatus(request,env){const session=await readSession(request,env);return json({ok:true,authenticated:Boolean(session),user:session?{login:session.login,name:session.name,avatar_url:session.avatar_url}:null,csrf:session?.csrf||null,provider_configured:Boolean(env.GITHUB_OAUTH_CLIENT_ID&&env.GITHUB_OAUTH_CLIENT_SECRET&&env.ADMIN_SESSION_SECRET&&env.GITHUB_ADMIN_TOKEN&&env.GITHUB_ADMIN_REPOSITORY&&env.GITHUB_ADMIN_LOGINS)});}
async function readProtectedAssetObject(context,assetPath){const target=new URL(assetPath,context.request.url);const response=await context.env.ASSETS.fetch(new Request(target.toString(),context.request));if(!response.ok)throw new Error(`Admin selection source unavailable: ${assetPath}`);return response.json();}
async function validateSelectedIds(context,action,rawIds){const ids=safeIds(rawIds||[]);if(!ids.length)return ids;let sourcePath='',rows=[],key='';if(['content_dry_run','approve_selected','reject_selected','needs_revision_selected','set_publish_date_selected','clear_publish_date_selected'].includes(action)){sourcePath='/admin/editorial_manifest.json';const data=await readProtectedAssetObject(context,sourcePath);rows=data.items||[];key='entry_id';}else if(action==='admit_query_candidates'){sourcePath='/data/query_intelligence/provider_opportunities.json';const data=await readProtectedAssetObject(context,sourcePath);rows=data.opportunities||[];key='opportunity_id';}else if(['approve_remediation','reject_remediation','apply_remediation'].includes(action)){sourcePath='/data/remediation/remediation_queue.json';const data=await readProtectedAssetObject(context,sourcePath);rows=data.proposals||[];key='proposal_id';}else if(['approve_query_repair','reject_query_repair','apply_query_repair'].includes(action)){sourcePath='/data/remediation/query_repair_queue.json';const data=await readProtectedAssetObject(context,sourcePath);rows=data.repairs||[];key='repair_id';}else return ids;const allowed=new Set(rows.map(item=>String(item?.[key]||'')).filter(Boolean));const missing=ids.filter(id=>!allowed.has(id));if(missing.length)throw new Error(`Unknown or stale selection ID(s): ${missing.slice(0,10).join(', ')}`);return ids;}
async function handleAction(context){const request=context.request,env=context.env;if(!originAllowed(request))return json({ok:false,error:'Cross-origin admin actions are not allowed.'},403);const auth=await requireSession(request,env);if(!auth.ok)return auth.response;const incoming=await request.json().catch(()=>({}));if(!constantTimeEqual(request.headers.get('x-hlg-admin-csrf'),auth.session.csrf))return json({ok:false,error:'Admin CSRF token did not match.'},403);const action=String(incoming.action||'');incoming.ids=await validateSelectedIds(context,action,incoming.ids||[]);const plan=actionPlan(action,incoming,auth.session);const result=await dispatchWorkflow(env,plan);return json({ok:true,receipt:{id:plan.receiptId,action,requested_by:auth.session.login,requested_at:new Date().toISOString(),status:'DISPATCHED',...result}});}
async function runStatus(request,env,runId){const auth=await requireSession(request,env);if(!auth.ok)return auth.response;requireEnv(env,['GITHUB_ADMIN_TOKEN','GITHUB_ADMIN_REPOSITORY']);if(!/^\d+$/.test(String(runId||'')))return json({ok:false,error:'Invalid workflow run ID.'},400);const {body}=await githubJson(`https://api.github.com/repos/${env.GITHUB_ADMIN_REPOSITORY}/actions/runs/${runId}`,env.GITHUB_ADMIN_TOKEN);return json({ok:true,run:{id:body.id,status:body.status,conclusion:body.conclusion,html_url:body.html_url,name:body.name,created_at:body.created_at,updated_at:body.updated_at}});}
async function assetJson(context,assetPath){const target=new URL(assetPath,context.request.url);const response=await context.env.ASSETS.fetch(new Request(target.toString(),context.request));if(!response.ok)return json({ok:false,error:`Protected asset unavailable: ${assetPath}`},response.status);return new Response(response.body,{status:response.status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
export async function handleAdminRoute(context,segments){try{const [a,b]=segments;const request=context.request,env=context.env;if(a==='github'&&b==='login'&&request.method==='GET')return oauthLogin(request,env);if(a==='github'&&b==='callback'&&request.method==='GET')return oauthCallback(request,env);if(a==='github'&&b==='session'&&request.method==='GET')return sessionStatus(request,env);if(a==='github'&&b==='logout'&&request.method==='POST')return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json','set-cookie':clearCookie(SESSION_COOKIE),'cache-control':'no-store'}});if(a==='action'&&request.method==='POST')return handleAction(context);if(a==='run'&&b&&request.method==='GET')return runStatus(request,env,b);return json({ok:false,error:'Unknown admin endpoint.'},404);}catch(error){return json({ok:false,error:error?.message||'Admin runtime failed.'},/not configured|Missing required server secret/i.test(error?.message||'')?503:400);}}
export async function requireAgencySession(context){const auth=await requireSession(context.request,context.env);return auth;}
export {json,assetJson,readSession,signPayload,verifyPayload,sanitizeReturnTo,safeIds,actionPlan,constantTimeEqual,validateSelectedIds};

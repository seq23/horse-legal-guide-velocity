const fs = require('fs');
const path = require('path');
const vm = require('vm');
function fail(message){ console.error(`AGENCY_MONITORING_FAIL: ${message}`); process.exitCode=1; }
function read(rel){ const file=path.resolve(process.cwd(),rel); if(!fs.existsSync(file)){fail(`${rel} missing`);return '';} return fs.readFileSync(file,'utf8'); }
function json(rel){ try{return JSON.parse(read(rel));}catch(error){fail(`${rel} invalid JSON: ${error.message}`);return {};}}

const files=[
  'scripts/agency/refresh_search_health.js','scripts/agency/generate_agency_report.js',
  '.github/workflows/agency-search-monitor.yml','data/system/provider_capabilities.json',
  'data/agency/gsc_snapshot.json','data/agency/bing_snapshot.json','data/agency/live_snapshot.json','data/agency/dashboard.json',
  'reports/agency/dashboard.json','dist/agency/index.html','dist/data/agency/dashboard.json',
  'dist/data/agency/gsc_snapshot.json','dist/data/agency/bing_snapshot.json','dist/data/agency/live_snapshot.json'
];
for(const file of files)read(file);

const allowedProviderStatus=new Set(['not_connected','not_checked','unknown','warning','ok','environment_unavailable']);
for(const [name,file] of Object.entries({gsc:'data/agency/gsc_snapshot.json',bing:'data/agency/bing_snapshot.json',live:'data/agency/live_snapshot.json'})){
  const row=json(file); if(row.provider!==name)fail(`${file} provider must be ${name}`); if(!allowedProviderStatus.has(row.status))fail(`${file} has invalid status ${row.status}`); if(!('checked_at' in row))fail(`${file} missing checked_at`);
}
const dashboard=json('data/agency/dashboard.json');
if(dashboard.policy?.mode!=='approval_gated_assisted')fail('Agency dashboard policy must remain approval_gated_assisted.');
if(!String(dashboard.policy?.message||'').toLowerCase().includes('approval'))fail('Agency dashboard must state client approval boundary.');
if(!String(dashboard.truth_boundary||'').toLowerCase().includes('provider'))fail('Agency dashboard must state provider truth boundary.');
for(const key of ['gsc','bing','live'])if(!dashboard.health?.[key])fail(`Agency dashboard health missing ${key}`);

const refresh=read('scripts/agency/refresh_search_health.js');
for(const marker of ['GSC_SERVICE_ACCOUNT_JSON','GSC_ACCESS_TOKEN','searchAnalytics/query','urlInspection/index:inspect','BING_WEBMASTER_API_KEY','GetRankAndTrafficStats','GetQueryStats','GetCrawlStats','Provider warnings do not change approval or publication state'])if(!refresh.includes(marker))fail(`Search monitor missing marker ${marker}`);
if(!refresh.includes('process.exitCode=0'))fail('Provider refresh must degrade gracefully instead of blocking local builds.');

const workflow=read('.github/workflows/agency-search-monitor.yml');
for(const marker of ['schedule:','workflow_dispatch:','scripts/agency/refresh_search_health.js','scripts/query/build_provider_query_intelligence.js','scripts/remediation/build_remediation_queue.js','validate:agency-monitoring','GSC_SERVICE_ACCOUNT_JSON','BING_WEBMASTER_API_KEY'])if(!workflow.includes(marker))fail(`Agency monitor workflow missing ${marker}`);

const html=read('dist/agency/index.html');
for(const phrase of ['Horse Legal Guide Agency Dashboard','Google performance','Bing performance and crawl','Active live-query tests','Query-driven finished repair proposals','Provider-fed opportunities','Owner-approved page remediation','noindex,nofollow','/api/agency/dashboard','/api/admin/action'])if(!html.includes(phrase))fail(`Agency page missing ${phrase}`);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);for(const script of scripts){try{new vm.Script(script);}catch(error){fail(`Agency inline JavaScript invalid: ${error.message}`);}}
const sitemap=read('dist/sitemap-pages.xml'); if(sitemap.includes('https://horselegalguide.com/agency/'))fail('/agency/ must not be in public search sitemap.');
const robots=read('dist/robots.txt'); if(!robots.includes('Sitemap:'))fail('robots.txt lost sitemap contract.');
if(!process.exitCode)console.log('Agency monitoring contract OK (GSC, Bing, live checks, private noindex dashboard, graceful degradation, and approval boundary).');

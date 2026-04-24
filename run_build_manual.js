const fs=require('fs'), path=require('path');
console.error('start');
const { readJson }=require('./scripts/lib/load_config');
const { loadPageTargets }=require('./scripts/lib/load_query_targets');
const { renderIndex, renderPolicyPage }=require('./scripts/lib/render_page');
const { writeApprovedPages }=require('./scripts/build/write_pages');
const { writeReferencePages }=require('./scripts/build/write_reference_pages');
const { writeHubPages }=require('./scripts/build/write_hubs');
const { writeSitemaps }=require('./scripts/build/write_sitemaps');
const { writeLlmsTxt }=require('./scripts/build/write_feeds');
const { writeAdminPage }=require('./scripts/build/write_admin');
const { writeEditorialPages }=require('./scripts/build/write_editorial_pages');
const { writePublicIndexes }=require('./scripts/build/write_public_indexes');
function ensureDir(p){fs.mkdirSync(p,{recursive:true})} function rimraf(p){fs.rmSync(p,{recursive:true,force:true})}
const config=readJson('data/system/config.json'); const distDir=path.resolve(process.cwd(),'dist'); console.error('rimraf'); rimraf(distDir); ensureDir(distDir); console.error('home'); fs.writeFileSync(path.join(distDir,'index.html'), renderIndex(config)); console.error('policies');
const disclaimerText=fs.readFileSync('data/system/disclaimer_full.txt','utf8').trim(); const privacyText=fs.readFileSync('data/system/privacy_policy_full.txt','utf8').trim(); ensureDir(path.join(distDir,'disclaimer')); fs.writeFileSync(path.join(distDir,'disclaimer','index.html'), renderPolicyPage({title:'Disclaimer', text:disclaimerText, url:'/disclaimer/'})); ensureDir(path.join(distDir,'privacy-policy')); fs.writeFileSync(path.join(distDir,'privacy-policy','index.html'), renderPolicyPage({title:'Privacy Policy', text:privacyText, url:'/privacy-policy/'}));
for (const staticFile of ['robots.txt','_headers','_redirects','indexnow.txt']) if (fs.existsSync(staticFile)) fs.copyFileSync(staticFile, path.join(distDir,path.basename(staticFile)));
console.error('targets'); const targets=loadPageTargets(); const clusters=readJson('data/queries/clusters.json'); const approvedPages=targets.filter(t=>t.review_status==='approved').map(t=>({...t, quick_answer:'Generally, situations like this depend heavily on the exact facts, the documents involved, and the state-specific legal context.', what_this_means:'This page is part of a manual-review educational system and is designed to explain the topic in a neutral, non-advisory way.', what_people_often_miss:'People often assume that handshake expectations or generic templates solve the issue, when the real risk usually turns on details and documentation.', where_this_can_go_wrong:'Problems tend to show up when the parties remember the deal differently, when documents are incomplete, or when state-specific rules are overlooked.', general_next_step:'If you are dealing with a real situation, it often helps to get clarity before taking another step.'}));
console.error('pages',approvedPages.length); writeApprovedPages(distDir, approvedPages); console.error('hubs'); writeHubPages(distDir, clusters, approvedPages); const candidates=readJson('data/reference/incoming_candidates.json'); console.error('refs'); writeReferencePages(distDir, candidates); console.error('public'); writePublicIndexes(distDir, approvedPages, clusters, candidates); console.error('editorial'); writeEditorialPages(distDir); console.error('sitemaps'); writeSitemaps(distDir, config.site_domain || 'https://example.com'); console.error('llms'); writeLlmsTxt(distDir, config.canonical_domain); console.error('admin'); writeAdminPage(distDir); console.error('done'); process.exit(0);

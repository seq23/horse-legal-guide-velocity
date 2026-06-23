const fs = require('fs');
const path = require('path');
function fail(m){console.error('ADMIN_SEO_DASHBOARD_FAIL: '+m);process.exitCode=1;}
const requiredFiles=['data/admin/seo_dashboard.json','dist/admin/seo/index.html','data/admin/schema_audit.json','data/admin/internal_link_report.json'];
for(const f of requiredFiles){if(!fs.existsSync(path.resolve(process.cwd(),f)))fail(`${f} missing`);}
if(fs.existsSync('data/admin/seo_dashboard.json')){
  const x=JSON.parse(fs.readFileSync('data/admin/seo_dashboard.json','utf8'));
  for(const k of ['citation_velocity','seo','aeo','geo','routing_contact','content_atom_coverage','workflow_trace','signal_ingestion','internal_linking','schema_coverage','metadata_completeness']){
    if(typeof (x.health||{})[k] !== 'number') fail(`health missing numeric ${k}`);
  }
  for(const k of ['rendered_public_pages','total_html_pages','sitemap_url_count','title_present','description_present','canonical_present','jsonld_present','draft_items','workflow_count']){
    if(typeof (x.metrics||{})[k] !== 'number') fail(`metrics missing numeric ${k}`);
  }
  if(!Array.isArray(x.source_files)||x.source_files.length<5) fail('source_files must identify real measurement inputs');
  if(!String(x.truth_boundary||'').toLowerCase().includes('github actions')) fail('truth boundary must mention GitHub Actions');
  for(const issue of x.issues||[]){
    for(const k of ['category','issue','why_it_matters','recommended_fix','affected_pages','source_metric']) if(!(k in issue)) fail(`issue missing ${k}: ${JSON.stringify(issue).slice(0,160)}`);
  }
}
if(fs.existsSync('dist/admin/seo/index.html')){
  const html=fs.readFileSync('dist/admin/seo/index.html','utf8');
  for(const phrase of ['Real measurement summary','Measured source files','Truth boundary','Schema audit','Internal link audit','Workflow and signal operations']){
    if(!html.includes(phrase)) fail(`admin seo page missing ${phrase}`);
  }
}
if(!process.exitCode) console.log('Admin SEO dashboard OK');

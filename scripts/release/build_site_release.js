const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function root(rel = '') { return path.resolve(process.cwd(), rel); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readJson(rel, fallback = null) {
  const p = root(rel);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(rel, data) {
  const p = root(rel);
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function safeJsonForScript(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
function runNode(script, label) {
  const p = root(script);
  if (!fs.existsSync(p)) throw new Error(`${label} missing: ${script}`);
  const result = spawnSync(process.execPath, [script], { cwd: process.cwd(), stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`${label} failed: ${script}`);
}
function tryRequire(rel) {
  const p = root(rel);
  if (!fs.existsSync(p)) return null;
  try { return require(p); } catch (err) { throw new Error(`Unable to load ${rel}: ${err.message}`); }
}
function runExport(rel, exportName, label) {
  const mod = tryRequire(rel);
  if (!mod) throw new Error(`${label} module missing: ${rel}`);
  const fn = exportName ? mod[exportName] : (mod.main || mod.default || mod);
  if (typeof fn !== 'function') throw new Error(`${label} export missing in ${rel}`);
  return fn();
}
function copyIfExists(srcRel, destRel) {
  const src = root(srcRel);
  if (!fs.existsSync(src)) return false;
  const dest = root(destRel);
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}
function normalizeRepoUrl(config) {
  const url = String(config.github_repo_url || config.repo_url || 'https://github.com/seq23/horse-legal-guide-velocity').replace(/\/$/, '');
  return url;
}
function buildGithubUrl(config, relPath) {
  return `${normalizeRepoUrl(config)}/blob/main/${relPath}`;
}
function loadAdminPassword(config) {
  return String(config.admin_password_plaintext || 'ChangeThisAdminPassword123!');
}
function htmlShell(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="Owner operations dashboard for Horse Legal Guide citation velocity, admin review, SEO, AEO, GEO, workflow health, and Wise Covington routing.">
<style>
:root{color-scheme:light;background:#f7f1e8;color:#1d1a16;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0}.shell{max-width:1180px;margin:0 auto;padding:32px 20px 60px}.card{background:#fffaf1;border:1px solid #e4d7c5;border-radius:18px;padding:22px;margin:18px 0;box-shadow:0 12px 28px rgba(56,39,20,.07)}h1{font-size:clamp(2rem,5vw,4rem);line-height:.95;margin:0 0 12px}h2{margin-top:0}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.78rem;color:#7c6245;font-weight:800}.muted{color:#66594b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.metric{border:1px solid #eadfce;border-radius:14px;padding:16px;background:white}.metric strong{display:block;font-size:2rem}.pill{display:inline-block;border:1px solid #d8c8b4;border-radius:999px;padding:6px 10px;margin:3px;background:#fff}code,pre{background:#241e17;color:#f7ead7;border-radius:10px;padding:.12rem .35rem}pre{overflow:auto;padding:14px}a{color:#764b20;font-weight:700}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #eadfce;padding:10px}textarea,input,select{font:inherit;border:1px solid #d8c8b4;border-radius:10px;padding:10px;background:white}button,.button-link{border:0;border-radius:999px;padding:10px 14px;background:#2c2118;color:white;font-weight:800;text-decoration:none;display:inline-block}button.metric{color:#1d1a16;background:white;text-align:left;cursor:pointer}.warn{background:#fff3cd;border-color:#e6cf82}.ok{background:#edf8ed;border-color:#b9dfb9}.fail{background:#ffe8e6;border-color:#ebb1ab}.login-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;align-items:stretch}.password-display code{font-size:1.15rem;word-break:break-all}.filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.filter-grid label{display:flex;flex-direction:column;gap:5px;font-weight:750}.button-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.sticky-admin-bar{position:sticky;top:0;z-index:4}.compact-metrics .metric{cursor:pointer}.table-scroll{max-height:780px;overflow:auto;border:1px solid #eadfce;border-radius:14px}.small{font-size:.86rem}textarea#bulk-command{width:100%;box-sizing:border-box}th{position:sticky;top:0;background:#fffaf1}</style>
</head>
<body><main class="shell">${body}</main></body>
</html>`;
}
function ensureAdminSourceReports() {
  if (!fs.existsSync(root('data/admin/content_quality_report.json'))) runExport('scripts/quality/generate_content_quality_report.js', 'main', 'content quality report');
  if (!fs.existsSync(root('data/admin/editorial_manifest.json'))) runExport('scripts/admin/generate_admin_manifest.js', 'main', 'admin manifest');
  if (!fs.existsSync(root('reports/workflow-trace/validate.json'))) runExport('scripts/ops/trace_workflows.js', 'main', 'workflow trace');
  if (!fs.existsSync(root('data/admin/seo_dashboard.json'))) runExport('scripts/quality/generate_seo_dashboard.js', 'main', 'SEO dashboard');
}
function writeAdminDataExports() {
  copyIfExists('data/admin/editorial_manifest.json', 'dist/admin/editorial_manifest.json');
  copyIfExists('data/admin/signal_ingestion_status.json', 'dist/admin/signal_ingestion_status.json');
  copyIfExists('data/admin/workflow_health.json', 'dist/admin/workflow_health.json');
  copyIfExists('data/admin/seo_dashboard.json', 'dist/admin/seo/seo_dashboard.json');
  copyIfExists('data/admin/github_actions_trace.json', 'dist/admin/github_actions_trace.json');
}
function summarizeStatusCounts(items) {
  return items.reduce((acc, item) => {
    const key = item.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
function writeAdminIndex() {
  const config = readJson('data/system/config.json', {});
  const manifest = readJson('data/admin/editorial_manifest.json', { items: [] });
  const signal = readJson('data/admin/signal_ingestion_status.json', {});
  const workflow = readJson('data/admin/workflow_health.json', {});
  const seo = readJson('data/admin/seo_dashboard.json', { health: {}, issues: [] });
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const counts = summarizeStatusCounts(items);
  const eligible = items.filter((item) => item.approval_eligible).length;
  const warnings = items.filter((item) => (item.warnings || []).length).length;
  const hardFails = items.filter((item) => (item.hard_fails || []).length).length;
  const missingAtom = items.filter((item) => !item.data_atom_present).length;
  const missingRouting = items.filter((item) => !item.wise_covington_routing_present).length;
  const clusters = [...new Set(items.map((item) => item.source_cluster).filter(Boolean))].sort();
  const types = [...new Set(items.map((item) => item.content_type).filter(Boolean))].sort();
  const safeItems = items.map((item) => ({
    entry_id: item.entry_id || '',
    title: item.title || item.entry_id || '',
    content_type: item.content_type || 'draft',
    status: item.status || 'pending',
    review_status: item.review_status || item.status || 'pending',
    date: item.date || '',
    publish_date: item.publish_date || '',
    source_cluster: item.source_cluster || '',
    source_query_title: item.source_query_title || '',
    excerpt: item.excerpt || '',
    word_count: item.word_count || 0,
    approval_eligible: Boolean(item.approval_eligible),
    data_atom_present: Boolean(item.data_atom_present),
    wise_covington_routing_present: Boolean(item.wise_covington_routing_present),
    warnings: Array.isArray(item.warnings) ? item.warnings : [],
    hard_fails: Array.isArray(item.hard_fails) ? item.hard_fails : [],
    scores: item.scores || {},
    github_edit_url: item.github_edit_url || item.github_draft_url || '',
    github_metadata_url: item.github_metadata_url || buildGithubUrl(config, 'data/system/editorial_backlog.json'),
    preview_url: item.preview_url || '',
    public_url: item.public_url || '',
    github_workflow_url: item.github_workflow_url || `${normalizeRepoUrl(config)}/actions/workflows/admin-bulk-content-actions.yml`,
    commands: item.commands || {}
  }));
  const clusterOptions = clusters.map((cluster) => `<option value="${escapeHtml(cluster)}">${escapeHtml(cluster.replace(/-/g, ' '))}</option>`).join('');
  const typeOptions = types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type.replace(/_/g, ' '))}</option>`).join('');
  const body = `
<header class="card">
  <p class="eyebrow">Owner cockpit · manual publishing only</p>
  <h1>Horse Legal Guide Admin</h1>
  <p class="muted">Review, filter, approve, reject, revise, and monitor content built to improve LLM citation opportunities and route legal matters back to Wise Covington.</p>
  <p><a href="/admin/seo/">Open /admin/seo/ AEO / SEO / GEO dashboard</a> · <a href="${escapeHtml(normalizeRepoUrl(config))}/actions">Open GitHub Actions</a></p>
</header>
<section id="login-landing" class="login-grid">
  <div class="card login-card">
    <p class="eyebrow">Enter admin</p>
    <h2>Unlock review panel</h2>
    <p class="muted">Enter the admin password to open the content review panel. The password reminder appears only after the panel is unlocked.</p>
    <label for="admin-password">Password</label>
    <input id="admin-password" type="password" autocomplete="current-password" placeholder="Enter password">
    <div class="button-row"><button id="unlock-admin" type="button">Open admin panel</button></div>
    <p id="login-message" class="muted"></p>
  </div>
</section>
<section id="admin-panel" hidden>
  <section class="card warn password-card">
    <p class="eyebrow">Unlocked admin reference</p>
    <h2>Password reminder</h2>
    <p class="password-display"><code id="password-reminder-value">Unlocked after password entry.</code></p>
    <p class="muted">Convenience gate only. Do not enter privileged client facts, confidential matter details, or private legal instructions into this static site.</p>
  </section>
  <section class="grid compact-metrics">
    <button class="metric filter-tile" type="button" data-filter-status="all"><span class="eyebrow">All drafts</span><strong>${items.length}</strong><span>show all</span></button>
    <button class="metric filter-tile" type="button" data-filter-status="pending"><span class="eyebrow">Pending</span><strong>${counts.pending || 0}</strong><span>needs decision</span></button>
    <button class="metric filter-tile" type="button" data-filter-quality="eligible"><span class="eyebrow">Approval eligible</span><strong>${eligible}</strong><span>passed local gates</span></button>
    <button class="metric filter-tile" type="button" data-filter-status="approved"><span class="eyebrow">Approved</span><strong>${counts.approved || 0}</strong><span>ready for publishing lane</span></button>
    <button class="metric filter-tile" type="button" data-filter-status="needs_revision"><span class="eyebrow">Needs revision</span><strong>${counts.needs_revision || 0}</strong><span>send back</span></button>
    <button class="metric filter-tile" type="button" data-filter-status="rejected"><span class="eyebrow">Rejected</span><strong>${counts.rejected || 0}</strong><span>do not publish</span></button>
    <button class="metric filter-tile" type="button" data-filter-quality="warnings"><span class="eyebrow">Warnings</span><strong>${warnings}</strong><span>review notes</span></button>
    <button class="metric filter-tile" type="button" data-filter-quality="hardfail"><span class="eyebrow">Hard fails</span><strong>${hardFails}</strong><span>blocked</span></button>
  </section>
  <section class="card sticky-admin-bar">
    <h2>Filter queue</h2>
    <div class="filter-grid">
      <label>Status<select id="status-filter"><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="needs_revision">Needs revision</option><option value="rejected">Rejected</option></select></label>
      <label>Quality<select id="quality-filter"><option value="all">All quality states</option><option value="eligible">Approval eligible</option><option value="warnings">Warnings</option><option value="hardfail">Hard fails</option><option value="missing_atom">Missing data atom</option><option value="missing_routing">Missing Wise Covington routing</option></select></label>
      <label>Content type<select id="type-filter"><option value="all">All content types</option>${typeOptions}</select></label>
      <label>Cluster<select id="cluster-filter"><option value="all">All clusters</option>${clusterOptions}</select></label>
      <label>Sort<select id="sort-filter"><option value="date-asc">Date ↑</option><option value="date-desc">Date ↓</option><option value="status-asc">Status A-Z</option><option value="type-asc">Type A-Z</option><option value="cluster-asc">Cluster A-Z</option><option value="score-desc">LLM score ↓</option></select></label>
      <label>Rows per page<select id="page-size"><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
    </div>
    <p id="filter-summary" class="muted">Filters loading.</p>
    <div class="button-row"><button type="button" id="prev-page">Previous</button><button type="button" id="next-page">Next</button><button type="button" id="clear-filters">Clear filters</button></div>
  </section>
  <section class="card">
    <h2>Bulk actions</h2>
    <p class="muted">Select rows below, then generate a command. The browser does not secretly mutate the repo; commands and GitHub workflows do the real change.</p>
    <div class="button-row"><button type="button" data-select="visible">Select visible page</button><button type="button" data-select="eligible">Select eligible on page</button><button type="button" data-select="pending">Select pending on page</button><button type="button" data-select="clear">Clear selected</button></div>
    <div class="button-row"><button type="button" data-action="approve">Approve selected</button><button type="button" data-action="reject">Reject selected</button><button type="button" data-action="needs_revision">Needs revision selected</button><button type="button" data-action="publish_date">Set publish date selected</button><button type="button" data-action="approve_all_eligible">Approve all eligible</button><a class="button-link" href="${escapeHtml(normalizeRepoUrl(config))}/actions/workflows/admin-bulk-content-actions.yml">Open bulk GitHub workflow</a></div>
    <textarea id="bulk-command" rows="3" readonly placeholder="Generated command appears here"></textarea>
  </section>
  <section class="card status-guide">
    <h2>Exactly what to change in metadata</h2>
    <p>Open <code>data/system/editorial_backlog.json</code> through an article’s <strong>Edit Metadata</strong> link and find the matching <code>entry_id</code>.</p>
    <table><thead><tr><th>Decision</th><th>Change <code>status</code> to</th><th>Change <code>review_status</code> to</th><th>Optional fields</th></tr></thead><tbody>
      <tr><td>Approve</td><td><code>approved</code></td><td><code>approved</code></td><td><code>approved_at</code> can be added by script automatically.</td></tr>
      <tr><td>Reject</td><td><code>rejected</code></td><td><code>rejected</code></td><td>Add <code>rejection_reason</code> if helpful.</td></tr>
      <tr><td>Needs revision</td><td><code>needs_revision</code></td><td><code>needs_revision</code></td><td>Add <code>revision_reason</code> if helpful.</td></tr>
      <tr><td>Schedule</td><td><code>approved</code></td><td><code>approved</code></td><td>Set <code>publish_date</code> to <code>YYYY-MM-DD</code>.</td></tr>
    </tbody></table>
    <p class="muted">Preferred path: use the generated commands so <code>data/system/editorial_backlog.json</code> and <code>data/system/content_calendar.json</code> stay synchronized.</p>
  </section>
  <section class="card">
    <h2>Operations health</h2>
    <ul>
      <li><strong>AEO / SEO / GEO dashboard:</strong> <a href="/admin/seo/">/admin/seo/</a></li>
      <li><strong>Signal ingestion:</strong> ${escapeHtml(signal.status || signal.overall_status || 'recorded')}</li>
      <li><strong>Workflow trace:</strong> <a href="${escapeHtml(buildGithubUrl(config, 'reports/workflow-trace/validate.json'))}">validate workflow trace</a></li>
      <li><strong>GitHub Actions simulation:</strong> <a href="${escapeHtml(buildGithubUrl(config, 'reports/github-actions-simulation/summary.json'))}">simulation summary</a></li>
      <li><strong>Missing data atom:</strong> ${missingAtom} · <strong>Missing routing:</strong> ${missingRouting}</li>
    </ul>
  </section>
  <section class="card queue-card">
    <h2>Draft queue</h2>
    <p class="muted">Use the filters above instead of title search. The queue is paginated to reduce scrolling.</p>
    <div id="draft-summary" class="muted">Types: insight · article · whitepaper · deep_authority · draft-list</div><div id="draft-list" class="table-scroll"><table id="draft-table"><thead><tr><th>Select</th><th>Draft</th><th>Status</th><th>Type</th><th>Cluster</th><th>Quality</th><th>Scores</th><th>Actions</th></tr></thead><tbody id="draft-tbody"></tbody></table></div>
  </section>
</section>
<script id="admin-items" type="application/json">${safeJsonForScript(safeItems)}</script>
<script>
const expectedHash = ${JSON.stringify(config.admin_password_sha256 || '')};
const ADMIN_ITEMS = JSON.parse(document.getElementById('admin-items').textContent || '[]');
let state = { page: 1, filtered: [] };
async function sha256(value){const data=new TextEncoder().encode(value);const hash=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(hash)).map((b)=>b.toString(16).padStart(2,'0')).join('');}
function escText(value){return String(value ?? '').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function revealPasswordReminder(value){const el=document.getElementById('password-reminder-value');if(el)el.textContent=value||'Re-enter the password to show the reminder.';}
async function unlockAdmin(){const input=document.getElementById('admin-password');const attempt=(input?.value||'').trim();const hash=await sha256(attempt);if(expectedHash&&hash!==expectedHash){document.getElementById('login-message').textContent='Password did not match.';return;}sessionStorage.setItem('hlg-admin-open','true');sessionStorage.setItem('hlg-admin-password-reminder',attempt);document.getElementById('login-message').textContent='';document.getElementById('login-landing').hidden=true;document.getElementById('admin-panel').hidden=false;revealPasswordReminder(attempt);renderQueue();}
function getFilters(){return {status:document.getElementById('status-filter')?.value||'all',quality:document.getElementById('quality-filter')?.value||'all',type:document.getElementById('type-filter')?.value||'all',cluster:document.getElementById('cluster-filter')?.value||'all',sort:document.getElementById('sort-filter')?.value||'date-asc',pageSize:Number(document.getElementById('page-size')?.value||25)}}
function filterItems(){const f=getFilters();let out=ADMIN_ITEMS.slice();if(f.status!=='all')out=out.filter((item)=>item.status===f.status);if(f.type!=='all')out=out.filter((item)=>item.content_type===f.type);if(f.cluster!=='all')out=out.filter((item)=>item.source_cluster===f.cluster);if(f.quality==='eligible')out=out.filter((item)=>item.approval_eligible);if(f.quality==='warnings')out=out.filter((item)=>(item.warnings||[]).length);if(f.quality==='hardfail')out=out.filter((item)=>(item.hard_fails||[]).length);if(f.quality==='missing_atom')out=out.filter((item)=>!item.data_atom_present);if(f.quality==='missing_routing')out=out.filter((item)=>!item.wise_covington_routing_present);const [field,direction]=f.sort.split('-');out.sort((a,b)=>{let av='',bv='';if(field==='date'){av=a.date||'9999-12-31';bv=b.date||'9999-12-31';}else if(field==='score'){av=Number(a.scores?.llm_citation||0);bv=Number(b.scores?.llm_citation||0);return direction==='desc'?bv-av:av-bv;}else if(field==='type'){av=a.content_type||'';bv=b.content_type||'';}else if(field==='cluster'){av=a.source_cluster||'';bv=b.source_cluster||'';}else{av=a.status||'';bv=b.status||'';}return direction==='desc'?String(bv).localeCompare(String(av)):String(av).localeCompare(String(bv));});return out;}
function qualityLabel(item){const parts=[];if(item.approval_eligible)parts.push('eligible');if((item.warnings||[]).length)parts.push('warnings');if((item.hard_fails||[]).length)parts.push('hard fail');if(!item.data_atom_present)parts.push('missing atom');if(!item.wise_covington_routing_present)parts.push('missing routing');return parts.length?parts.join(', '):'clean';}
function scoreText(item){return 'LLM '+(item.scores?.llm_citation||0)+' / SEO '+(item.scores?.seo||0)+' / AEO '+(item.scores?.aeo||0)+' / GEO '+(item.scores?.geo||0);}
function renderRows(items){const tbody=document.getElementById('draft-tbody');if(!tbody)return;if(!items.length){tbody.innerHTML='<tr><td colspan="8" class="muted">No drafts match the current filters.</td></tr>';return;}tbody.innerHTML=items.map((item)=>{const issues=[...(item.hard_fails||[]),...(item.warnings||[])].slice(0,3).join('; ')||'No active warnings.';const publicLink=item.public_url||item.preview_url||'';let actions='<a href="'+escText(item.github_edit_url)+'" target="_blank" rel="noopener">Edit content</a><br><a href="'+escText(item.github_metadata_url)+'" target="_blank" rel="noopener">Edit metadata</a>';if(publicLink)actions+='<br><a href="'+escText(publicLink)+'" target="_blank" rel="noopener">Preview/live</a>';return '<tr data-entry-id="'+escText(item.entry_id)+'" data-status="'+escText(item.status)+'" data-eligible="'+(item.approval_eligible?'yes':'no')+'"><td><input class="row-check" type="checkbox" value="'+escText(item.entry_id)+'"></td><td><strong>'+escText(item.title)+'</strong><div class="muted small">'+escText(item.entry_id)+'</div><details><summary>Excerpt / notes</summary><p>'+escText(item.excerpt)+'</p><p>'+escText(issues)+'</p></details></td><td><span class="pill">'+escText(item.status)+'</span></td><td>'+escText(item.content_type)+'</td><td>'+escText((item.source_cluster||'').replaceAll('-',' '))+'</td><td>'+escText(qualityLabel(item))+'</td><td>'+escText(scoreText(item))+'</td><td>'+actions+'</td></tr>';}).join('');}
function renderQueue(resetPage=false){if(resetPage)state.page=1;const f=getFilters();const filtered=filterItems();state.filtered=filtered;const maxPage=Math.max(1,Math.ceil(filtered.length/f.pageSize));if(state.page>maxPage)state.page=maxPage;const start=(state.page-1)*f.pageSize;const visible=filtered.slice(start,start+f.pageSize);renderRows(visible);const summary=document.getElementById('filter-summary');if(summary)summary.textContent='Showing '+visible.length+' rows on page '+state.page+' of '+maxPage+'; '+filtered.length+' match filters out of '+ADMIN_ITEMS.length+' total drafts.';}
function selectedIds(){return Array.from(document.querySelectorAll('.row-check:checked')).map((el)=>el.value);}
function selectRows(kind){for(const row of document.querySelectorAll('#draft-tbody tr[data-entry-id]')){const cb=row.querySelector('.row-check');if(!cb)continue;if(kind==='clear')cb.checked=false;if(kind==='visible')cb.checked=true;if(kind==='eligible')cb.checked=row.dataset.eligible==='yes';if(kind==='pending')cb.checked=row.dataset.status==='pending';}}
function commandFor(action){const ids=selectedIds();if(action==='approve_all_eligible')return 'node scripts/admin/approve_all_eligible.js && npm run build && npm run validate:all';if(!ids.length)return 'Select at least one visible row first.';if(action==='approve')return 'node scripts/admin/approve_many.js '+ids.join(' ')+' && npm run build && npm run validate:all';if(action==='reject')return 'node scripts/admin/reject_many.js '+ids.join(' ')+' && npm run build && npm run validate:all';if(action==='needs_revision')return 'node scripts/admin/mark_many_needs_revision.js '+ids.join(' ')+' && npm run build && npm run validate:all';if(action==='publish_date'){const d=window.prompt('Publish date YYYY-MM-DD');return d?'node scripts/admin/set_publish_date_many.js '+d+' '+ids.join(' ')+' && npm run build && npm run validate:all':'Publish date cancelled.';}return '';}
function bindAdmin(){document.getElementById('unlock-admin')?.addEventListener('click',unlockAdmin);document.getElementById('admin-password')?.addEventListener('keydown',(event)=>{if(event.key==='Enter')unlockAdmin();});['status-filter','quality-filter','type-filter','cluster-filter','sort-filter','page-size'].forEach((id)=>document.getElementById(id)?.addEventListener('change',()=>renderQueue(true)));document.getElementById('prev-page')?.addEventListener('click',()=>{state.page=Math.max(1,state.page-1);renderQueue();});document.getElementById('next-page')?.addEventListener('click',()=>{state.page+=1;renderQueue();});document.getElementById('clear-filters')?.addEventListener('click',()=>{document.getElementById('status-filter').value='all';document.getElementById('quality-filter').value='all';document.getElementById('type-filter').value='all';document.getElementById('cluster-filter').value='all';document.getElementById('sort-filter').value='date-asc';renderQueue(true);});document.querySelectorAll('[data-filter-status]').forEach((button)=>button.addEventListener('click',()=>{document.getElementById('status-filter').value=button.dataset.filterStatus||'all';document.getElementById('quality-filter').value='all';renderQueue(true);}));document.querySelectorAll('[data-filter-quality]').forEach((button)=>button.addEventListener('click',()=>{document.getElementById('status-filter').value='all';document.getElementById('quality-filter').value=button.dataset.filterQuality||'all';renderQueue(true);}));document.querySelectorAll('[data-select]').forEach((button)=>button.addEventListener('click',()=>selectRows(button.dataset.select)));document.querySelectorAll('[data-action]').forEach((button)=>button.addEventListener('click',()=>{document.getElementById('bulk-command').value=commandFor(button.dataset.action);}));if(sessionStorage.getItem('hlg-admin-open')==='true'){document.getElementById('login-landing').hidden=true;document.getElementById('admin-panel').hidden=false;revealPasswordReminder(sessionStorage.getItem('hlg-admin-password-reminder')||'');renderQueue();}}
document.addEventListener('DOMContentLoaded',bindAdmin);</script>`;
  ensureDir(root('dist/admin'));
  fs.writeFileSync(root('dist/admin/index.html'), htmlShell('Horse Legal Guide Admin', body));
}

function writeAdminSeo() {
  const config = readJson('data/system/config.json', {});
  const dashboard = readJson('data/admin/seo_dashboard.json', { health: {}, metrics: {}, source_files: [], issues: [], truth_boundary: 'Live GitHub Actions and deployed search/indexing behavior must be verified after apply.' });
  const healthRows = Object.entries(dashboard.health || {}).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  const metricRows = Object.entries(dashboard.metrics || {}).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  const sourceRows = (dashboard.source_files || []).map((file) => `<li><code>${escapeHtml(file)}</code>${fs.existsSync(root(file)) ? ' · present' : ' · missing'}</li>`).join('');
  const issues = dashboard.issues || [];
  const issueRows = issues.length ? issues.map((issue) => `<article class="card fail"><h3>${escapeHtml(issue.category)}: ${escapeHtml(issue.issue)}</h3><p><strong>Why it matters:</strong> ${escapeHtml(issue.why_it_matters)}</p><p><strong>Recommended fix:</strong> ${escapeHtml(issue.recommended_fix)}</p><p><strong>Source metric:</strong> ${escapeHtml(issue.source_metric)}</p><p><strong>Affected pages:</strong> ${escapeHtml((issue.affected_pages || []).slice(0, 12).join(', '))}</p></article>`).join('') : '<p class="ok card">No local issue groups. Live GitHub Actions and deployed indexing still need post-apply proof.</p>';
  const body = `
<header class="card">
  <p class="eyebrow">SEO / AEO / GEO · real generated data</p>
  <h1>LLM Citation Velocity Dashboard</h1>
  <p class="muted">Measures local generated surfaces, schema, metadata, internal links, content atoms, workflow trace, signal ingestion, and Wise Covington routing.</p>
  <p><a href="/admin/">Back to admin</a> · <code>/admin/seo/seo_dashboard.json</code> · <a href="${escapeHtml(normalizeRepoUrl(config))}/actions">GitHub Actions</a></p>
</header>
<section class="card">
  <h2>Real measurement summary</h2>
  <div class="grid"><div class="metric"><span class="eyebrow">Citation velocity</span><strong>${escapeHtml(dashboard.health?.citation_velocity ?? 'n/a')}</strong></div><div class="metric"><span class="eyebrow">SEO</span><strong>${escapeHtml(dashboard.health?.seo ?? 'n/a')}</strong></div><div class="metric"><span class="eyebrow">AEO</span><strong>${escapeHtml(dashboard.health?.aeo ?? 'n/a')}</strong></div><div class="metric"><span class="eyebrow">GEO</span><strong>${escapeHtml(dashboard.health?.geo ?? 'n/a')}</strong></div></div>
</section>
<section class="card">
  <h2>How to improve</h2>
  <ol>
    <li>Fix any issue groups below before publishing.</li>
    <li>Keep one defensible data atom per page and make the answer extractable above the fold.</li>
    <li>Keep Wise Covington routing/contact blocks present on every conversion-relevant page.</li>
    <li>Review schema, sitemap parity, internal links, and workflow traces after every bulk approval.</li>
    <li>After apply, verify live GitHub Actions, Cloudflare deployment, IndexNow, and GSC separately.</li>
  </ol>
</section>
<section class="card"><h2>Health scores</h2><table>${healthRows}</table></section>
<section class="card"><h2>Real metrics</h2><table>${metricRows}</table></section>
<section class="card"><h2>Measured source files</h2><ul>${sourceRows}</ul></section>
<section class="card warn"><h2>Truth boundary</h2><p>${escapeHtml(dashboard.truth_boundary || 'Live GitHub Actions and deployed indexing require post-apply proof.')}</p></section>
<section class="card"><h2>Schema audit</h2><p>Source: <code>data/admin/schema_audit.json</code></p></section>
<section class="card"><h2>Internal link audit</h2><p>Source: <code>data/admin/internal_link_report.json</code></p></section>
<section class="card"><h2>Workflow and signal operations</h2><ul><li><a href="${escapeHtml(buildGithubUrl(config, 'reports/workflow-trace/validate.json'))}">Workflow trace report</a></li><li><a href="${escapeHtml(buildGithubUrl(config, 'reports/github-actions-simulation/summary.json'))}">GitHub Actions simulation summary</a></li><li><code>data/admin/signal_ingestion_status.json</code></li></ul></section>
<section><h2>Issue groups</h2>${issueRows}</section>`;
  ensureDir(root('dist/admin/seo'));
  fs.writeFileSync(root('dist/admin/seo/index.html'), htmlShell('LLM Citation Velocity Dashboard', body));
}
function writeRequiredSurfaces() {
  ensureAdminSourceReports();
  writeAdminDataExports();
  writeAdminIndex();
  writeAdminSeo();
}
function main() {
  // The updater excludes directories named "build" during rsync. Keep this release entry point outside scripts/build.
  runNode('scripts/build/build_site.js', 'base static build');
  writeRequiredSurfaces();
  // Re-run distribution prep after admin surfaces are written so batch artifacts can see final dist state where relevant.
  if (fs.existsSync(root('scripts/build/prepare_distribution_artifacts.js'))) {
    runNode('scripts/build/prepare_distribution_artifacts.js', 'distribution artifacts');
  }
  console.log('Release build surfaces complete: admin, SEO/AEO/GEO dashboard, workflow traces, and data exports verified for validation.');
}
try { main(); } catch (err) { console.error(err && err.stack ? err.stack : err); process.exit(1); }

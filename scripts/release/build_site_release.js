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
:root{color-scheme:light;background:#f7f1e8;color:#1d1a16;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0}.shell{max-width:1180px;margin:0 auto;padding:32px 20px 60px}.card{background:#fffaf1;border:1px solid #e4d7c5;border-radius:18px;padding:22px;margin:18px 0;box-shadow:0 12px 28px rgba(56,39,20,.07)}h1{font-size:clamp(2rem,5vw,4rem);line-height:.95;margin:0 0 12px}h2{margin-top:0}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.78rem;color:#7c6245;font-weight:800}.muted{color:#66594b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.metric{border:1px solid #eadfce;border-radius:14px;padding:16px;background:white}.metric strong{display:block;font-size:2rem}.pill{display:inline-block;border:1px solid #d8c8b4;border-radius:999px;padding:6px 10px;margin:3px;background:#fff}code,pre{background:#241e17;color:#f7ead7;border-radius:10px;padding:.12rem .35rem}pre{overflow:auto;padding:14px}a{color:#764b20;font-weight:700}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #eadfce;padding:10px}textarea,input,select{font:inherit;border:1px solid #d8c8b4;border-radius:10px;padding:10px;background:white}button{border:0;border-radius:999px;padding:10px 14px;background:#2c2118;color:white;font-weight:800}.warn{background:#fff3cd;border-color:#e6cf82}.ok{background:#edf8ed;border-color:#b9dfb9}.fail{background:#ffe8e6;border-color:#ebb1ab}</style>
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
  const quality = readJson('data/admin/content_quality_report.json', { items: [] });
  const signal = readJson('data/admin/signal_ingestion_status.json', {});
  const workflow = readJson('data/admin/workflow_health.json', {});
  const seo = readJson('data/admin/seo_dashboard.json', { health: {}, issues: [] });
  const password = loadAdminPassword(config);
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const counts = summarizeStatusCounts(items);
  const eligible = items.filter((item) => item.approval_eligible).length;
  const sampleRows = items.slice(0, 120).map((item) => {
    const meta = item.github_metadata_url || buildGithubUrl(config, item.github_metadata_path || 'data/system/editorial_backlog.json');
    const content = item.github_content_url || (item.github_path ? buildGithubUrl(config, item.github_path) : meta);
    return `<article class="card draft-card ${escapeHtml(item.content_type || 'draft')}">
      <p class="eyebrow">${escapeHtml(item.content_type || 'draft')} · ${escapeHtml(item.status || 'pending')}</p>
      <h3>${escapeHtml(item.title || item.entry_id)}</h3>
      <p class="muted">${escapeHtml(item.entry_id || '')}</p>
      <p><span class="pill">approval eligible: ${item.approval_eligible ? 'yes' : 'no'}</span><span class="pill">data atom: ${item.data_atom_present ? 'yes' : 'no'}</span><span class="pill">Wise Covington routing: ${item.wise_covington_routing_present ? 'yes' : 'no'}</span></p>
      <p><a href="${escapeHtml(meta)}">Open metadata in GitHub</a> · <a href="${escapeHtml(content)}">Open content in GitHub</a></p>
    </article>`;
  }).join('\n');
  const approveCmd = 'node scripts/admin/approve_all_eligible.js && npm run build && npm run validate:all';
  const rejectCmd = 'node scripts/admin/reject_many.js ENTRY_ID_1 ENTRY_ID_2 && npm run build && npm run validate:all';
  const revisionCmd = 'node scripts/admin/mark_many_needs_revision.js ENTRY_ID_1 ENTRY_ID_2 && npm run build && npm run validate:all';
  const body = `
<header class="card">
  <p class="eyebrow">Owner cockpit · manual publishing only</p>
  <h1>Horse Legal Guide Admin</h1>
  <p class="muted">Static owner dashboard for content approval, citation velocity, workflow health, and Wise Covington routing. This is not a CMS and does not mutate files directly.</p>
  <p><a href="/admin/seo/">Open /admin/seo/ LLM Citation Velocity Dashboard</a> · <a href="${escapeHtml(normalizeRepoUrl(config))}/actions">Open GitHub Actions</a></p>
</header>
<section class="card warn">
  <h2>Admin password reminder</h2>
  <p><strong>Original admin password:</strong> <code>${escapeHtml(password)}</code></p>
  <p><strong>password reminder:</strong> this static gate is convenience-only, not real authentication. The password is intentionally visible per owner instruction.</p>
  <p><strong>SHA-256 hash:</strong> <code>${escapeHtml(config.admin_password_sha256 || '')}</code></p>
</section>
<section class="grid">
  <div class="metric"><span class="eyebrow">Draft list</span><strong id="draft-summary">${items.length}</strong><p>draft-list items in admin manifest</p></div>
  <div class="metric"><span class="eyebrow">Approval eligible</span><strong>${eligible}</strong><p>bulk approval-ready items</p></div>
  <div class="metric"><span class="eyebrow">SEO/AEO/GEO</span><strong>${Math.round(seo.health?.citation_velocity || 0)}</strong><p>citation velocity score</p></div>
  <div class="metric"><span class="eyebrow">Workflow</span><strong>${workflow.summary?.passed || workflow.passed || 0}</strong><p>workflow trace pass count</p></div>
</section>
<section class="card">
  <h2>How to use this panel</h2>
  <ol>
    <li>Open <a href="/admin/seo/">/admin/seo/</a> first and resolve any issue groups.</li>
    <li>Use filters to select content by status, type, quality, or cluster.</li>
    <li>Use bulk approval/rejection commands below; buttons do not pretend to mutate files in-browser.</li>
    <li>Open GitHub links for metadata/content edits, then rerun build and validation.</li>
    <li>Publish only after local updater validation and GitHub Actions both pass.</li>
  </ol>
</section>
<section class="card">
  <h2>Bulk approval / rejection commands</h2>
  <p class="muted">Copy these into Terminal from repo root. Word counts are warning-only; hard fails are data atom, routing, safety, and schema issues.</p>
  <pre>${escapeHtml(approveCmd)}</pre>
  <pre>${escapeHtml(rejectCmd)}</pre>
  <pre>${escapeHtml(revisionCmd)}</pre>
</section>
<section class="card">
  <h2>Queue markers</h2>
  <p><span class="pill">insight</span><span class="pill">article</span><span class="pill">whitepaper</span><span class="pill">deep_authority</span><span class="pill">draft-list</span></p>
  <p class="muted">Status counts: ${escapeHtml(JSON.stringify(counts))}</p>
</section>
<section class="card">
  <h2>Operations health</h2>
  <ul>
    <li><strong>Signal ingestion:</strong> ${escapeHtml(signal.status || signal.overall_status || 'recorded')}</li>
    <li><strong>Workflow trace:</strong> <a href="${escapeHtml(buildGithubUrl(config, 'reports/workflow-trace/validate.json'))}">validate workflow trace</a></li>
    <li><strong>GitHub Actions simulation:</strong> <a href="${escapeHtml(buildGithubUrl(config, 'reports/github-actions-simulation/summary.json'))}">simulation summary</a></li>
    <li><strong>SEO dashboard JSON:</strong> <code>/admin/seo/seo_dashboard.json</code></li>
  </ul>
</section>
<section class="card">
  <h2>Draft queue</h2>
  <label for="draft-search">Search draft queue</label>
  <input id="draft-search" placeholder="Search title, entry id, type, or status">
  <div id="draft-list">${sampleRows || '<p>No manifest items available.</p>'}</div>
</section>
<script>
const expectedHash = ${JSON.stringify(config.admin_password_sha256 || '')};
const passwordReminder = ${JSON.stringify(password)};
async function sha256(value){const data=new TextEncoder().encode(value);const hash=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(hash)).map((b)=>b.toString(16).padStart(2,'0')).join('');}
async function gate(){const attempt=window.prompt('Enter admin password (reminder: '+passwordReminder+')');if(attempt===null)return false;const hash=await sha256(attempt);if(expectedHash&&hash!==expectedHash){document.body.innerHTML='<main class="shell"><section class="card"><p>Incorrect password.</p></section></main>';return false;}return true;}
function filterDrafts(){const q=(document.getElementById('draft-search').value||'').toLowerCase();for(const card of document.querySelectorAll('.draft-card')){card.style.display=card.textContent.toLowerCase().includes(q)?'block':'none';}}
document.getElementById('draft-search')?.addEventListener('input',filterDrafts);
gate();
</script>`;
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

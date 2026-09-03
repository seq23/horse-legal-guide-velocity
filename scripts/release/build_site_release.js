const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function resolveDeterministicBuildTimestamp() {
  if (process.env.BUILD_TIMESTAMP) return process.env.BUILD_TIMESTAMP;
  const git = spawnSync('git', ['log', '-1', '--format=%cI'], { cwd: process.cwd(), encoding: 'utf8' });
  const commitTime = String(git.stdout || '').trim();
  if (git.status === 0 && commitTime && Number.isFinite(Date.parse(commitTime))) return new Date(commitTime).toISOString();
  try {
    const epoch = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/system/build_epoch.json'), 'utf8'));
    const fallback = String(epoch.fallback_build_timestamp || '').trim();
    if (fallback && Number.isFinite(Date.parse(fallback))) return new Date(fallback).toISOString();
  } catch {}
  throw new Error('Deterministic build timestamp unavailable. Set BUILD_TIMESTAMP or provide git metadata/data/system/build_epoch.json.');
}
const deterministicBuildTimestamp = resolveDeterministicBuildTimestamp();
process.env.BUILD_TIMESTAMP = deterministicBuildTimestamp;
const preload = path.resolve(process.cwd(), 'scripts/lib/frozen_build_clock.cjs');
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS || '', `--require=${preload}`].filter(Boolean).join(' ').trim();
require(preload);

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
<meta name="robots" content="noindex,nofollow">
<style>
:root{color-scheme:light;background:#f7f1e8;color:#1d1a16;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0}.shell{max-width:1180px;margin:0 auto;padding:32px 20px 60px}.card{background:#fffaf1;border:1px solid #e4d7c5;border-radius:18px;padding:22px;margin:18px 0;box-shadow:0 12px 28px rgba(56,39,20,.07)}h1{font-size:clamp(2rem,5vw,4rem);line-height:.95;margin:0 0 12px}h2{margin-top:0}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.78rem;color:#7c6245;font-weight:800}.muted{color:#66594b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.metric{border:1px solid #eadfce;border-radius:14px;padding:16px;background:white}.metric strong{display:block;font-size:2rem}.pill{display:inline-block;border:1px solid #d8c8b4;border-radius:999px;padding:6px 10px;margin:3px;background:#fff}code,pre{background:#241e17;color:#f7ead7;border-radius:10px;padding:.12rem .35rem}pre{overflow:auto;padding:14px}a{color:#764b20;font-weight:700}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #eadfce;padding:10px}textarea,input,select{font:inherit;border:1px solid #d8c8b4;border-radius:10px;padding:10px;background:white}button,.button-link{border:0;border-radius:999px;padding:10px 14px;background:#2c2118;color:white;font-weight:800;text-decoration:none;display:inline-block}button.metric{color:#1d1a16;background:white;text-align:left;cursor:pointer}.warn{background:#fff3cd;border-color:#e6cf82}.ok{background:#edf8ed;border-color:#b9dfb9}.fail{background:#ffe8e6;border-color:#ebb1ab}.login-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;align-items:stretch}.password-display code{font-size:1.15rem;word-break:break-all}.filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.filter-grid label{display:flex;flex-direction:column;gap:5px;font-weight:750}.button-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}/* The filter bar used to be position:sticky at top:0 while table headers were
   also position:sticky at top:0, so the bar sat permanently on top of the
   column headers (header top 69px vs bar bottom 338px). The table scrolls
   inside .table-scroll, so its headers stick to that container and stay
   visible on their own; the bar does not need to float as well. */
.sticky-admin-bar{z-index:4}.compact-metrics .metric{cursor:pointer}.table-scroll{max-height:780px;overflow:auto;border:1px solid #eadfce;border-radius:14px}.small{font-size:.86rem}th{position:sticky;top:0;z-index:2;background:#fffaf1}.overdue{color:#a3271c}.metric.fail strong{color:#a3271c}#overdue-banner h2{margin:0;font-size:1.15rem;line-height:1.45}</style>
</head>
<body><main class="shell">${body}</main></body>
</html>`;
}
function ensureAdminSourceReports() {
  // Build truth must come from the current source tree and freshly rendered dist, never a carried-forward dashboard snapshot.
  runExport('scripts/quality/generate_content_quality_report.js', 'main', 'content quality report');
  runExport('scripts/admin/generate_admin_manifest.js', 'main', 'admin manifest');
  runExport('scripts/ops/trace_workflows.js', 'main', 'workflow trace');
  runExport('scripts/ops/simulate_github_actions.js', 'main', 'GitHub Actions simulation trace');
  runExport('scripts/quality/run_page_uniqueness_audit.js', 'main', 'page uniqueness audit');
  runExport('scripts/quality/generate_seo_dashboard.js', 'main', 'SEO dashboard');
  runExport('scripts/remediation/build_remediation_queue.js', 'main', 'owner remediation queue');
  runExport('scripts/query/build_provider_query_intelligence.js', 'main', 'provider query intelligence');
  runExport('scripts/agency/generate_agency_report.js', 'main', 'private agency report');
}
function writeAdminDataExports() {
  copyIfExists('data/admin/editorial_manifest.json', 'dist/admin/editorial_manifest.json');
  copyIfExists('data/admin/signal_ingestion_status.json', 'dist/admin/signal_ingestion_status.json');
  copyIfExists('data/admin/workflow_health.json', 'dist/admin/workflow_health.json');
  copyIfExists('data/admin/seo_dashboard.json', 'dist/admin/seo/seo_dashboard.json');
  copyIfExists('data/admin/page_uniqueness_report.json', 'dist/admin/seo/page_uniqueness_report.json');
  copyIfExists('data/admin/consolidation_review_ledger.json', 'dist/admin/seo/consolidation_review_ledger.json');
  copyIfExists('data/admin/draft_uniqueness_report.json', 'dist/admin/seo/draft_uniqueness_report.json');
  copyIfExists('data/admin/github_actions_trace.json', 'dist/admin/github_actions_trace.json');
  copyIfExists('data/system/provider_capabilities.json', 'dist/data/system/provider_capabilities.json');
  copyIfExists('data/system/admin_action_contract.json', 'dist/data/system/admin_action_contract.json');
  copyIfExists('data/agency/dashboard.json', 'dist/data/agency/dashboard.json');
  copyIfExists('data/agency/gsc_snapshot.json', 'dist/data/agency/gsc_snapshot.json');
  copyIfExists('data/agency/bing_snapshot.json', 'dist/data/agency/bing_snapshot.json');
  copyIfExists('data/agency/live_snapshot.json', 'dist/data/agency/live_snapshot.json');
  copyIfExists('data/query_intelligence/provider_opportunities.json', 'dist/data/query_intelligence/provider_opportunities.json');
  copyIfExists('data/remediation/remediation_queue.json', 'dist/data/remediation/remediation_queue.json');
  copyIfExists('data/search/query_observations.json', 'dist/data/search/query_observations.json');
  copyIfExists('data/search/query_diagnostics.json', 'dist/data/search/query_diagnostics.json');
  copyIfExists('data/remediation/query_repair_queue.json', 'dist/data/remediation/query_repair_queue.json');
  copyIfExists('data/system/provider_health.json', 'dist/data/system/provider_health.json');
  copyIfExists('data/system/external_action_truth.json', 'dist/data/system/external_action_truth.json');
}
function summarizeStatusCounts(items) {
  return items.reduce((acc, item) => {
    const key = item.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
// Notes on why this surface looks the way it does are in the PR. Three rules:
//  1. Nothing on this page may claim a check passed unless that check really ran.
//  2. Nothing may present a terminal command as an action a reviewer can take.
//  3. Every count shown to the reviewer is computed, never carried forward.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// The self-heal note is an internal record that the generator rewrote a draft to
// keep it distinct. It is not a defect in the content and must not be counted as
// one: surfacing it inflated the reviewer's warning count from 5 to 193.
const INTERNAL_REVIEW_NOTE = /automatically differentiated in \d+ bounded repair attempt/i;
function reviewerWarnings(item) {
  return (item.warnings || []).filter((warning) => !INTERNAL_REVIEW_NOTE.test(String(warning)));
}
function formatDueDate(iso) {
  const parts = String(iso || '').split('-');
  if (parts.length !== 3) return String(iso || '');
  const month = MONTHS[Number(parts[1]) - 1] || '';
  return `${Number(parts[2])} ${month}`.trim();
}
function statusWord(status) {
  return { pending: 'Waiting for you', approved: 'Approved', needs_revision: 'Needs changes', rejected: 'Not this one' }[status] || String(status || 'Waiting for you');
}
function typeWord(type) {
  return {
    insight: 'Short article',
    article: 'Article',
    whitepaper: 'White paper',
    deep_authority: 'In-depth guide',
    authority: 'In-depth guide',
    template: 'Template'
  }[type] || String(type || 'Article');
}
// A decision on /admin/ has to reach something that can actually change
// data/system/editorial_backlog.json and rebuild+push, and the only thing on
// this repo that can do that without new infrastructure is GitHub Actions
// itself. GitHub's own OAuth bridge (the /api/admin/action endpoint /agency/
// uses) needs Cloudflare Pages secrets (GITHUB_OAUTH_CLIENT_ID etc.) that a
// live check of that session endpoint on 2026-09-03 confirmed are NOT
// configured (provider_configured:false, the login route returned HTTP 500).
// A prior PR already removed that path from this page for exactly that
// reason (see docs/runbooks/GITHUB_ADMIN_AUTH_SETUP.md), guarded by
// _ops/validators/validate_github_admin_functions.js, which fails the build
// if this page advertises that endpoint again while it stays unconfigured.
// So a decision here (buildDecisionIssueUrl/sendDecision below) opens a
// pre-filled GitHub issue instead: creating an issue needs nothing but a
// free, already-existing GitHub account, not a repo role or any new secret.
// .github/workflows/admin-decision-issue.yml picks it up, checks the issue
// author's actual repo permission through GitHub's own API (never trusting
// this page - a public visitor cannot forge that), and only then runs the
// identical approve_many.js / reject_many.js / mark_many_needs_revision.js
// admin-bulk-content-actions.yml already uses. Guarded by
// _ops/validators/validate_admin_ui_dispatches_approvals.js.
function writeAdminIndex() {
  const config = readJson('data/system/config.json', {});
  const manifest = readJson('data/admin/editorial_manifest.json', { items: [] });
  const items = Array.isArray(manifest.items) ? manifest.items : [];
  const counts = summarizeStatusCounts(items);
  // Warning count the reviewer sees excludes the internal self-heal note.
  const warnings = items.filter((item) => reviewerWarnings(item).length).length;
  const clusters = [...new Set(items.map((item) => item.source_cluster).filter(Boolean))].sort();
  const types = [...new Set(items.map((item) => item.content_type).filter(Boolean))].sort();

  // Publication truth. `public_url` is only populated once a draft has actually
  // been rendered to a live page, so it is the only field that can answer
  // "has this system ever published anything".
  const publishedItems = items.filter((item) => item.public_url);
  const publishedCount = publishedItems.length;
  const lastPublish = publishedItems.map((item) => item.publish_date || item.date).filter(Boolean).sort().pop() || '';

  // Build-time overdue figures are a no-JavaScript fallback only. The build
  // clock is frozen to the last commit, so the browser recomputes both numbers
  // against the real current date on load.
  const buildToday = new Date().toISOString().slice(0, 10);
  const overdueAtBuild = items.filter((item) => item.date && item.date < buildToday);
  const earliestOverdue = overdueAtBuild.map((item) => item.date).sort()[0] || '';
  const overdueSentence = overdueAtBuild.length
    ? `${overdueAtBuild.length} draft${overdueAtBuild.length === 1 ? ' is' : 's are'} past ${overdueAtBuild.length === 1 ? 'its' : 'their'} publish date. The earliest was due ${formatDueDate(earliestOverdue)}. Nothing has gone live yet.`
    : 'No draft is past its publish date.';

  const safeItems = items.map((item) => ({
    entry_id: item.entry_id || '',
    title: item.title || item.entry_id || '',
    content_type: item.content_type || 'draft',
    type_label: typeWord(item.content_type),
    status: item.status || 'pending',
    status_label: statusWord(item.status || 'pending'),
    review_status: item.review_status || item.status || 'pending',
    date: item.date || '',
    publish_date: item.publish_date || '',
    source_cluster: item.source_cluster || '',
    source_query_title: item.source_query_title || '',
    excerpt: item.excerpt || '',
    word_count: item.word_count || 0,
    // "Ready" means nothing is blocking it and nothing needs a human look.
    // It deliberately does not encode scores: a 97/100 SEO number told the
    // reviewer nothing she could act on.
    ready: !(item.hard_fails || []).length && !reviewerWarnings(item).length,
    review_notes: [...(item.hard_fails || []), ...reviewerWarnings(item)],
    preview_url: item.preview_url || '',
    public_url: item.public_url || ''
  }));

  const clusterOptions = clusters.map((cluster) => `<option value="${escapeHtml(cluster)}">${escapeHtml(cluster.replace(/-/g, ' '))}</option>`).join('');
  const typeOptions = types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(typeWord(type))}</option>`).join('');
  const reviewEmail = String(config.owner_review_email || '').trim();
  const body = `
<header class="card">
  <p class="eyebrow">Your content — nothing goes live without your say-so</p>
  <h1>Horse Legal Guide Admin</h1>
  <p class="muted">Read the articles written for Wise Covington and choose which ones go on your website.</p>
  <p><a href="/admin/drafts/">Read the queued drafts</a> · <a href="/admin/seo/">Search performance dashboard</a></p>
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
  <section class="card fail" id="overdue-banner"${overdueAtBuild.length ? '' : ' hidden'}>
    <p class="eyebrow">Nothing has been published</p>
    <h2 data-overdue-text>${escapeHtml(overdueSentence)}</h2>
  </section>
  <section class="grid compact-metrics">
    <button class="metric filter-tile" type="button" data-filter-status="all"><span class="eyebrow">All drafts</span><strong>${items.length}</strong><span>show all</span></button>
    <button class="metric filter-tile" type="button" data-filter-status="pending"><span class="eyebrow">Waiting for you</span><strong>${counts.pending || 0}</strong><span>needs your decision</span></button>
    <button class="metric filter-tile fail" type="button" data-filter-quality="overdue"><span class="eyebrow">Overdue</span><strong id="overdue-count">${overdueAtBuild.length}</strong><span>past its publish date</span></button>
    <button class="metric filter-tile" type="button" data-filter-status="approved"><span class="eyebrow">Approved</span><strong>${counts.approved || 0}</strong><span>you said yes</span></button>
    <button class="metric filter-tile" type="button" data-filter-status="needs_revision"><span class="eyebrow">Needs changes</span><strong>${counts.needs_revision || 0}</strong><span>send back</span></button>
    <button class="metric filter-tile" type="button" data-filter-status="rejected"><span class="eyebrow">Not this one</span><strong>${counts.rejected || 0}</strong><span>do not publish</span></button>
    <button class="metric filter-tile" type="button" data-filter-quality="needs_look"><span class="eyebrow">Warnings</span><strong>${warnings}</strong><span>worth a look</span></button>
  </section>
  <section class="card sticky-admin-bar">
    <h2>Filter queue</h2>
    <div class="filter-grid">
      <label>Status<select id="status-filter"><option value="all">All statuses</option><option value="pending">Waiting for you</option><option value="approved">Approved</option><option value="needs_revision">Needs changes</option><option value="rejected">Not this one</option></select></label>
      <label>Ready<select id="quality-filter"><option value="all">Everything</option><option value="ready">Ready</option><option value="needs_look">Needs a look</option><option value="overdue">Past its publish date</option></select></label>
      <label>Content type<select id="type-filter"><option value="all">All content types</option>${typeOptions}</select></label>
      <label>Topic<select id="cluster-filter"><option value="all">All topics</option>${clusterOptions}</select></label>
      <label>Sort<select id="sort-filter"><option value="date-asc">Oldest first</option><option value="date-desc">Newest first</option><option value="title-asc">Title A-Z</option><option value="type-asc">Type A-Z</option><option value="cluster-asc">Topic A-Z</option></select></label>
      <label>Rows per page<select id="page-size"><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
    </div>
    <p id="filter-summary" class="muted">Filters loading.</p>
    <div class="button-row"><button type="button" id="prev-page">Previous</button><button type="button" id="next-page">Next</button><button type="button" id="clear-filters">Clear filters</button></div>
  </section>
  <section class="card" id="send-decisions">
    <h2>Send your decisions</h2>
    <p>Tick the drafts you decide on, then click a decision below. It opens a pre-filled request on GitHub (github.com) with the drafts and your decision already in it - you only click &ldquo;Submit new issue&rdquo; there. A repo maintainer's decision is picked up and applied automatically within a few minutes; anyone else's is answered with what to do next, never applied silently. You do not need to know Git or the command line, just a free GitHub account.</p>
    <div class="button-row"><button type="button" data-select="visible">Select visible page</button><button type="button" data-select="pending">Select everything waiting on this page</button><button type="button" data-select="clear">Clear selected</button></div>
    <div class="button-row"><button type="button" data-decision="approve">Approve selected</button><button type="button" data-decision="needs_revision">Send &ldquo;needs changes&rdquo;</button><button type="button" data-decision="rejected">Send &ldquo;not this one&rdquo;</button></div>
    <p id="send-status" class="muted">Nothing sent yet.</p>
    <p class="muted">No GitHub account, or would rather this go to a person instead of GitHub? Use the matching link instead of the buttons above - it only drafts an email and does not publish anything by itself: <button type="button" data-email-decision="approve" class="button-link">Email an approval</button> · <button type="button" data-email-decision="needs_revision" class="button-link">Email &ldquo;needs changes&rdquo;</button> · <button type="button" data-email-decision="rejected" class="button-link">Email &ldquo;not this one&rdquo;</button></p>
  </section>
  <section class="card">
    <h2>Publishing status</h2>
    <ul>
      <li><strong>Pages published by this system:</strong> ${publishedCount}. <strong>Last publish:</strong> ${publishedCount ? escapeHtml(lastPublish || 'unknown') : 'never'}.</li>
      <li id="publishing-overdue" class="muted">${escapeHtml(overdueSentence)}</li>
      <li><strong>Search performance:</strong> <a href="/admin/seo/">/admin/seo/</a></li>
    </ul>
  </section>
  <section class="card queue-card">
    <h2>Draft queue</h2>
    <p class="muted">Use the filters above instead of title search. The queue is paginated to reduce scrolling.</p>
    <div id="draft-summary" class="muted">Short articles, articles, white papers, in-depth guides and templates.</div><div id="draft-list" class="table-scroll"><table id="draft-table"><thead><tr><th>Select</th><th>Date</th><th>Draft</th><th>Status</th><th>Type</th><th>Topic</th><th>Ready</th><th>Actions</th></tr></thead><tbody id="draft-tbody"></tbody></table></div>
  </section>
</section>
<script id="admin-items" type="application/json">${safeJsonForScript(safeItems)}</script>
<script>
const expectedHash = ${JSON.stringify(config.admin_password_sha256 || '')};
const REVIEW_EMAIL = ${JSON.stringify(reviewEmail)};
const ADMIN_REPO_URL = ${JSON.stringify(normalizeRepoUrl(config))};
const ADMIN_ITEMS = JSON.parse(document.getElementById('admin-items').textContent || '[]');
const MONTH_NAMES = ${JSON.stringify(MONTHS)};
let state = { page: 1, filtered: [] };
async function sha256(value){const data=new TextEncoder().encode(value);const hash=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(hash)).map((b)=>b.toString(16).padStart(2,'0')).join('');}
function escText(value){return String(value ?? '').replace(/[&<>"']/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function revealPasswordReminder(value){const el=document.getElementById('password-reminder-value');if(el)el.textContent=value||'Re-enter the password to show the reminder.';}
async function unlockAdmin(){const input=document.getElementById('admin-password');const attempt=(input?.value||'').trim();const hash=await sha256(attempt);if(expectedHash&&hash!==expectedHash){document.getElementById('login-message').textContent='Password did not match.';return;}sessionStorage.setItem('hlg-admin-open','true');sessionStorage.setItem('hlg-admin-password-reminder',attempt);document.getElementById('login-message').textContent='';document.getElementById('login-landing').hidden=true;document.getElementById('admin-panel').hidden=false;revealPasswordReminder(attempt);renderOverdue();renderQueue();}
function todayISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function isOverdue(item){return Boolean(item.date)&&item.date<todayISO();}
function daysLate(date){const ms=Date.parse(todayISO()+'T00:00:00Z')-Date.parse(date+'T00:00:00Z');return Math.max(0,Math.round(ms/86400000));}
function formatDue(date){const p=String(date||'').split('-');if(p.length!==3)return String(date||'');return Number(p[2])+' '+(MONTH_NAMES[Number(p[1])-1]||'');}
/* Overdue is recomputed in the browser against the real current date. The
   build clock is frozen to the last commit, so a build-time number goes stale
   the day after it is written. */
function renderOverdue(){const od=ADMIN_ITEMS.filter(isOverdue);const tile=document.getElementById('overdue-count');if(tile)tile.textContent=String(od.length);const sentence=od.length?(od.length+' draft'+(od.length===1?' is':'s are')+' past '+(od.length===1?'its':'their')+' publish date. The earliest was due '+formatDue(od.map((i)=>i.date).sort()[0])+'. Nothing has gone live yet.'):'No draft is past its publish date.';const banner=document.getElementById('overdue-banner');if(banner){banner.hidden=!od.length;const text=banner.querySelector('[data-overdue-text]');if(text)text.textContent=sentence;}const line=document.getElementById('publishing-overdue');if(line)line.textContent=sentence;}
function getFilters(){return {status:document.getElementById('status-filter')?.value||'all',quality:document.getElementById('quality-filter')?.value||'all',type:document.getElementById('type-filter')?.value||'all',cluster:document.getElementById('cluster-filter')?.value||'all',sort:document.getElementById('sort-filter')?.value||'date-asc',pageSize:Number(document.getElementById('page-size')?.value||25)}}
function filterItems(){const f=getFilters();let out=ADMIN_ITEMS.slice();if(f.status!=='all')out=out.filter((item)=>item.status===f.status);if(f.type!=='all')out=out.filter((item)=>item.content_type===f.type);if(f.cluster!=='all')out=out.filter((item)=>item.source_cluster===f.cluster);if(f.quality==='ready')out=out.filter((item)=>item.ready);if(f.quality==='needs_look')out=out.filter((item)=>!item.ready);if(f.quality==='overdue')out=out.filter(isOverdue);const [field,direction]=f.sort.split('-');out.sort((a,b)=>{let av='',bv='';if(field==='date'){av=a.date||'9999-12-31';bv=b.date||'9999-12-31';}else if(field==='title'){av=a.title||'';bv=b.title||'';}else if(field==='type'){av=a.type_label||'';bv=b.type_label||'';}else if(field==='cluster'){av=a.source_cluster||'';bv=b.source_cluster||'';}else{av=a.status_label||'';bv=b.status_label||'';}return direction==='desc'?String(bv).localeCompare(String(av)):String(av).localeCompare(String(bv));});return out;}
function readyLabel(item){return item.ready?'Ready':'Needs a look';}
function dateCell(item){if(!item.date)return '<span class="muted">no date</span>';if(!isOverdue(item))return escText(item.date);return '<span class="overdue"><strong>'+escText(item.date)+'</strong><br><span class="small">'+daysLate(item.date)+' days overdue</span></span>';}
function renderRows(items){const tbody=document.getElementById('draft-tbody');if(!tbody)return;if(!items.length){tbody.innerHTML='<tr><td colspan="8" class="muted">No drafts match the current filters.</td></tr>';return;}tbody.innerHTML=items.map((item)=>{const notes=(item.review_notes||[]).slice(0,3).join('; ')||'Nothing flagged on this draft.';const readLink=item.preview_url||item.public_url||'';const actions=readLink?'<a href="'+escText(readLink)+'">Read this draft</a>':'<span class="muted">No preview</span>';return '<tr data-entry-id="'+escText(item.entry_id)+'" data-status="'+escText(item.status)+'"><td><input class="row-check" type="checkbox" value="'+escText(item.entry_id)+'"></td><td>'+dateCell(item)+'</td><td><strong>'+escText(item.title)+'</strong><div class="muted small">'+escText(item.entry_id)+'</div><details><summary>Excerpt / notes</summary><p>'+escText(item.excerpt)+'</p><p>'+escText(notes)+'</p></details></td><td><span class="pill">'+escText(item.status_label)+'</span></td><td>'+escText(item.type_label)+'</td><td>'+escText((item.source_cluster||'').replaceAll('-',' '))+'</td><td>'+escText(readyLabel(item))+'</td><td>'+actions+'</td></tr>';}).join('');}
function renderQueue(resetPage=false){if(resetPage)state.page=1;const f=getFilters();const filtered=filterItems();state.filtered=filtered;const maxPage=Math.max(1,Math.ceil(filtered.length/f.pageSize));if(state.page>maxPage)state.page=maxPage;const start=(state.page-1)*f.pageSize;const visible=filtered.slice(start,start+f.pageSize);renderRows(visible);const summary=document.getElementById('filter-summary');if(summary)summary.textContent='Showing '+visible.length+' rows on page '+state.page+' of '+maxPage+'; '+filtered.length+' match filters out of '+ADMIN_ITEMS.length+' total drafts.';}
function selectedIds(){return Array.from(document.querySelectorAll('.row-check:checked')).map((el)=>el.value);}
function selectRows(kind){for(const row of document.querySelectorAll('#draft-tbody tr[data-entry-id]')){const cb=row.querySelector('.row-check');if(!cb)continue;if(kind==='clear')cb.checked=false;if(kind==='visible')cb.checked=true;if(kind==='pending')cb.checked=row.dataset.status==='pending';}}
/* Opens a labelled GitHub issue that admin-decision-issue.yml reads and
   applies after checking the author's real repo permission. See the comment
   above writeAdminIndex() in this file for why decisions route through an
   issue rather than a direct server call. */
function buildDecisionIssueUrl(kind,ids){
  const action={approve:'approve',needs_revision:'needs_revision',rejected:'reject'}[kind]||kind;
  const label={approve:'approve',needs_revision:'needs changes',rejected:'not this one'}[kind]||kind;
  const byId=Object.fromEntries(ADMIN_ITEMS.map((i)=>[i.entry_id,i]));
  const lines=ids.map((id)=>{const item=byId[id]||{};return '- '+(item.title||id)+' ('+id+')';});
  const title='Admin decision: '+ids.length+' draft'+(ids.length===1?'':'s')+' marked "'+label+'"';
  const body='Action: '+action+String.fromCharCode(10)+'IDs: '+ids.join(' ')+String.fromCharCode(10,10)+lines.join(String.fromCharCode(10))+String.fromCharCode(10,10)+'Submitted from /admin/ on '+todayISO()+'. Do not edit the Action/IDs lines above - they are read automatically.';
  const base=ADMIN_REPO_URL.endsWith('/')?ADMIN_REPO_URL.slice(0,-1):ADMIN_REPO_URL;
  const url=new URL(base+'/issues/new');
  url.searchParams.set('title',title);
  url.searchParams.set('body',body);
  url.searchParams.set('labels','admin-decision');
  return url.toString();
}
function sendDecision(kind){
  const ids=selectedIds();
  const status=document.getElementById('send-status');
  const label={approve:'approve',needs_revision:'needs changes',rejected:'not this one'}[kind]||kind;
  if(!ids.length){status.textContent='Tick at least one draft first.';return;}
  if(!window.confirm('Open a GitHub request for '+ids.length+' draft'+(ids.length===1?'':'s')+' marked "'+label+'"? Nothing changes until you click "Submit new issue" on the GitHub page that opens.'))return;
  window.open(buildDecisionIssueUrl(kind,ids),'_blank','noopener');
  status.textContent=ids.length+' draft'+(ids.length===1?'':'s')+' marked "'+label+'" - a pre-filled GitHub request just opened in a new tab. Click "Submit new issue" there to send it; it is applied automatically within a few minutes once submitted.';
}
function emailDecision(kind){
  const ids=selectedIds();
  const status=document.getElementById('send-status');
  const label={approve:'approve',needs_revision:'needs changes',rejected:'not this one'}[kind]||kind;
  if(!ids.length){status.textContent='Tick at least one draft first.';return;}
  if(!window.confirm('Email '+ids.length+' draft'+(ids.length===1?'':'s')+' as "'+label+'"? This only drafts an email; nothing is published by this step.'))return;
  const byId=Object.fromEntries(ADMIN_ITEMS.map((i)=>[i.entry_id,i]));const lines=ids.map((id)=>{const item=byId[id]||{};return '- '+(item.title||id)+' ('+id+')';});const subject='Horse Legal Guide: '+ids.length+' draft'+(ids.length===1?'':'s')+' marked "'+label+'"';const intro=kind==='approve'?'I approve these drafts for publishing:':kind==='needs_revision'?'These drafts need changes before publishing:':'Please do not publish these drafts:';const bodyText=intro+String.fromCharCode(10,10)+lines.join(String.fromCharCode(10))+String.fromCharCode(10,10)+'Sent from /admin/ on '+todayISO()+'.';window.location.href='mailto:'+encodeURIComponent(REVIEW_EMAIL)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(bodyText);status.textContent=ids.length+' draft'+(ids.length===1?'':'s')+' added to an email marked "'+label+'". This only drafted an email; nothing is published until whoever receives it takes the GitHub-request action above.'+(REVIEW_EMAIL?'':' Add the recipient address before sending: it is not configured yet.');}
function bindAdmin(){document.getElementById('unlock-admin')?.addEventListener('click',unlockAdmin);document.getElementById('admin-password')?.addEventListener('keydown',(event)=>{if(event.key==='Enter')unlockAdmin();});['status-filter','quality-filter','type-filter','cluster-filter','sort-filter','page-size'].forEach((id)=>document.getElementById(id)?.addEventListener('change',()=>renderQueue(true)));document.getElementById('prev-page')?.addEventListener('click',()=>{state.page=Math.max(1,state.page-1);renderQueue();});document.getElementById('next-page')?.addEventListener('click',()=>{state.page+=1;renderQueue();});document.getElementById('clear-filters')?.addEventListener('click',()=>{document.getElementById('status-filter').value='all';document.getElementById('quality-filter').value='all';document.getElementById('type-filter').value='all';document.getElementById('cluster-filter').value='all';document.getElementById('sort-filter').value='date-asc';renderQueue(true);});document.querySelectorAll('[data-filter-status]').forEach((button)=>button.addEventListener('click',()=>{document.getElementById('status-filter').value=button.dataset.filterStatus||'all';document.getElementById('quality-filter').value='all';renderQueue(true);}));document.querySelectorAll('[data-filter-quality]').forEach((button)=>button.addEventListener('click',()=>{document.getElementById('status-filter').value='all';document.getElementById('quality-filter').value=button.dataset.filterQuality||'all';renderQueue(true);}));document.querySelectorAll('[data-select]').forEach((button)=>button.addEventListener('click',()=>selectRows(button.dataset.select)));document.querySelectorAll('[data-decision]').forEach((button)=>button.addEventListener('click',()=>sendDecision(button.dataset.decision)));document.querySelectorAll('[data-email-decision]').forEach((button)=>button.addEventListener('click',()=>emailDecision(button.dataset.emailDecision)));if(sessionStorage.getItem('hlg-admin-open')==='true'){document.getElementById('login-landing').hidden=true;document.getElementById('admin-panel').hidden=false;revealPasswordReminder(sessionStorage.getItem('hlg-admin-password-reminder')||'');}renderOverdue();renderQueue();}
document.addEventListener('DOMContentLoaded',bindAdmin);</script>`;
  ensureDir(root('dist/admin'));
  fs.writeFileSync(root('dist/admin/index.html'), htmlShell('Horse Legal Guide Admin', body));
}
function writeAdminSeo() {
  const config = readJson('data/system/config.json', {});
  const dashboard = readJson('data/admin/seo_dashboard.json', { health: {}, metrics: {}, source_files: [], issues: [], truth_boundary: 'Live GitHub Actions and deployed search/indexing behavior must be verified after apply.' });
  const healthRows = Object.entries(dashboard.health || {}).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  // The GitHub Actions trace self-describes as
  // "not_executed_in_chatgpt_container" and its own truth boundary says it
  // "does not prove live GitHub Actions". Printing its status verbatim rendered
  // the word "passed" for a check that never ran. A check that did not run says
  // "not run".
  const metricValue = (key, value) => (
    key === 'github_actions_simulation_status'
      ? 'not run (local simulation only; live GitHub Actions not executed)'
      : String(value)
  );
  const metricRows = Object.entries(dashboard.metrics || {}).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(metricValue(key, value))}</td></tr>`).join('');
  const sourceRows = (dashboard.source_files || []).map((file) => `<li><code>${escapeHtml(file)}</code>${fs.existsSync(root(file)) ? ' · present' : ' · missing'}</li>`).join('');
  const issues = dashboard.issues || [];
  const issueRows = issues.length ? issues.map((issue) => `<article class="card fail"><h3>${escapeHtml(issue.category)}: ${escapeHtml(issue.issue)}</h3><p><strong>Why it matters:</strong> ${escapeHtml(issue.why_it_matters)}</p><p><strong>Recommended fix:</strong> ${escapeHtml(issue.recommended_fix)}</p><p><strong>Source metric:</strong> ${escapeHtml(issue.source_metric)}</p><p><strong>Affected pages:</strong> ${escapeHtml((issue.affected_pages || []).slice(0, 12).join(', '))}</p></article>`).join('') : '<p class="ok card">No local issue groups. Live GitHub Actions and deployed indexing still need post-apply proof.</p>';
  const body = `
<header class="card">
  <p class="eyebrow">SEO / AEO / GEO · real generated data</p>
  <h1>LLM Citation Velocity Dashboard</h1>
  <p class="muted">Measures local generated surfaces, schema, metadata, internal links, content atoms, workflow trace, signal ingestion, and Wise Covington routing.</p>
  <p><a href="/admin/">Back to admin</a> · <code>/admin/seo/seo_dashboard.json</code> · <a href="/admin/seo/page_uniqueness_report.json">Page uniqueness report</a> · <a href="/admin/seo/consolidation_review_ledger.json">Owner-review ledger</a> · <a href="/admin/seo/draft_uniqueness_report.json">Draft self-heal report</a> · <a href="${escapeHtml(normalizeRepoUrl(config))}/actions">GitHub Actions</a></p>
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
function writeAgencyIndex() {
  const body = `
<header class="card">
  <p class="eyebrow">Private search intelligence · approval-gated</p>
  <h1>Horse Legal Guide Agency Dashboard</h1>
  <p class="muted">Google Search Console, Bing Webmaster Tools, live-route monitoring, page uniqueness, provider-fed opportunities, and owner-approved remediation. Monitoring may run automatically; content approval and live-page changes remain manual.</p>
  <p><a href="/admin/">Back to admin</a> · <a href="/admin/seo/">Local SEO dashboard</a></p>
</header>
<section class="card"><div class="button-row"><button id="agency-refresh" type="button">Refresh GSC + Bing</button><button id="agency-query" type="button">Rebuild query intelligence</button><button id="agency-remediation" type="button">Refresh remediation queue</button><button id="agency-logout" type="button">Sign out</button></div><p id="agency-user" class="muted">Checking GitHub identity…</p><pre id="agency-receipt">No action dispatched.</pre></section>
<section class="card"><h2>Provider health</h2><div id="agency-health" class="grid"></div></section>
<section class="card"><h2>Google performance</h2><div id="agency-gsc-metrics" class="grid"></div><div class="table-scroll"><table><thead><tr><th>Query or page</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody id="agency-gsc-table"></tbody></table></div></section>
<section class="card"><h2>Bing performance and crawl</h2><div class="table-scroll"><table><thead><tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>Position</th></tr></thead><tbody id="agency-bing-table"></tbody></table></div></section>
<section class="card"><h2>Active live-query tests</h2><p class="muted">Grounded live-search evidence is kept separate from literal Google rank. GSC remains the source of truth for owned-site Google impressions, clicks, CTR, and average position.</p><div class="table-scroll"><table><thead><tr><th>Query</th><th>Target</th><th>State</th><th>Site surfaced</th><th>Observed competitors</th></tr></thead><tbody id="agency-active-query-table"></tbody></table></div></section>
<section class="card"><h2>Query-driven finished repair proposals</h2><p class="muted">The system automatically diagnoses and prepares a bounded page patch using already-approved Horse Legal Guide answer content. The client still approves before any live legal-page change.</p><div class="button-row"><button id="approve-query-repairs" type="button">Approve selected query repairs</button><button id="reject-query-repairs" type="button">Reject selected query repairs</button><button id="apply-query-repairs" type="button">Apply already-approved query repairs</button></div><div class="table-scroll"><table><thead><tr><th>Select</th><th>Query</th><th>State</th><th>Target</th><th>Diagnosis / retest</th></tr></thead><tbody id="agency-query-repair-table"></tbody></table></div></section>
<section class="card"><h2>Provider-fed opportunities</h2><p class="muted">Select only new-candidate opportunities you want admitted as pending drafts. Admission triggers draft generation, self-healing, and prevalidation; it does not approve or publish.</p><div class="button-row"><button id="admit-query-candidates" type="button">Admit selected as pending drafts</button></div><div class="table-scroll"><table><thead><tr><th>Select</th><th>Query</th><th>Type</th><th>Target</th><th>Evidence</th></tr></thead><tbody id="agency-query-table"></tbody></table></div></section>
<section class="card"><h2>Owner-approved page remediation</h2><p class="muted">No live search control is applied until a proposal is approved with a specific action and then separately applied.</p><label>Approved action<select id="remediation-action"><option value="noindex_keep_llm">Noindex, keep in LLM feeds</option><option value="canonical_to_primary">Canonical/noindex to primary</option><option value="redirect_to_primary">301 redirect to primary</option><option value="differentiate_patch">Apply reviewed differentiation patch</option></select></label><div class="button-row"><button id="approve-remediations" type="button">Approve selected action</button><button id="reject-remediations" type="button">Reject selected</button><button id="apply-remediations" type="button">Apply already-approved selected</button></div><div class="table-scroll"><table><thead><tr><th>Select</th><th>Proposal</th><th>Status</th><th>Primary</th><th>Members</th><th>Evidence</th></tr></thead><tbody id="agency-remediation-table"></tbody></table></div></section>
<script>
let agencySession=null,agencyReport=null;
const esc=(value)=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num=(value)=>new Intl.NumberFormat().format(Number(value)||0);const pct=(value)=>((Number(value)||0)*100).toFixed(1)+'%';
async function api(url,options={}){const response=await fetch(url,{cache:'no-store',...options});const data=await response.json();if(!response.ok)throw new Error(data.error||url+' failed');return data;}
function healthCard(label,item){return '<div class="metric"><span class="eyebrow">'+esc(label)+'</span><strong>'+esc(item?.status||'unknown')+'</strong><span>'+esc(item?.message||'')+'</span></div>';}
function selected(name){return Array.from(document.querySelectorAll('input[name="'+name+'"]:checked')).map(el=>el.value);}
function render(){const h=agencyReport.health||{};document.getElementById('agency-health').innerHTML=healthCard('Google Search Console',h.gsc)+healthCard('Bing Webmaster Tools',h.bing)+healthCard('Live routes',h.live);const g=agencyReport.performance?.gsc||{};document.getElementById('agency-gsc-metrics').innerHTML=[['Clicks',num(g.clicks)],['Impressions',num(g.impressions)],['CTR',pct(g.ctr)],['Average position',Number(g.position||0).toFixed(1)]].map(x=>'<div class="metric"><span class="eyebrow">'+x[0]+'</span><strong>'+x[1]+'</strong></div>').join('');const gRows=[...(agencyReport.performance?.gsc_top_queries||[]).slice(0,30).map(r=>({label:'Query: '+(r.keys?.[0]||''),...r})),...(agencyReport.performance?.gsc_top_pages||[]).slice(0,20).map(r=>({label:'Page: '+(r.keys?.[0]||''),...r}))];document.getElementById('agency-gsc-table').innerHTML=gRows.map(r=>'<tr><td>'+esc(r.label)+'</td><td>'+num(r.clicks)+'</td><td>'+num(r.impressions)+'</td><td>'+pct(r.ctr)+'</td><td>'+Number(r.position||0).toFixed(1)+'</td></tr>').join('')||'<tr><td colspan="5">No connected GSC data yet.</td></tr>';document.getElementById('agency-bing-table').innerHTML=(agencyReport.performance?.bing_top_queries||[]).slice(0,50).map(r=>'<tr><td>'+esc(r.Query||r.QueryString||r.query||'')+'</td><td>'+num(r.Clicks||r.clicks)+'</td><td>'+num(r.Impressions||r.impressions)+'</td><td>'+Number(r.AvgImpressionPosition||r.position||0).toFixed(1)+'</td></tr>').join('')||'<tr><td colspan="4">No connected Bing data yet.</td></tr>';document.getElementById('agency-query-table').innerHTML=(agencyReport.query_intelligence?.opportunities||[]).map(item=>'<tr><td><input type="checkbox" name="query-opportunity" value="'+esc(item.opportunity_id)+'" '+(item.type==='new_candidate'?'':'disabled')+'></td><td><strong>'+esc(item.query)+'</strong></td><td>'+esc(item.type)+'</td><td>'+esc(item.target_page||'new candidate')+'</td><td>'+num(item.metrics?.impressions)+' impressions · '+num(item.metrics?.clicks)+' clicks</td></tr>').join('')||'<tr><td colspan="5">No provider opportunities yet.</td></tr>';document.getElementById('agency-active-query-table').innerHTML=(agencyReport.active_search?.diagnostics||[]).map(item=>'<tr><td><strong>'+esc(item.query)+'</strong></td><td>'+esc(item.target_page||'—')+'</td><td>'+esc(item.state)+'</td><td>'+esc(item.evidence?.grounded_site_surfaced?'yes':'no / unproven')+'</td><td>'+esc((item.evidence?.competitor_urls||[]).slice(0,3).join(' · '))+'</td></tr>').join('')||'<tr><td colspan="5">No live-query observations yet.</td></tr>';document.getElementById('agency-query-repair-table').innerHTML=(agencyReport.query_repairs?.repairs||[]).map(item=>'<tr><td><input type="checkbox" name="query-repair" value="'+esc(item.repair_id)+'"></td><td><strong>'+esc(item.query)+'</strong></td><td>'+esc(item.state)+'</td><td>'+esc(item.target_page)+'</td><td>'+esc((item.diagnosis||[]).join(', '))+' · '+esc(item.retest_status||'not deployed')+'</td></tr>').join('')||'<tr><td colspan="5">No query-driven repairs currently require owner review.</td></tr>';document.getElementById('agency-remediation-table').innerHTML=(agencyReport.remediation?.proposals||[]).map(item=>'<tr><td><input type="checkbox" name="remediation" value="'+esc(item.proposal_id)+'"></td><td>'+esc(item.proposal_id)+'</td><td>'+esc(item.status)+'</td><td>'+esc(item.candidate_primary)+'</td><td>'+num(item.members?.length)+'</td><td>'+Math.round(Number(item.maximum_body_similarity||0)*100)+'% · '+esc((item.reasons||[]).join(', '))+'</td></tr>').join('')||'<tr><td colspan="6">No remediation proposals.</td></tr>';}
async function dispatch(action,ids=[],extra={}){if(!agencySession?.authenticated)throw new Error('GitHub sign-in required.');if(!window.confirm('Dispatch '+action.replaceAll('_',' ')+'?'))return;const data=await api('/api/admin/action',{method:'POST',headers:{'content-type':'application/json','x-hlg-admin-csrf':agencySession.csrf},body:JSON.stringify({action,ids,reason:'Horse Legal Guide agency dashboard action',...extra})});document.getElementById('agency-receipt').textContent=JSON.stringify(data.receipt,null,2);}
async function load(){agencySession=await api('/api/admin/github/session');if(!agencySession.authenticated){window.location.href='/api/admin/github/login?return_to=%2Fagency%2F';return;}document.getElementById('agency-user').textContent='Signed in as @'+agencySession.user.login+'.';agencyReport=(await api('/api/agency/dashboard'));render();}
document.getElementById('agency-refresh').addEventListener('click',()=>dispatch('refresh_search'));document.getElementById('agency-query').addEventListener('click',()=>dispatch('rebuild_query_intelligence'));document.getElementById('agency-remediation').addEventListener('click',()=>dispatch('refresh_remediation_queue'));document.getElementById('admit-query-candidates').addEventListener('click',()=>dispatch('admit_query_candidates',selected('query-opportunity')));document.getElementById('approve-remediations').addEventListener('click',()=>dispatch('approve_remediation',selected('remediation'),{approved_action:document.getElementById('remediation-action').value}));document.getElementById('reject-remediations').addEventListener('click',()=>dispatch('reject_remediation',selected('remediation')));document.getElementById('apply-remediations').addEventListener('click',()=>dispatch('apply_remediation',selected('remediation')));document.getElementById('approve-query-repairs').addEventListener('click',()=>dispatch('approve_query_repair',selected('query-repair')));document.getElementById('reject-query-repairs').addEventListener('click',()=>dispatch('reject_query_repair',selected('query-repair')));document.getElementById('apply-query-repairs').addEventListener('click',()=>dispatch('apply_query_repair',selected('query-repair')));document.getElementById('agency-logout').addEventListener('click',async()=>{await fetch('/api/admin/github/logout',{method:'POST'});window.location.href='/admin/';});load().catch(error=>{document.getElementById('agency-user').textContent='Dashboard unavailable: '+error.message;});
</script>`;
  ensureDir(root('dist/agency'));
  fs.writeFileSync(root('dist/agency/index.html'), htmlShell('Horse Legal Guide Agency Dashboard', body));
}
function writeRequiredSurfaces() {
  ensureAdminSourceReports();
  writeAdminDataExports();
  writeAdminIndex();
  writeAdminSeo();
  writeAgencyIndex();
  copyIfExists('_routes.json', 'dist/_routes.json');
}
function main() {
  // The updater excludes directories named "build" during rsync. Keep this release entry point outside scripts/build.
  runNode('scripts/build/build_site.js', 'base static build');
  runNode('scripts/remediation/apply_search_controls.js', 'owner-approved search controls');
  writeRequiredSurfaces();
  // Re-run distribution prep after admin surfaces are written so batch artifacts can see final dist state where relevant.
  if (fs.existsSync(root('scripts/build/prepare_distribution_artifacts.js'))) {
    runNode('scripts/build/prepare_distribution_artifacts.js', 'distribution artifacts');
  }
  console.log('Release build surfaces complete: admin, SEO/AEO/GEO dashboard, workflow traces, and data exports verified for validation.');
}
try { main(); } catch (err) { console.error(err && err.stack ? err.stack : err); process.exit(1); }

const fs = require('fs');
const path = require('path');
const { renderLayout } = require('../lib/render_page');
const { readJson } = require('../../_ops/validators/helpers');

function ensureDir(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }

function writeAdminPage(distDir) {
  const config = readJson('data/system/config.json');
  const backlog = readJson('data/system/editorial_backlog.json');
  const strategy = readJson('data/system/content_strategy.json');
  const rawSignals = readJson('data/community/raw_signals.json');
  const normalizedSignals = readJson('data/community/normalized_signals.json');
  const publishQueue = readJson('data/community/publish_queue.json');
  const ingestionReport = fs.existsSync(path.resolve(process.cwd(), 'data/community/ingestion_report.json')) ? readJson('data/community/ingestion_report.json') : null;
  const adminDir = path.join(distDir, 'admin');
  ensureDir(adminDir);
  fs.writeFileSync(path.join(adminDir, 'backlog.json'), JSON.stringify(backlog, null, 2));
  const body = `
<header>
  <span class="eyebrow">Internal review</span>
  <h1>Draft Review Admin</h1>
  <p class="muted">Manual review dashboard for queued drafts. Publishing mode remains manual. This page is a lightweight static review surface, not a CMS.</p>
</header>
<section>
  <h2>System summary</h2>
  <p><strong>Canonical:</strong> <a href="${config.canonical_domain}">${config.canonical_domain}</a></p>
  <p><strong>Velocity domain:</strong> <a href="${config.site_domain}">${config.site_domain}</a></p>
  <p><strong>GitHub repo:</strong> <a href="${config.github_repo_url}">${config.github_repo_url}</a></p>
  <p><strong>Daily:</strong> ${strategy.daily.join(', ')} · <strong>Weekly:</strong> ${strategy.weekly.join(', ')} · <strong>Monthly:</strong> ${strategy.monthly.join(', ')} · <strong>Quarterly:</strong> ${strategy.quarterly.join(', ')}</p>
</section>
<section>
  <h2>Ingestion status</h2>
  <p><strong>New Signals:</strong> ${rawSignals.length} · <strong>Promoted Signals:</strong> ${publishQueue.filter((q) => q.status === 'approved_for_content').length} · <strong>Ignored Signals:</strong> ${publishQueue.filter((q) => q.status === 'ignored' || q.status === 'rejected').length} · <strong>Strengthened Pages:</strong> ${publishQueue.filter((q) => q.action === 'strengthen_existing_page').length}</p>
  <p class="muted">Source Mix and cluster status are generated from metadata-only signals. Raw user posts are not shown publicly.</p>
  <ul>
    ${Object.entries(rawSignals.reduce((acc, s) => { const key = s.source_key || s.platform || 'unknown'; acc[key] = (acc[key] || 0) + 1; return acc; }, {})).map(([key, value]) => `<li>${key}: ${value}</li>`).join('') }
  </ul>
  <p><a href="/coverage/">Open coverage map</a> · <a href="/reference/">Open reference index</a></p><p class="muted">Audit artifacts: <code>/reference/index.json</code> · <code>/reference/signal_trace.json</code> · <code>/reference/fanout/</code> · <code>/reference/llm.txt</code></p>
</section>
<section>
  <h2>Bulk approval commands</h2>
  <p class="muted">Run these locally in the repo root, then commit the updated backlog and calendar files.</p>
  <ul>
    <li><code>node scripts/admin/approve_by_type.js insight</code></li>
    <li><code>node scripts/admin/approve_by_type.js article</code></li>
    <li><code>node scripts/admin/approve_by_type.js whitepaper</code></li>
    <li><code>node scripts/admin/approve_by_filter.js source_cluster horse-sale-and-purchase</code></li>
  </ul>
</section>
<section>
  <h2>Draft queue</h2>
  <label for="draft-search"><strong>Search drafts</strong></label>
  <input id="draft-search" type="search" placeholder="Search by title, type, or cluster" style="display:block;width:100%;max-width:520px;margin:10px 0 16px;">
  <label for="draft-filter"><strong>Filter by content type</strong></label>
  <select id="draft-filter" style="display:block;margin:10px 0 16px;">
    <option value="all">All types</option>
    <option value="insight">Insight</option>
    <option value="article">Article</option>
    <option value="whitepaper">White paper</option>
    <option value="deep_authority">Deep authority</option>
  </select>
  <div id="draft-count" class="muted"></div>
  <div id="draft-summary" class="muted"></div>
  <h3>Pending approval</h3>
  <div id="draft-list"></div>
  <h3>Needs revision</h3>
  <div id="revision-list"></div>
</section>
<script>
const backlog = ${JSON.stringify(backlog)};
const expectedHash = ${JSON.stringify(config.admin_password_sha256)};
async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function gate() {
  const attempt = window.prompt('Enter admin password');
  if (attempt === null) {
    document.body.innerHTML = '<main class="page-shell"><div class="page-card"><p>Admin view cancelled.</p></div></main>';
    return false;
  }
  const hash = await sha256(attempt);
  if (hash !== expectedHash) {
    document.body.innerHTML = '<main class="page-shell"><div class="page-card"><p>Incorrect password.</p></div></main>';
    return false;
  }
  return true;
}
function githubLink(item) {
  if (!item.github_path) return '#';
  const base = ${JSON.stringify(config.github_repo_url)};
  if (!base || base.includes('REPLACE_OWNER') || base.includes('REPLACE_REPO')) return '#';
  return (base.endsWith('/') ? base.slice(0, -1) : base) + '/blob/main/' + item.github_path;
}
function row(item, revision) {
  const git = githubLink(item);
  const gitText = git === '#' ? ' · GitHub link pending repo URL update' : ' · <a href="' + git + '">Open in GitHub</a>';
  const action = revision
    ? '<p style="margin:8px 0 0;"><strong>Reason:</strong> ' + escapeHtml((item.generation_validation?.fails || []).join('; ')) + '</p>'
    : '<p style="margin:8px 0 0;">Approve one: <code>node scripts/admin/approve_one.js ' + escapeHtml(item.entry_id) + '</code></p>';
  return '<article class="review-card">'
    + '<h2 style="margin:0 0 8px;">' + escapeHtml(item.title) + '</h2>'
    + '<p class="muted" style="margin:0 0 8px;">' + escapeHtml(item.date) + ' · ' + escapeHtml(item.content_type) + ' · ' + escapeHtml((item.source_cluster || '').replace(/-/g, ' ')) + ' · word count ' + escapeHtml(String(item.generation_validation?.word_count || '')) + '</p>'
    + '<p style="margin:0 0 8px;">' + escapeHtml(item.notes || '') + '</p>'
    + '<p style="margin:0;"><strong>Scheduled slug:</strong> <code>' + escapeHtml(item.slug) + '</code>' + gitText + '</p>'
    + action
    + '</article>';
}
function escapeHtml(value) { return String(value || '').replace(/[&<>\"]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function applyFilters() {
  const q = document.getElementById('draft-search').value.toLowerCase().trim();
  const type = document.getElementById('draft-filter').value;
  const filtered = backlog.filter((item) => {
    const hay = [item.title, item.content_type, item.source_cluster, item.notes].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (type === 'all' || item.content_type === type);
  });
  const ready = filtered.filter((item) => (item.generation_validation?.status || 'pass') !== 'fail');
  const revision = filtered.filter((item) => (item.generation_validation?.status || 'pass') === 'fail');
  const counts = filtered.reduce((acc, item) => { const key = item.content_type || 'unknown'; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
  document.getElementById('draft-count').textContent = ready.length + ' pending approval · ' + revision.length + ' need revision';
  document.getElementById('draft-summary').textContent = ['insight', 'article', 'whitepaper', 'deep_authority'].map((key) => key + ': ' + (counts[key] || 0)).join(' · ');
  document.getElementById('draft-list').innerHTML = ready.map((item) => row(item, false)).join('');
  document.getElementById('revision-list').innerHTML = revision.map((item) => row(item, true)).join('');
}
(async function init() {
  const ok = await gate();
  if (!ok) return;
  document.getElementById('draft-search').addEventListener('input', applyFilters);
  document.getElementById('draft-filter').addEventListener('change', applyFilters);
  applyFilters();
})();
</script>`;
  const html = renderLayout({ title: 'Draft Review Admin', description: 'Manual review dashboard for Wise Covington velocity drafts.', url: '/admin/', body, includeBrandChrome: false });
  fs.writeFileSync(path.join(adminDir, 'index.html'), html);
}
module.exports = { writeAdminPage };

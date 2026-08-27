'use strict';
/**
 * Render every queued draft to a readable HTML preview, plus an index over them.
 *
 * Why this exists: the 300 drafts in data/system/editorial_backlog.json were all
 * approval_eligible and all prevalidated, and there was still no way for a
 * non-technical reviewer to read one. `preview_url` carried a bare relative path
 * that 404s, and the only surface that actually resolved was raw markdown in a
 * private GitHub repo. This renders the drafts themselves.
 *
 * Where it renders: /admin/drafts/. That namespace is not cosmetic. Every
 * surface that sweeps dist/ - the sitemap and indexnow writers in
 * write_sitemaps.js, validate_review_flow, validate_page_contract,
 * validate_canonical_url_contract, validate_canonical_protection,
 * validate_sitemap_page_parity, validate_content_pattern_contract - already
 * skips /admin/ as an operator surface. Unapproved content rendered there cannot
 * leak into a sitemap or a public index because someone forgot one exclusion.
 * scripts/quality/content_ops_common.js#draftPreviewUrl builds the matching
 * absolute URL, and both admin manifest generators read it from there.
 *
 * These pages are NOT publishing. Status is shown, never changed. The approval
 * commands are printed as copyable text, never wired to a control.
 *
 * Degradation is a failure, not an empty page. The known repo hazard is a job
 * that reads a manifest, silently produces nothing, and commits the nothing
 * while CI stays green. So this reads the backlog directly rather than a derived
 * manifest that may be stale, and throws if the backlog is unreadable or if a
 * non-empty backlog yields zero previews.
 */
const fs = require('fs');
const path = require('path');
const { md, parse, label, section } = require('./write_editorial_pages');
const { draftPreviewPath } = require('../quality/content_ops_common');

const PREVIEW_ROOT = 'admin/drafts';

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function readJson(rel, fallback) {
  const p = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

const STYLE = `:root{color-scheme:light;background:#f7f1e8;color:#1d1a16;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}
body{margin:0}.shell{max-width:820px;margin:0 auto;padding:28px 20px 64px}.wide{max-width:1180px}
.card{background:#fffaf1;border:1px solid #e4d7c5;border-radius:16px;padding:20px 22px;margin:16px 0}
.eyebrow{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#7a6a55;margin:0 0 6px}
h1{font-size:clamp(1.6rem,3.4vw,2.4rem);line-height:1.2;margin:0 0 10px}
h2{font-size:1.25rem;margin:1.8em 0 .5em}h3{font-size:1.05rem;margin:1.5em 0 .4em}
.muted{color:#6d5f4c}.small{font-size:.86rem}
a{color:#7a4b18}
.banner{background:#fdf3d8;border:1px solid #e3c98a;border-radius:14px;padding:14px 18px;margin:0 0 18px}
.pill{display:inline-block;background:#efe3d1;border-radius:999px;padding:2px 10px;font-size:.78rem;margin-right:6px}
article p{margin:0 0 1em}article ul{margin:0 0 1em 1.2em}
code{background:#f0e6d6;border-radius:5px;padding:1px 5px;font-size:.88em;word-break:break-all}
table{border-collapse:collapse;width:100%;font-size:.9rem}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e8dcc9;vertical-align:top}
th{position:sticky;top:0;background:#fffaf1;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:#7a6a55}
input,select{font:inherit;padding:8px 10px;border:1px solid #d9c9b1;border-radius:9px;background:#fff}
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:0 0 14px}
.dead-link{border-bottom:1px dotted #b4553a;color:#8a3f2a}
.table-scroll{overflow-x:auto}`;

/**
 * The preview is on a public host, so the noindex directive is the thing keeping
 * unapproved client work out of a search index. It is emitted here rather than
 * inherited, and verified against built output by test/draft-previews.test.js.
 * No rel=canonical: an unpublished draft has no canonical URL to name, and the
 * public-page canonical contract deliberately does not apply to /admin/.
 */
function shell(title, body, { wide = false, description = '' } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex,nofollow">
<meta name="googlebot" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<style>${STYLE}</style>
</head>
<body><main class="shell${wide ? ' wide' : ''}">${body}</main></body>
</html>`;
}

/**
 * A draft can link to a page that does not exist yet. Left as a live anchor
 * those become broken internal links in dist, which validate_internal_links
 * fails on - correctly. Neutralising them keeps that check meaningful and shows
 * the reviewer exactly which references do not resolve yet, which is review
 * signal rather than noise.
 */
function resolveDraftLinks(html, distDir) {
  const missing = [];
  const out = html.replace(/<a href="(\/[^"#]*)">([\s\S]*?)<\/a>/g, (whole, href, text) => {
    const rel = href.replace(/^\//, '');
    const asDir = path.join(distDir, rel, 'index.html');
    const asFile = path.join(distDir, rel);
    if (fs.existsSync(asDir) || (fs.existsSync(asFile) && fs.statSync(asFile).isFile())) return whole;
    missing.push(href);
    return `<span class="dead-link" title="Not published yet: ${esc(href)}">${text}</span> <span class="muted small">(target not published: <code>${esc(href)}</code>)</span>`;
  });
  return { html: out, missing };
}

function metaLine(entry) {
  const bits = [
    entry.date,
    label(entry.content_type),
    String(entry.source_cluster || 'general').replace(/-/g, ' '),
    `status: ${entry.status || entry.review_status || 'pending'}`,
    entry.generation_validation && entry.generation_validation.word_count ? `${entry.generation_validation.word_count} words` : null
  ].filter(Boolean);
  return bits.map((b) => `<span class="pill">${esc(b)}</span>`).join('');
}

function previewPage(entry, bodyHtml, missing, previewPath, repoUrl) {
  const editUrl = entry.github_path && repoUrl ? `${repoUrl}/edit/main/${entry.github_path}` : '';
  const readUrl = entry.github_path && repoUrl ? `${repoUrl}/blob/main/${entry.github_path}` : '';
  const missingNote = missing.length
    ? `<p class="muted small">${missing.length} internal reference${missing.length === 1 ? '' : 's'} in this draft point${missing.length === 1 ? 's' : ''} at a page that is not published yet. They are marked inline.</p>`
    : '';
  const willPublishAt = `/${section(entry.content_type)}/${esc(entry.date || '')}/`;
  const body = `
<p class="small"><a href="/admin/drafts/">&larr; All queued drafts</a> · <a href="/admin/">Admin</a></p>
<div class="banner">
  <p class="eyebrow">Unapproved draft · preview only</p>
  <p style="margin:0">This draft is <strong>not published</strong> and is not on the live site. Nothing on this page approves or publishes anything. Publishing stays manual and owner-authorised.</p>
</div>
<header>
  <h1>${esc(entry.title)}</h1>
  <p>${metaLine(entry)}</p>
  ${entry.source_query_title ? `<p class="muted">Answers the question: ${esc(entry.source_query_title)}</p>` : ''}
</header>
<div class="card">
  <p class="eyebrow">Review actions</p>
  <p class="small" style="margin:0 0 8px">${readUrl ? `<a href="${esc(readUrl)}" rel="noopener">Read the source markdown</a> · ` : ''}${editUrl ? `<a href="${esc(editUrl)}" rel="noopener">Edit this draft on GitHub</a>` : ''}</p>
  <p class="small muted" style="margin:0">If approved, this would publish at <code>${willPublishAt}${esc(String(entry.slug || '').replace(/^\/drafts\/\d{4}-\d{2}-\d{2}\//, ''))}</code>. Approval is a separate, deliberate step run by the owner: <code>node scripts/admin/approve_one.js ${esc(entry.entry_id)}</code></p>
</div>
${missingNote}
<article>${bodyHtml}</article>
<p class="small"><a href="/admin/drafts/">&larr; All queued drafts</a></p>
<p class="muted small">General educational information for the horse world. This is draft material under review and is not legal advice.</p>`;
  // validate_meta_uniqueness requires a description on every rendered index.html,
  // including operator surfaces. It states what the page is and nothing more:
  // no claim is made about the draft's content that the draft has not made.
  const description = `Unpublished draft under owner review: ${entry.title}${entry.source_query_title ? ` - written against the question "${entry.source_query_title}"` : ''}. Preview only; not on the live site.`;
  return { html: shell(`${entry.title} · draft preview`, body, { description }), previewPath };
}

function indexPage(rows, counts) {
  const clusters = [...new Set(rows.map((r) => r.cluster).filter(Boolean))].sort();
  const statuses = [...new Set(rows.map((r) => r.status).filter(Boolean))].sort();
  const body = `
<p class="small"><a href="/admin/">&larr; Admin</a></p>
<header>
  <p class="eyebrow">Owner review · manual publishing only</p>
  <h1>Queued drafts</h1>
  <p class="muted">Every draft waiting for review, rendered as a readable page. Opening or reading a draft changes nothing: none of these are published, and nothing here approves or publishes anything.</p>
  <p><strong>${counts.total}</strong> draft${counts.total === 1 ? '' : 's'} in the queue${Object.entries(counts.byStatus).map(([k, v]) => ` · ${esc(k)}: ${v}`).join('')}</p>
</header>
<div class="card">
  <div class="controls">
    <div><label class="small muted" for="q">Search title or question</label><br><input id="q" type="search" placeholder="e.g. bill of sale" style="min-width:260px"></div>
    <div><label class="small muted" for="cluster">Cluster</label><br><select id="cluster"><option value="">All clusters</option>${clusters.map((c) => `<option value="${esc(c)}">${esc(c.replace(/-/g, ' '))}</option>`).join('')}</select></div>
    <div><label class="small muted" for="status">Status</label><br><select id="status"><option value="">All statuses</option>${statuses.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></div>
    <div class="small muted" id="shown"></div>
  </div>
  <div class="table-scroll">
  <table id="drafts">
    <thead><tr><th>Title</th><th>Cluster</th><th>Type</th><th>Date</th><th>Status</th><th>Read</th></tr></thead>
    <tbody>
${rows.map((r) => `      <tr data-hay="${esc(`${r.title} ${r.question} ${r.cluster}`.toLowerCase())}" data-cluster="${esc(r.cluster)}" data-status="${esc(r.status)}"><td><strong>${esc(r.title)}</strong>${r.question ? `<div class="muted small">${esc(r.question)}</div>` : ''}</td><td>${esc(r.cluster.replace(/-/g, ' '))}</td><td>${esc(r.type)}</td><td>${esc(r.date)}</td><td><span class="pill">${esc(r.status)}</span></td><td><a href="${esc(r.href)}">Read draft</a></td></tr>`).join('\n')}
    </tbody>
  </table>
  </div>
</div>
<script>
(function(){
  var rows=[].slice.call(document.querySelectorAll('#drafts tbody tr'));
  var q=document.getElementById('q'),c=document.getElementById('cluster'),s=document.getElementById('status'),shown=document.getElementById('shown');
  function apply(){
    var term=(q.value||'').toLowerCase().trim(),cl=c.value,st=s.value,n=0;
    rows.forEach(function(row){
      var hit=(!term||row.getAttribute('data-hay').indexOf(term)>-1)&&(!cl||row.getAttribute('data-cluster')===cl)&&(!st||row.getAttribute('data-status')===st);
      row.style.display=hit?'':'none';if(hit)n++;
    });
    shown.textContent=n+' of '+rows.length+' shown';
  }
  q.addEventListener('input',apply);c.addEventListener('change',apply);s.addEventListener('change',apply);apply();
})();
</script>`;
  return shell('Queued drafts · owner review', body, { wide: true, description: `Owner review index for ${counts.total} unpublished draft(s) awaiting manual approval. Nothing listed here is on the live site.` });
}

function writeDraftPreviews(distDir) {
  const backlog = readJson('data/system/editorial_backlog.json', null);
  if (!Array.isArray(backlog)) {
    throw new Error('write_draft_previews: data/system/editorial_backlog.json is missing or is not an array. Refusing to write an empty draft review surface.');
  }
  const config = readJson('data/system/config.json', {});
  const repoUrl = String(config.github_repo_url || '').replace(/\/$/, '');

  const rows = [];
  const skipped = [];
  for (const entry of backlog) {
    const previewPath = draftPreviewPath(entry);
    const sourcePath = entry.github_path ? path.resolve(process.cwd(), entry.github_path) : '';
    if (!previewPath || !sourcePath || !fs.existsSync(sourcePath)) {
      skipped.push({ entry_id: entry.entry_id || null, reason: !previewPath ? 'no draft slug' : 'source markdown missing' });
      continue;
    }
    const raw = fs.readFileSync(sourcePath, 'utf8');
    const rendered = resolveDraftLinks(md(parse(raw)), distDir);
    const page = previewPage(entry, rendered.html, rendered.missing, previewPath, repoUrl);
    const outDir = path.join(distDir, previewPath.replace(/^\//, '').replace(/\/$/, ''));
    ensureDir(outDir);
    fs.writeFileSync(path.join(outDir, 'index.html'), page.html);
    rows.push({
      title: entry.title || entry.entry_id || '',
      question: entry.source_query_title || '',
      cluster: entry.source_cluster || 'general',
      type: label(entry.content_type),
      date: entry.date || '',
      status: entry.status || entry.review_status || 'pending',
      href: previewPath
    });
  }

  if (backlog.length && !rows.length) {
    throw new Error(`write_draft_previews: backlog holds ${backlog.length} entries but no preview could be rendered. Refusing to publish an empty review index.`);
  }

  const counts = {
    total: rows.length,
    byStatus: rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {})
  };
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.title.localeCompare(b.title));
  ensureDir(path.join(distDir, PREVIEW_ROOT));
  fs.writeFileSync(path.join(distDir, PREVIEW_ROOT, 'index.html'), indexPage(rows, counts));

  console.log(`Draft previews written: ${rows.length} readable draft page(s) at /admin/drafts/${skipped.length ? `; ${skipped.length} entry/entries skipped (${[...new Set(skipped.map((s) => s.reason))].join(', ')})` : ''}.`);
  return { rendered: rows.length, skipped };
}

module.exports = { writeDraftPreviews, PREVIEW_ROOT };

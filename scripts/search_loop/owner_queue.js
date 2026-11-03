'use strict';
/**
 * The owners' approval queue for work that is not an editorial draft:
 *   sl:<slug>      a question page from the shared search-loop engine
 *                  (approval mode: it waits in data/search-loop/pending/ and the
 *                  engine copies it into the site on its next run once approved)
 *   change:<id>    a site-wide change coded behind data/site_changes/queue.json
 *
 * Both appear as rows in /admin/ next to the drafts and use the same
 * Approve / Revoke buttons and decision issue; approve_many.js and
 * reject_many.js hand these ids here.
 */
const fs = require('fs');
const path = require('path');
const { QUEUE: CHANGES } = require('../lib/site_changes');

const LEDGER = 'data/search-loop';
const PAGES = `${LEDGER}/pages.json`;
const APPROVALS = `${LEDGER}/approvals.json`;
const PENDING = `${LEDGER}/pending`;

const read = (rel, fallback) => { const f = path.join(process.cwd(), rel); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback; };
const write = (rel, data) => { const f = path.join(process.cwd(), rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n'); };
const ownsId = (id) => /^(sl|change):/.test(String(id));

function approvals() {
  const a = read(APPROVALS, {});
  return { approved: Array.isArray(a.approved) ? a.approved : [], declined: Array.isArray(a.declined) ? a.declined : [] };
}
const slugOf = (x) => (typeof x === 'string' ? x : x && x.slug);

function engineDraft(slug) { return read(`${LEDGER}/drafts/${slug}.json`, {}); }

/** Rows for /admin/: queued engine pages, engine pages live before approval mode, pending site changes. */
function queueItems() {
  const a = approvals();
  const decided = new Set([...a.approved, ...a.declined].map(slugOf));
  const pages = (read(PAGES, { pages: [] }).pages || []);
  const items = [];
  for (const p of pages) {
    const waiting = p.status === 'pending_approval' || (p.status === 'live' && !p.approved_at);
    if (!waiting || decided.has(p.slug)) continue;
    const d = engineDraft(p.slug);
    const wasLive = p.status === 'live';
    items.push({
      entry_id: `sl:${p.slug}`,
      title: d.h1 || p.query,
      content_type: 'search_question',
      status: 'pending',
      review_status: 'pending',
      date: p.queued_at || p.published_at || '',
      source_cluster: 'search-engine',
      source_query_title: p.query,
      excerpt: (wasLive ? 'Already live since ' + p.published_at + ' (published before owner approval was switched on). Approve keeps it; Revoke takes it off the site. ' : 'Not live. Approve puts it on the site the next morning; Revoke drops it. ') + (d.direct_answer || ''),
      word_count: 0,
      hard_fails: [],
      preview_url: wasLive ? p.route : `/admin/search-loop/${p.slug}/`,
      public_url: wasLive ? p.url : '',
    });
  }
  for (const c of read(CHANGES, { changes: [] }).changes || []) {
    if (c.status !== 'pending') continue;
    items.push({
      entry_id: `change:${c.id}`,
      title: c.title,
      content_type: 'site_change',
      status: 'pending',
      review_status: 'pending',
      date: c.queued_at || '',
      source_cluster: 'site-wide change',
      excerpt: c.summary,
      word_count: 0,
      hard_fails: [],
      preview_url: `/admin/site-changes/${c.id}/`,
      public_url: '',
    });
  }
  return items;
}

/** Apply an owner decision to sl:/change: ids. Returns the ids it did not own. */
function decide(ids, action) {
  const mine = ids.filter(ownsId);
  const rest = ids.filter((id) => !ownsId(id));
  if (!mine.length) return { rest, done: [], skipped: [] };
  const a = approvals();
  const book = read(PAGES, { pages: [] });
  const changes = read(CHANGES, { changes: [] });
  const today = new Date().toISOString().slice(0, 10);
  const done = []; const skipped = [];
  for (const id of mine) {
    const [kind, key] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
    if (kind === 'change') {
      const c = (changes.changes || []).find((x) => x.id === key);
      if (!c) { skipped.push({ id, reasons: ['unknown change'] }); continue; }
      c.status = action === 'approve' ? 'approved' : 'declined';
      c.decided_at = today;
      done.push(id);
      continue;
    }
    const p = (book.pages || []).find((x) => x.slug === key);
    if (!p) { skipped.push({ id, reasons: ['unknown search-loop page'] }); continue; }
    a.approved = a.approved.filter((x) => slugOf(x) !== key);
    a.declined = a.declined.filter((x) => slugOf(x) !== key);
    if (action === 'approve') {
      a.approved.push({ slug: key, at: today });
      if (p.status === 'live') p.approved_at = today;
    } else {
      a.declined.push({ slug: key, at: today });
      if (p.status === 'live') {
        // A live page the owners revoke comes off the site.
        fs.rmSync(path.join(process.cwd(), path.dirname(p.rel)), { recursive: true, force: true });
        p.status = 'removed'; p.removed_at = today; p.removed_reason = 'owner revoked';
      }
    }
    done.push(id);
  }
  write(APPROVALS, a);
  write(PAGES, book);
  write(CHANGES, changes);
  return { rest, done, skipped };
}

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Admin-only previews: queued engine pages as they will look, and each pending change's before/after. */
function writePreviews(dist) {
  for (const p of (read(PAGES, { pages: [] }).pages || []).filter((x) => x.status === 'pending_approval')) {
    const src = path.join(process.cwd(), PENDING, p.rel);
    if (!fs.existsSync(src)) continue;
    const dir = path.join(dist, 'admin', 'search-loop', p.slug);
    fs.mkdirSync(dir, { recursive: true });
    const html = fs.readFileSync(src, 'utf8').replace(/<head>/i, '<head><meta name="robots" content="noindex, nofollow">');
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
  for (const c of (read(CHANGES, { changes: [] }).changes || []).filter((x) => x.status === 'pending')) {
    const dir = path.join(dist, 'admin', 'site-changes', c.id);
    fs.mkdirSync(dir, { recursive: true });
    const rows = (c.before_after || []).map((r) => `<tr><td>${esc(r.what)}</td><td>${esc(r.before)}</td><td>${esc(r.after)}</td></tr>`).join('');
    fs.writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta name="description" content="${esc(String(c.summary || c.title).slice(0, 155))}"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(c.title)} — waiting for your approval</title><style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;line-height:1.5}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;vertical-align:top;text-align:left}</style></head><body><p><a href="/admin/">Back to your queue</a></p><h1>${esc(c.title)}</h1><p>${esc(c.summary)}</p><p><strong>Pages affected:</strong> ${esc(c.pages_affected)}</p><table><tr><th>What</th><th>Now</th><th>After you approve</th></tr>${rows}</table><p>Nothing changes on the site until you approve this row in your queue.</p></body></html>`);
  }
}

module.exports = { queueItems, decide, writePreviews, ownsId, APPROVALS, PENDING };

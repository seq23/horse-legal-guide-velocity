#!/usr/bin/env node
// entity_backlink_watch - weekly check that data/entities/entity.json is still
// true on the live web. Run by .github/workflows/entity-backlink-watch.yml.
//
// For every sameAs URL:
//   - fetch it (GET, browser UA, redirects followed). 2xx = resolves.
//   - link-back: where the platform renders server-side (plain sites, Facebook,
//     Pinterest, YouTube, GitHub) the page must contain the site host. Where it
//     renders in JS (Instagram, X, Gumroad, Google Maps, LinkedIn) the state is
//     the named state `unverifiable`, never a pass.
// Self-heal (writes entity.json; the workflow rebuilds, validates and commits):
//   - dead sameAs (404/410 or the host does not resolve, on every retry) is
//     removed, with a note in removed_same_as;
//   - a profiles_pending entry that now resolves is promoted into sameAs.
//     profiles_awaiting_client_approval is NEVER promoted: on a client site that
//     changes the client's public data and needs their written yes.
// Missing link-back is a named stop naming the exact place to edit.
//
// Rule 0: zero sameAs URLs fails red. Exit 0 otherwise, named stops included.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ENTITY_PATH = 'data/entities/entity.json';
export const REPORT_PATH = 'reports/entity/entity_backlink_watch.json';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const JS_RENDERED = [/(^|\.)instagram\.com$/, /(^|\.)x\.com$/, /(^|\.)twitter\.com$/, /(^|\.)gumroad\.com$/, /(^|\.)linkedin\.com$/, /(^|\.)tiktok\.com$/, /^maps\.google\./, /(^|\.)g\.page$/, /^maps\.app\.goo\.gl$/];

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}
export function isJsRendered(url) {
  const host = hostOf(url);
  if (/^google\.[a-z.]+$/.test(host) && /\/maps/.test(url)) return true;
  return JS_RENDERED.some((re) => re.test(host));
}

// Where a missing link-back gets fixed, phrased for the person holding the login.
export function linkBackFix(url, siteHost) {
  const host = hostOf(url);
  if (/facebook\.com$/.test(host)) return `Facebook Page > Edit Page info > Website: add https://${siteHost}`;
  if (/pinterest\./.test(host)) return `Pinterest profile > Edit profile > Website: https://${siteHost}`;
  if (/youtube\.com$/.test(host)) return `YouTube Studio > Customisation > Basic info > Links: add https://${siteHost}`;
  if (/github\.com$/.test(host)) return `GitHub profile/org settings > URL: https://${siteHost}`;
  return `Add a visible link to https://${siteHost} on ${url} (footer or resources page) - only the owner of ${host} can edit it.`;
}

// One fetch with retries. Returns {status, ok, dead, body, error}.
export async function probe(url, { fetchImpl = fetch, attempts = 3, delayMs = 2000 } = {}) {
  let last = { status: 0, ok: false, dead: false, body: '', error: 'not attempted' };
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetchImpl(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(20000) });
      const body = res.ok ? await res.text() : '';
      last = { status: res.status, ok: res.ok, dead: res.status === 404 || res.status === 410, body, error: null };
      if (res.ok || last.dead) return last;
    } catch (e) {
      const code = e && (e.cause && e.cause.code || e.code);
      last = { status: 0, ok: false, dead: code === 'ENOTFOUND', body: '', error: String(code || e.message) };
    }
    if (i < attempts - 1 && delayMs) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
  }
  return last;
}

// The whole watch, pure apart from the injected fetch. Returns {entity, report}.
export async function runWatch(entity, { fetchImpl = fetch, delayMs = 2000, now = new Date() } = {}) {
  const siteHost = String(entity.site_host || '').toLowerCase();
  if (!siteHost) throw new Error('entity.json has no site_host');
  const sameAs = Array.isArray(entity.sameAs) ? entity.sameAs : [];
  if (!sameAs.length) throw new Error('RULE_0: entity.json sameAs is empty - the watch has nothing to examine.');
  const rows = [];
  const keep = [];
  const removed = [];
  const namedStops = [];
  for (const url of sameAs) {
    const r = await probe(url, { fetchImpl, delayMs });
    let linkBack;
    if (!r.ok) linkBack = 'not_checked';
    else if (isJsRendered(url)) linkBack = 'unverifiable';
    else linkBack = r.body.toLowerCase().includes(siteHost) ? 'present' : 'missing';
    const state = r.ok ? 'resolves' : r.dead ? 'dead' : 'unreachable';
    rows.push({ url, state, http_status: r.status, error: r.error, link_back: linkBack });
    if (state === 'dead') {
      removed.push({ url, removed_on: now.toISOString().slice(0, 10), reason: `HTTP ${r.status || r.error} on every attempt` });
      continue;
    }
    keep.push(url);
    if (state === 'unreachable') namedStops.push(`NAMED_STOP: SAME_AS_UNREACHABLE ${url} (${r.status || r.error}) - kept; removed only if it returns 404/410 or stops resolving.`);
    if (linkBack === 'missing') namedStops.push(`NAMED_STOP: LINK_BACK_MISSING ${url} does not link to ${siteHost}. Fix: ${linkBackFix(url, siteHost)}`);
  }
  const promoted = [];
  const stillPending = [];
  for (const entry of entity.profiles_pending || []) {
    const url = typeof entry === 'string' ? entry : entry && entry.url;
    if (!url) continue;
    const r = await probe(url, { fetchImpl, delayMs });
    rows.push({ url, state: r.ok ? 'pending_now_resolves' : 'pending_not_resolving', http_status: r.status, error: r.error, link_back: 'not_checked' });
    if (r.ok && !keep.includes(url)) { promoted.push(url); keep.push(url); } else stillPending.push(entry);
  }
  for (const entry of entity.profiles_awaiting_client_approval || []) {
    namedStops.push(`NAMED_STOP: SAME_AS_AWAITING_CLIENT_APPROVAL ${entry.url} - real (${entry.evidence}); added to sameAs only on the client's written approval.`);
  }
  const next = { ...entity, sameAs: keep, profiles_pending: stillPending };
  if (removed.length) next.removed_same_as = [...(entity.removed_same_as || []), ...removed];
  const changed = removed.length > 0 || promoted.length > 0;
  if (!keep.length) namedStops.push('NAMED_STOP: SAME_AS_NOW_EMPTY - every sameAs URL is dead; the publisher has no off-site identity until a real profile is added.');
  const report = {
    generated_at: now.toISOString(),
    site_host: siteHost,
    checked: rows.length,
    rows,
    removed: removed.map((r) => r.url),
    promoted,
    changed,
    named_stops: namedStops,
  };
  return { entity: next, report };
}

async function main() {
  const root = process.cwd();
  const entity = JSON.parse(fs.readFileSync(path.join(root, ENTITY_PATH), 'utf8'));
  const { entity: next, report } = await runWatch(entity);
  fs.mkdirSync(path.dirname(path.join(root, REPORT_PATH)), { recursive: true });
  fs.writeFileSync(path.join(root, REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`);
  if (report.changed) fs.writeFileSync(path.join(root, ENTITY_PATH), `${JSON.stringify(next, null, 2)}\n`);
  for (const row of report.rows) console.log(`${row.state.padEnd(22)} link_back=${row.link_back.padEnd(12)} ${row.url}`);
  if (report.removed.length) console.log(`SELF_HEAL: removed dead sameAs: ${report.removed.join(', ')}`);
  if (report.promoted.length) console.log(`SELF_HEAL: promoted pending profiles: ${report.promoted.join(', ')}`);
  for (const stop of report.named_stops) console.log(stop);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [`## Entity backlink watch (${report.checked} URLs)`, '', ...report.rows.map((r) => `- ${r.state} / link-back ${r.link_back}: ${r.url}`), '', ...report.named_stops.map((s) => `- ${s}`), ''].join('\n'));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { console.error(`ENTITY_BACKLINK_WATCH_FAILED: ${e.message}`); process.exit(1); });
}

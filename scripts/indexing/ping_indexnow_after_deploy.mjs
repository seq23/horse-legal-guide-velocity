#!/usr/bin/env node
// Post-deploy IndexNow ping (validate.yml, job indexnow-after-deploy, pushes to main).
//
// 1. Waits for the "Cloudflare Pages" check run on this commit to finish green,
//    so search engines are told about the URLs only once they serve the new build.
// 2. Confirms https://<site>/<key>.txt is live with the key from indexnow.txt.
// 3. Reads the live /sitemap.xml (following its child sitemaps) and POSTs every
//    URL to https://api.indexnow.org/indexnow with keyLocation /<key>.txt.
//
// Exits non-zero on a failed deploy, a missing key file, an empty sitemap or a
// rejected submission. A 429 from IndexNow is a provider rate limit: printed as
// NAMED_STOP: INDEXNOW_RATE_LIMITED and exits 0 (BLOCKED, not a defect).
// --dry-run skips the deploy wait and the POST (local proof of steps 2-3).
import fs from 'node:fs';

const DRY = process.argv.includes('--dry-run');
const site = (process.env.SITE_DOMAIN || 'https://horselegalguide.com').replace(/\/$/, '');
const key = fs.readFileSync('indexnow.txt', 'utf8').trim();
const keyLocation = `${site}/${key}.txt`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const summary = (line) => { console.log(line); if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`); };

async function waitForPagesDeploy() {
  const { GITHUB_REPOSITORY: repo, GITHUB_SHA: sha, GITHUB_TOKEN: token } = process.env;
  if (!repo || !sha || !token) throw new Error('GITHUB_REPOSITORY, GITHUB_SHA and GITHUB_TOKEN are required to wait for the Cloudflare Pages deploy.');
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs?check_name=${encodeURIComponent('Cloudflare Pages')}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } });
    if (res.ok) {
      const run = (await res.json()).check_runs?.[0];
      if (run?.status === 'completed') {
        if (run.conclusion !== 'success') throw new Error(`Cloudflare Pages deploy for ${sha} concluded ${run.conclusion}; not pinging IndexNow.`);
        return;
      }
    }
    await sleep(20000);
  }
  throw new Error(`Cloudflare Pages deploy for ${sha} did not finish within 15 minutes.`);
}

async function liveText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  return { status: res.status, body: res.ok ? await res.text() : '' };
}

async function sitemapUrls() {
  const index = await liveText(`${site}/sitemap.xml`);
  if (index.status !== 200) throw new Error(`${site}/sitemap.xml returned ${index.status}.`);
  const children = [...index.body.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const docs = children.length ? await Promise.all(children.map(async (c) => { const r = await liveText(c); if (r.status !== 200) throw new Error(`${c} returned ${r.status}.`); return r.body; })) : [index.body];
  return [...new Set(docs.flatMap((d) => [...d.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1])))];
}

async function main() {
  if (!DRY) await waitForPagesDeploy();
  let keyFile;
  for (let i = 0; i < 6; i += 1) { keyFile = await liveText(keyLocation); if (keyFile.status === 200 && keyFile.body.trim() === key) break; await sleep(10000); }
  if (keyFile.status !== 200 || keyFile.body.trim() !== key) throw new Error(`${keyLocation} returned ${keyFile.status} without the key; IndexNow would reject the ping.`);
  const urls = await sitemapUrls();
  if (!urls.length) throw new Error('Live sitemap lists zero URLs; nothing to submit.');
  const payload = { host: new URL(site).host, key, keyLocation, urlList: urls.slice(0, 10000) };
  if (DRY) { summary(`DRY RUN: key file live (${keyLocation}); would submit ${payload.urlList.length} sitemap URLs to https://api.indexnow.org/indexnow.`); return; }
  let res;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    res = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload) });
    if (res.status < 500) break;
    await sleep(15000 * attempt);
  }
  if (res.status === 429) { summary(`NAMED_STOP: INDEXNOW_RATE_LIMITED - api.indexnow.org returned 429 for ${payload.urlList.length} URLs; the next push to main resubmits.`); return; }
  if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow rejected the submission: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  summary(`IndexNow: HTTP ${res.status}, submitted ${payload.urlList.length} sitemap URLs (keyLocation ${keyLocation}).`);
}

main().catch((err) => { console.error(`ERROR: ${err.message}`); process.exit(1); });

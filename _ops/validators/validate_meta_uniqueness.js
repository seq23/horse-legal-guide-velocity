// validate:meta-uniqueness - titles, meta descriptions and canonicals on every
// rendered public page, checked the way Bing Webmaster checks them.
//
// This gate used to check presence only and left uniqueness to the dashboard.
// Bing (25 Sep 2026) then reported rule 118 (description too short) and rule
// 114 (title too short) on the homepage, /hubs/ and others, and a crawl found
// 114 short descriptions, 23 short titles, one template sentence as the whole
// description of 87 pages, and 78 title pairs between /reference/<q>/ and the
// page it maps to, both self-canonical. Each of those now fails here:
//   - title under 30 characters, description outside 110-160
//   - two self-canonical indexable pages sharing a title or a description
//   - a sitemap URL whose page names a different canonical
//   - a /reference/ surface that is self-canonical (it copies its mapped page)
//   - /therapeutic (Bing W404) with no 301 to a page that exists
const fs = require('fs');
const path = require('path');

const TITLE_MIN = 30;
const DESC_MIN = 110;
const DESC_MAX = 160;
const SITE = 'https://horselegalguide.com';
const MAX_LISTED = 15;

function fail(m) { console.error('META_UNIQUENESS_FAIL: ' + m); process.exitCode = 1; }
function decode(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function norm(u) { return String(u || '').replace(/\/$/, ''); }
function listed(items) {
  return items.slice(0, MAX_LISTED).join('\n  ') + (items.length > MAX_LISTED ? `\n  ... and ${items.length - MAX_LISTED} more` : '');
}

const dist = path.resolve(process.cwd(), 'dist');
let checked = 0;
let missing = 0;
const shortTitle = [];
const badDesc = [];
const byTitle = new Map();
const byDesc = new Map();
const canonicalOf = new Map();
const selfCanonicalReference = [];

if (fs.existsSync(dist)) {
  for (const f of fs.readdirSync(dist, { recursive: true }).map(String).filter((f) => f.endsWith('index.html'))) {
    const rel = '/' + f.replace(/\\/g, '/').replace(/index\.html$/, '');
    const html = fs.readFileSync(path.join(dist, f), 'utf8');
    checked++;
    const t = html.match(/<title>([^<]+)<\/title>/);
    const d = html.match(/<meta name="description" content="([^"]+)">/);
    if (!t || !d) { missing++; continue; }
    // Operator surfaces and noindex pages are not in any crawl invitation.
    if (/^\/(admin|agency)\//.test(rel) || /<meta name="robots" content="[^"]*noindex/i.test(html)) continue;
    const title = decode(t[1]).trim();
    const desc = decode(d[1]).trim();
    const c = html.match(/<link rel="canonical" href="([^"]+)"/i);
    const canonical = c ? c[1] : '';
    const own = SITE + (rel === '/' ? '' : rel);
    canonicalOf.set(norm(own), norm(canonical));
    if (title.length < TITLE_MIN) shortTitle.push(`${rel} (${title.length}) "${title}"`);
    if (desc.length < DESC_MIN || desc.length > DESC_MAX) badDesc.push(`${rel} (${desc.length}) "${desc}"`);
    const selfCanonical = !canonical || norm(canonical) === norm(own);
    if (rel.startsWith('/reference/') && rel !== '/reference/' && selfCanonical) selfCanonicalReference.push(rel);
    if (!selfCanonical) continue;
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title).push(rel);
    if (!byDesc.has(desc)) byDesc.set(desc, []);
    byDesc.get(desc).push(rel);
  }
}

if (checked === 0) {
  fail('GATE_EXAMINED_NOTHING: validate:meta-uniqueness examined 0 rendered pages. dist/ was absent or empty, so "no page is missing a title" was true of nothing. Run npm run build first.');
} else {
  if (missing > 0) fail(`${missing} rendered pages missing title or meta description`);
  if (canonicalOf.size === 0) fail('GATE_EXAMINED_NOTHING: every rendered page was skipped as operator or noindex; no public page was checked.');
  if (shortTitle.length) fail(`${shortTitle.length} titles under ${TITLE_MIN} characters (Bing rule 114):\n  ${listed(shortTitle)}`);
  if (badDesc.length) fail(`${badDesc.length} meta descriptions outside ${DESC_MIN}-${DESC_MAX} characters (Bing rule 118):\n  ${listed(badDesc)}`);
  const dupTitles = [...byTitle.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `"${k}" x${v.length}: ${v.slice(0, 3).join(', ')}`);
  if (dupTitles.length) fail(`${dupTitles.length} titles shared by self-canonical pages:\n  ${listed(dupTitles)}`);
  const dupDescs = [...byDesc.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `"${k.slice(0, 80)}..." x${v.length}: ${v.slice(0, 3).join(', ')}`);
  if (dupDescs.length) fail(`${dupDescs.length} meta descriptions shared by self-canonical pages:\n  ${listed(dupDescs)}`);
  if (selfCanonicalReference.length) fail(`${selfCanonicalReference.length} /reference/ surfaces are self-canonical; each copies its mapped page's answer and must canonical to it:\n  ${listed(selfCanonicalReference)}`);

  const sitemapFile = path.join(dist, 'sitemap-pages.xml');
  const locs = fs.existsSync(sitemapFile) ? [...fs.readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]) : [];
  if (!locs.length) fail('GATE_EXAMINED_NOTHING: dist/sitemap-pages.xml has no <loc> entries.');
  const notSelf = locs.filter((loc) => canonicalOf.has(norm(loc)) && canonicalOf.get(norm(loc)) && canonicalOf.get(norm(loc)) !== norm(loc));
  if (notSelf.length) fail(`${notSelf.length} sitemap URLs name a different canonical:\n  ${listed(notSelf)}`);

  const redirectsFile = path.join(dist, '_redirects');
  const rules = fs.existsSync(redirectsFile)
    ? fs.readFileSync(redirectsFile, 'utf8').split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 3 && p[0].startsWith('/'))
    : [];
  const therapeutic = rules.find((p) => p[0] === '/therapeutic');
  if (!therapeutic || therapeutic[2] !== '301') {
    fail('/therapeutic (Bing W404) has no 301 in dist/_redirects; scripts/build/write_section_redirects.js should point it at its topic hub.');
  } else if (!fs.existsSync(path.join(dist, therapeutic[1].replace(/^\//, ''), 'index.html')) || therapeutic[1] === '/') {
    fail(`/therapeutic redirects to ${therapeutic[1]}, which is not a built topic page.`);
  }
}
if (!process.exitCode) console.log(`Meta OK (${checked} rendered pages, ${canonicalOf.size} public pages: titles >= ${TITLE_MIN}, descriptions ${DESC_MIN}-${DESC_MAX}, unique among ${[...byTitle.values()].reduce((n, v) => n + v.length, 0)} self-canonical pages; sitemap self-canonical; /therapeutic redirected)`);

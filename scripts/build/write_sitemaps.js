const fs = require('fs');
const path = require('path');

// Operator surfaces, not published answers: the owner admin cockpit, the
// private agency dashboard, and the /admin/drafts/ previews of unapproved
// drafts. None of them belong in a sitemap, an indexnow batch, or any other
// crawl invitation.
//
// These were previously excluded only by build ordering - writeSitemaps happens
// to run before the admin surfaces are written - which is invisible and one
// reordering away from advertising unapproved client content for indexing.
// Naming them makes the exclusion explicit and independent of call order. The
// emitted URL set is unchanged.
const OPERATOR_DIRS = new Set(['admin', 'agency']);

function collectHtmlUrls(baseDir, root = '') {
  const urls = [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);
    const relPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (root === '' && OPERATOR_DIRS.has(entry.name)) continue;
      urls.push(...collectHtmlUrls(fullPath, relPath));
    } else if (entry.isFile() && entry.name === 'index.html') {
      let urlPath = '/' + root.replace(/\\/g, '/');
      urlPath = urlPath.endsWith('/') ? urlPath : urlPath + '/';
      if (urlPath === '//') urlPath = '/';
      urls.push(urlPath);
    }
  }
  return urls.sort();
}

function writeIndexNowArtifacts(distDir, canonicalDomain, urls) {
  const absolute = urls.map((url) => `${canonicalDomain}${url === '/' ? '' : url}`);
  const priority = absolute.filter((url) => /\/$/.test(url) && (url.endsWith('/') || url.includes('/coverage/') || url.includes('/faq/') || url.includes('/scenario/') || url.includes('/compare/') || url.includes('/hubs/')));
  fs.writeFileSync(path.join(distDir, 'indexnow-priority.txt'), Array.from(new Set(priority)).join('\n') + '\n');
  fs.writeFileSync(path.join(distDir, 'indexnow-batch.txt'), absolute.join('\n') + '\n');
}

// <lastmod> is metadata about the sitemap entry, not page content: emitting it
// changes nothing on any published page. It was absent on all 560 URLs - on the
// live sitemap as much as the built one - which data/cadence/policy.json treats
// as a blocking no_freshness_signal and which leaves a crawler no way to tell
// what changed.
//
// The date is keyed on a hash of the rendered page rather than read from git at
// build time. `git log -1` reports the tip commit for every file in a depth-1
// checkout, so reading git directly would stamp one uniform date across all 560
// URLs - the date-bump pattern scripts/cadence_gate.js exists to flag. The
// ledger consults git only to seed a URL it has never seen, and only when the
// clone actually has the history. See scripts/lib/lastmod_ledger.js.
const ledgerLib = require('../lib/lastmod_ledger');

function resolveLastmods(distDir, canonicalDomain, urls) {
  const today = ledgerLib.buildDate();
  const ledger = ledgerLib.load();
  const pages = {};
  for (const url of urls) {
    const rendered = path.join(distDir, url === '/' ? '' : url, 'index.html');
    if (!fs.existsSync(rendered)) continue;
    // dist/ is tracked in this repo, so the rendered file carries real history
    // and is the honest thing to seed a first sighting from.
    const rel = path.relative(process.cwd(), rendered).split(path.sep).join('/');
    pages[`${canonicalDomain}${url === '/' ? '' : url}`] = {
      hash: ledgerLib.contentHash(fs.readFileSync(rendered)),
      file: rel
    };
  }
  const lastmods = ledgerLib.resolve(pages, ledger, today);
  ledgerLib.save(ledgerLib.rebuilt(pages, ledger, today, { prune: true }));
  return lastmods;
}

function writeSitemaps(distDir, canonicalDomain) {
  const urls = collectHtmlUrls(distDir);
  const lastmods = resolveLastmods(distDir, canonicalDomain, urls);
  const pageEntries = urls.map((url) => {
    const loc = `${canonicalDomain}${url === '/' ? '' : url}`;
    const lm = lastmods[loc];
    // No date is invented for a URL the ledger could not resolve.
    return lm ? `<url><loc>${loc}</loc><lastmod>${lm}</lastmod></url>` : `<url><loc>${loc}</loc></url>`;
  }).join('');
  const pagesXml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pageEntries}</urlset>`;
  fs.writeFileSync(path.join(distDir, 'sitemap-pages.xml'), pagesXml);
  const indexXml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${canonicalDomain}/sitemap-pages.xml</loc></sitemap></sitemapindex>`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), indexXml);
  writeIndexNowArtifacts(distDir, canonicalDomain, urls);
  return urls;
}

module.exports = { writeSitemaps };

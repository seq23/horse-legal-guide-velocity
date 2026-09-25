const fs = require('fs');
const path = require('path');

// Approved pages live under section folders (/therapeutic/<q>/, /boarding/<q>/)
// that have no page of their own, so /therapeutic answered 404 and Bing kept it
// as a W404 (25 Sep 2026). When every approved page in such a folder belongs to
// one topic cluster, that cluster's hub is the page about the same thing, and
// the folder root 301s to it. A folder that mixes clusters (/leases/) has no
// single matching page and stays a 404, which is correct. Nothing is ever sent
// to the homepage.
const BEGIN = '# BEGIN SECTION ROOT REDIRECTS (scripts/build/write_section_redirects.js)';
const END = '# END SECTION ROOT REDIRECTS';

function sectionRootRedirects(distDir, approvedPages, clusters) {
  const hubByCluster = new Map((clusters || []).map((c) => [c.cluster, c.slug]));
  const bySection = new Map();
  for (const page of approvedPages || []) {
    const section = String(page.slug || '').split('/').filter(Boolean)[0];
    if (!section || String(page.slug).split('/').filter(Boolean).length < 2) continue;
    if (!bySection.has(section)) bySection.set(section, new Set());
    bySection.get(section).add(page.cluster);
  }
  const rules = [];
  for (const [section, clusterSet] of [...bySection.entries()].sort()) {
    if (fs.existsSync(path.join(distDir, section, 'index.html'))) continue;
    if (clusterSet.size !== 1) continue;
    const hub = hubByCluster.get([...clusterSet][0]);
    if (!hub || !fs.existsSync(path.join(distDir, hub.replace(/^\//, ''), 'index.html'))) continue;
    rules.push({ from: `/${section}`, to: hub });
    rules.push({ from: `/${section}/`, to: hub });
  }
  return rules;
}

function writeSectionRedirects(distDir, approvedPages, clusters) {
  const rules = sectionRootRedirects(distDir, approvedPages, clusters);
  const file = path.join(distDir, '_redirects');
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const stripped = existing.replace(new RegExp(`\\n?${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END}\\n?`, 'g'), '\n').trimEnd();
  const block = rules.length ? `\n\n${BEGIN}\n${rules.map((r) => `${r.from} ${r.to} 301`).join('\n')}\n${END}\n` : '\n';
  fs.writeFileSync(file, `${stripped}${block}`);
  return rules;
}

module.exports = { writeSectionRedirects, sectionRootRedirects };

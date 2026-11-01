'use strict';
/**
 * The shared search-loop engine reads the site's pages from source HTML at
 * their real routes, but this site renders its pages into dist/ from JSON and
 * markdown. So before the engine runs (caller workflow setup_command), this
 * copies the built public pages from dist/<section>/ to <section>/ at the repo
 * root: the engine then skips searches an existing page already answers, links
 * new pages to real pages and runs its near-duplicate check against the whole
 * site. Every mirrored section is in search-loop.config.json protected_paths,
 * so the engine never edits a mirror page.
 *
 * The mirror is temporary: `--clean` removes exactly what was written (listed
 * in .search-loop-mirror.json) and runs before the site build and the commit.
 * A section that already exists in git is never mirrored over.
 *
 *   node scripts/search_loop/mirror_site.js          # after npm run build
 *   node scripts/search_loop/mirror_site.js --clean
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MANIFEST = '.search-loop-mirror.json';
const root = process.cwd();

function clean() {
  const file = path.join(root, MANIFEST);
  if (!fs.existsSync(file)) { console.log('search-loop mirror: nothing to clean'); return; }
  const { dirs = [] } = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const d of dirs) fs.rmSync(path.join(root, d), { recursive: true, force: true });
  fs.rmSync(file, { force: true });
  console.log(`search-loop mirror: removed ${dirs.length} mirrored section(s)`);
}

function mirror() {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'search-loop.config.json'), 'utf8'));
  const outDir = cfg.output.dir.replace(/\/$/, '');
  const sections = (cfg.related.scan_dirs || []).filter((d) => d !== outDir);
  const protectedSet = new Set(cfg.protected_paths || []);
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('NAMED STOP [SITE_NOT_BUILT] dist/index.html is missing; run npm run build before mirroring');
    process.exit(1);
  }
  const written = [];
  let pages = 0;
  for (const s of sections) {
    if (!protectedSet.has(s)) { console.error(`NAMED STOP [MIRROR_NOT_PROTECTED] section ${s} is scanned but not in protected_paths; the engine could edit a mirror copy`); process.exit(1); }
    if (!fs.existsSync(path.join(dist, s))) continue;
    if (fs.existsSync(path.join(root, s))) {
      const tracked = execFileSync('git', ['ls-files', '--', s], { cwd: root, encoding: 'utf8' }).trim();
      if (tracked) { console.error(`NAMED STOP [MIRROR_WOULD_OVERWRITE] ${s}/ is tracked in git; refusing to mirror over it`); process.exit(1); }
    }
    fs.cpSync(path.join(dist, s), path.join(root, s), { recursive: true, filter: (src) => fs.statSync(src).isDirectory() || src.endsWith('.html') });
    written.push(s);
    pages += countHtml(path.join(root, s));
  }
  fs.writeFileSync(path.join(root, MANIFEST), JSON.stringify({ dirs: written }, null, 2) + '\n');
  if (!pages) { console.error('NAMED STOP [MIRROR_EMPTY] no built page was mirrored'); process.exit(1); }
  console.log(`search-loop mirror: ${pages} page(s) in ${written.length} section(s)`);
}

function countHtml(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += countHtml(p); else if (e.name.endsWith('.html')) n++;
  }
  return n;
}

if (process.argv.includes('--clean')) clean(); else mirror();

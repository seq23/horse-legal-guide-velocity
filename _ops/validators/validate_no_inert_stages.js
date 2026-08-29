#!/usr/bin/env node
/**
 * Rule 0 guard: no stage may exit 0 having done nothing.
 *
 * Three inert-stage shapes were found in this repo and are fixed at source; this
 * validator is what stops each of them coming back.
 *
 *   1. A success-claiming stub. scripts/community/cluster_queries.js was one
 *      line - `console.log('Query clustering complete.')` - and so was
 *      scripts/community/extract_queries.js. Both printed the same sentence for
 *      every input, wrote nothing, and exited 0. Read from a log or a file
 *      listing they looked like implemented capability; run, they were a
 *      claim that work had finished when none had started.
 *
 *   2. A stage that cannot reach what it governs. scripts/sitemap_lastmod.js
 *      stamped <lastmod> onto sitemap URLs that had none, but its own directory
 *      walk excluded `dist`, and the only sitemap outside dist is an index with
 *      no <url> elements. It reported `stamped=0 across 0 sitemap(s)` and
 *      exited 0 on every run it could ever have. The work it named is really
 *      done by scripts/lib/lastmod_ledger.js through
 *      scripts/build/write_sitemaps.js, which is asserted below so the
 *      capability cannot be dropped along with the dead script.
 *
 *   3. A dangling npm alias. `sitemap:lastmod` pointed at that script. An alias
 *      pointing at a file that does not exist fails only when someone runs it,
 *      which for an orphan is never.
 *
 * Deliberately behavioural rather than textual: it reads what each entry point
 * would DO, and it hard-fails when it examined nothing, so an empty sweep can
 * never be mistaken for a clean one.
 *
 * Usage: node _ops/validators/validate_no_inert_stages.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
let failures = 0;
function fail(message) {
  console.error(`NO_INERT_STAGES_FAIL: ${message}`);
  failures += 1;
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Every npm alias must point at a file that exists.
// ---------------------------------------------------------------------------
const pkg = JSON.parse(read('package.json'));
const npmScripts = pkg.scripts || {};
let aliasesChecked = 0;
// `node _ops/validators/x.js`, `node --no-warnings scripts/y.mjs`,
// `python3 scripts/z.py`, `./distribution_scripts/w.sh`. Only paths that name a
// file in this repo - a bare `node -e "..."` has no target to resolve.
const TARGET = /(?:^|&&|\|\||;|\s)(?:\.\/)?(?:node|python3|bash|sh)\s+(?:--[\w-]+(?:=\S+)?\s+)*((?:\.\/)?[\w][\w./_-]*\.(?:js|mjs|cjs|py|sh))/g;
for (const [name, command] of Object.entries(npmScripts)) {
  for (const match of String(command).matchAll(TARGET)) {
    const target = match[1];
    aliasesChecked += 1;
    if (!fs.existsSync(path.join(ROOT, target))) {
      fail(`npm script "${name}" runs ${target}, which does not exist. A dangling alias fails only when someone runs it.`);
    }
  }
}
if (aliasesChecked === 0) fail('examined 0 npm script targets - the alias sweep matched nothing, which is a broken sweep, not a clean repo');

// ---------------------------------------------------------------------------
// 2. No executable entry point may be a success-claiming stub.
//
// A stub is a file whose every executable statement is a console.log / print
// and whose text claims work finished. Comments, blank lines, 'use strict' and
// shebangs do not count as work.
// ---------------------------------------------------------------------------
const CLAIM = /\b(complete|completed|done|finished|success|successful|ok)\b/i;
const SCAN_DIRS = ['scripts', '_ops', 'distribution_scripts'];
const SKIP_DIR = /^(node_modules|\.git|dist|\.build|fixtures|__pycache__)$/;
let entryPointsChecked = 0;

function executableLines(source, ext) {
  const lines = source.split('\n');
  const out = [];
  let inBlockComment = false;
  let inDocstring = false;
  for (const raw of lines) {
    let line = raw.trim();
    if (!line) continue;
    if (ext === '.py') {
      if (inDocstring) {
        if (/"""|'''/.test(line)) inDocstring = false;
        continue;
      }
      if (/^("""|''')/.test(line)) {
        // A one-line docstring opens and closes on the same line.
        if (!/^("""|''')[\s\S]*("""|''')\s*$/.test(line) || line.length <= 3) inDocstring = true;
        continue;
      }
      if (line.startsWith('#')) continue;
    } else {
      if (inBlockComment) {
        if (line.includes('*/')) {
          inBlockComment = false;
          line = line.slice(line.indexOf('*/') + 2).trim();
          if (!line) continue;
        } else continue;
      }
      if (line.startsWith('#!')) continue;
      if (line.startsWith('//')) continue;
      if (line.startsWith('/*')) {
        if (!line.includes('*/')) inBlockComment = true;
        continue;
      }
      if (/^['"]use strict['"];?$/.test(line)) continue;
    }
    out.push(line);
  }
  return out;
}

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIR.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!['.js', '.mjs', '.cjs', '.py', '.sh'].includes(ext)) continue;
    if (ext === '.sh') continue; // shell entry points are covered by their callers
    const rel = path.relative(ROOT, full);
    const source = fs.readFileSync(full, 'utf8');
    const body = executableLines(source, ext);
    if (!body.length) continue; // an empty file is not a stage claiming success
    entryPointsChecked += 1;
    const printers = body.filter((line) => /^(console\.(log|info)|print)\s*\(/.test(line));
    if (printers.length !== body.length) continue;
    if (printers.some((line) => CLAIM.test(line))) {
      fail(`${rel} does nothing but print a completion claim (${printers.length} statement(s), no other executable line). A stage that prints the same sentence for every input and writes nothing has not done work.`);
    }
  }
}
for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir));
if (entryPointsChecked === 0) fail('examined 0 script entry points - the stub sweep matched nothing, which is a broken sweep, not a clean repo');

// ---------------------------------------------------------------------------
// 3. The sitemap lastmod capability must still be served by the ledger.
//
// scripts/sitemap_lastmod.js was deleted because it could never reach a
// sitemap. Deleting it is only correct while the real implementation survives,
// so assert the real one behaviourally: write_sitemaps.js must resolve dates
// through the ledger, and the built sitemap must actually carry <lastmod> on
// every URL it emits.
// ---------------------------------------------------------------------------
if (fs.existsSync(path.join(ROOT, 'scripts/sitemap_lastmod.js'))) {
  fail('scripts/sitemap_lastmod.js is back. It excludes dist/ from its own walk, so it can never stamp a sitemap; lastmod is resolved by scripts/lib/lastmod_ledger.js.');
}
// Asserted as a resolvable require, not as a mention. The word
// "lastmod_ledger" also appears in that file's comments, so a text search would
// still pass after the require was pointed somewhere else - which is the
// prose-instead-of-behaviour trap this whole sweep exists to catch.
const writeSitemapsRel = 'scripts/build/write_sitemaps.js';
const writeSitemaps = read(writeSitemapsRel);
const requires = [...writeSitemaps.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
const ledgerRequire = requires.find((spec) => /(^|\/)lastmod_ledger$/.test(spec));
if (!ledgerRequire) {
  fail(`${writeSitemapsRel} no longer requires scripts/lib/lastmod_ledger - the freshness date would fall back to build time.`);
} else {
  const resolved = path.resolve(ROOT, 'scripts/build', ledgerRequire);
  if (!fs.existsSync(`${resolved}.js`) && !fs.existsSync(resolved)) {
    fail(`${writeSitemapsRel} requires "${ledgerRequire}", which does not resolve to a file.`);
  }
}
if (!/ledgerLib\.resolve\(/.test(writeSitemaps) || !/ledgerLib\.(rebuilt|save)\(/.test(writeSitemaps)) {
  fail(`${writeSitemapsRel} requires the ledger but no longer calls resolve() and rebuilt()/save() on it - the ledger would be loaded and ignored.`);
}
const sitemapRel = 'dist/sitemap-pages.xml';
if (!fs.existsSync(path.join(ROOT, sitemapRel))) {
  fail(`${sitemapRel} missing - run npm run build before this validator.`);
} else {
  const xml = read(sitemapRel);
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)];
  if (!urls.length) fail(`${sitemapRel} contains 0 <url> entries - nothing was examined`);
  const undated = urls.filter((m) => !/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(m[1])).length;
  if (undated) fail(`${sitemapRel} has ${undated} of ${urls.length} URLs with no <lastmod>. The ledger is not covering every page.`);
  const dates = new Set(urls.map((m) => (m[1].match(/<lastmod>(\d{4}-\d{2}-\d{2})/) || [])[1]).filter(Boolean));
  if (urls.length > 50 && dates.size === 1) {
    fail(`${sitemapRel} gives all ${urls.length} URLs the single date ${[...dates][0]}. That is the build-time date bump the ledger exists to prevent.`);
  }
}

// ---------------------------------------------------------------------------
// 4. No page gate may pass having examined nothing.
//
// The gates that walk dist/ were all written so that an absent or empty dist/
// produced an empty file list, an unexecuted loop body, and exit 0 - "passed"
// and "found nothing to check" were the same observable outcome, and none of
// them printed a count. Reproduced by moving dist/ aside: nineteen gates
// reported success against zero pages, publish-safety among them.
//
// collectRequired / assertExamined in _ops/validators/helpers.js now fail on
// zero and record what they saw to _ops/reports/gate-coverage.json. Both halves
// are asserted here: the static half stops a new gate reaching for the unguarded
// walker, and the live half reads the counts this very run produced. Every gate
// below runs earlier in the validate:all chain than this validator does.
// ---------------------------------------------------------------------------
const VALIDATOR_DIR = path.join(ROOT, '_ops/validators');
let gatesScanned = 0;
for (const name of fs.readdirSync(VALIDATOR_DIR)) {
  // helpers.js defines the unguarded walker; this file names it in its own
  // guard and message. Neither is a gate.
  if (!name.endsWith('.js') || name === 'helpers.js' || name === 'validate_no_inert_stages.js') continue;
  gatesScanned += 1;
  const src = fs.readFileSync(path.join(VALIDATOR_DIR, name), 'utf8');
  for (const call of src.matchAll(/collectFiles\(\s*['"]([^'"]+)['"]/g)) {
    fail(`_ops/validators/${name} calls collectFiles('${call[1]}', ...), which returns [] for a missing or empty directory and lets the gate pass having examined nothing. Use collectRequired(dir, matcher, label) instead.`);
  }
}
if (gatesScanned === 0) fail('examined 0 validator files - the collectFiles sweep matched nothing, which is a broken sweep');

const COVERAGE = '_ops/reports/gate-coverage.json';
// Every gate that must have been exercised by the time this validator runs.
const REQUIRED_COVERAGE = [
  'validate:content', 'validate:footer', 'validate:links', 'validate:manual',
  'validate:review', 'validate:above-fold', 'validate:extractability',
  'validate:public-page-phrase-contract', 'validate:content-pattern',
  'validate:family-scaffold', 'validate:compare-contract',
  'validate:scenario-contract', 'validate:faq-opening',
  // validate:drafts is guarded by collectRequired too, but it is not part of
  // validate:all, so it cannot be required to have recorded coverage here.
];
if (!fs.existsSync(path.join(ROOT, COVERAGE))) {
  fail(`${COVERAGE} missing. No page gate recorded what it examined, so none of them can be shown to have run. Run npm run validate:all.`);
} else {
  let coverage = {};
  try {
    coverage = (JSON.parse(read(COVERAGE)) || {}).gates || {};
  } catch (error) {
    fail(`${COVERAGE} is not valid JSON: ${error.message}`);
  }
  const recorded = Object.keys(coverage);
  if (!recorded.length) fail(`${COVERAGE} records 0 gates - nothing proved it examined anything`);
  for (const gate of REQUIRED_COVERAGE) {
    const row = coverage[gate];
    if (!row) {
      fail(`${COVERAGE} has no entry for ${gate}. Either the gate no longer records coverage, or it did not run in this validate:all.`);
    } else if (!(Number(row.count) > 0)) {
      fail(`${gate} recorded ${row.count} item(s) examined. A gate that examined nothing has not passed.`);
    }
  }
}

if (failures) {
  console.error(`No-inert-stages contract FAILED with ${failures} problem(s).`);
  process.exit(1);
}
console.log(`No inert stages: ${aliasesChecked} npm script target(s) resolve, ${entryPointsChecked} script entry point(s) carry real work, ${gatesScanned} validator(s) use the guarded file walker, ${REQUIRED_COVERAGE.length} page gate(s) recorded a non-zero examined count, sitemap lastmod served by the ledger.`);

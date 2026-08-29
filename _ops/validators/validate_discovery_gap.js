#!/usr/bin/env node
/**
 * Guard the three defects that were found in the discovery-gap scorer, so none
 * of them can return silently.
 *
 * (1) ORPHANED. scripts/queries/score_discovery_gap.mjs existed with no npm
 *     script and no workflow invoking it. It had been run by hand exactly once,
 *     so its output aged into fiction while looking live. This asserts that a
 *     caller still exists.
 *
 * (2) DESTRUCTIVE RE-RUN. data/signals/llm_citation_observations.json is a
 *     ROLLING record - the probe caps at 25 queries per run and only the newest
 *     grounded run is read. The scorer used to overwrite every row whose
 *     observation had rolled out of that window with UNMEASURED; replaying one
 *     real 25-observation run over the 62 scored rows wiped 37 readings. This
 *     asserts the carry-forward is still in the code and still reachable.
 *
 * (3) BLUE-OCEAN CONFLATION. "Not cited" is NOT "open ground". Openness was
 *     scored from whatever hosts the engine returned, with no check that those
 *     citations were about this query in this vertical. This asserts the
 *     additive blue_ocean_eligible gate is present on every scored row and is
 *     actually refusing the unanchored ones.
 *
 * Hard-fails if it examines zero rows. A validator that passes on an empty loop
 * is the same "exists but proves nothing" defect it is here to prevent.
 */
const fs = require('fs');

const problems = [];
const fail = (m) => problems.push(m);
const readText = (p) => { if (!fs.existsSync(p)) { fail(`missing ${p}`); return ''; } return fs.readFileSync(p, 'utf8'); };
const readJson = (p) => { try { return JSON.parse(readText(p)); } catch (e) { fail(`unreadable JSON: ${p} (${e.message})`); return null; } };

const SCRIPT = 'scripts/queries/score_discovery_gap.mjs';
const EVIDENCE = 'data/queries/evidence/evidence_queries.json';
const WORKFLOW = '.github/workflows/agency-search-monitor.yml';

const src = readText(SCRIPT);
const pkg = readJson('package.json') || { scripts: {} };
const wf = readText(WORKFLOW);
const doc = readJson(EVIDENCE);

// ------------------------------------------------------- (1) it has a caller
const scripts = pkg.scripts || {};
const npmEntry = Object.entries(scripts).find(([, v]) => String(v).includes('score_discovery_gap.mjs'));
if (!npmEntry) fail(`${SCRIPT} has no npm script invoking it - orphaned generator, its output ages into fiction while looking live.`);
const npmName = npmEntry ? npmEntry[0] : null;

const invokedByWorkflow = npmName
  ? new RegExp(`npm run ${npmName}\\b`).test(wf) || wf.includes('score_discovery_gap.mjs')
  : wf.includes('score_discovery_gap.mjs');
if (!invokedByWorkflow) fail(`no scheduled workflow invokes the discovery-gap scorer (looked in ${WORKFLOW}). A generator only a human ever runs is an orphan.`);

// It must run in the same lane as the probe that produces its input, or it will
// score a window it never saw.
if (invokedByWorkflow && !wf.includes('llm_citation_probe.mjs')) {
  fail(`the discovery-gap scorer runs in ${WORKFLOW} but the citation probe that produces its observations does not - it would score a stale window.`);
}

// Its own guard must be registered, or this file is itself an orphan.
if (!Object.values(scripts).some((v) => String(v).includes('validate_discovery_gap.js'))) {
  fail('validate_discovery_gap.js has no npm script - an unregistered validator is the same defect it is hunting.');
}
if (!String(scripts['validate:all'] || '').includes('validate:discovery-gap')) {
  fail('validate:discovery-gap is not part of validate:all, so nothing runs this guard on a normal validation pass.');
}

// -------------------------------------- (2) the rolling window cannot destroy
if (!/stale_reason/.test(src) || !/stale:\s*true/.test(src)) {
  fail(`${SCRIPT} no longer carries an aged reading forward as stale. A row whose observation rolled out of the 25-query window would be overwritten with UNMEASURED, destroying the only openness reading this repo has.`);
}
if (!/occupancyFor\(row\.query,\s*observationsByQuery,\s*row\.occupancy\)/.test(src)) {
  fail(`${SCRIPT} calls occupancyFor without passing the row's prior occupancy, so there is nothing to carry forward and the destructive overwrite is back.`);
}

// ------------------------------------------------ (3) the blue-ocean gate
if (!/blue_ocean_eligible/.test(src) || !/BRAND_OR_PERSON_NAME_NAVIGATIONAL/.test(src) || !/NO_SERVICE_OR_LOCATION_ANCHOR/.test(src)) {
  fail(`${SCRIPT} has lost the blue-ocean gate. Openness would again be scored from whatever hosts the engine returned, with no check that those citations describe this query's ground - "not cited" read as "open ground".`);
}

// ------------------------------------------------------- the data, not the code
const rows = (doc && Array.isArray(doc.queries)) ? doc.queries : [];
if (!rows.length) {
  fail(`${EVIDENCE} holds zero queries - this validator examined nothing and must not pass on an empty loop.`);
}

let scoredRows = 0;
let gated = 0;
let refused = 0;
for (const row of rows) {
  const q = row && row.query;
  if (!row.occupancy) { fail(`row has no occupancy reading: ${q}`); continue; }
  scoredRows++;
  // An openness_score with no verdict, or a verdict of UNMEASURED carrying a
  // score, would mean the two disagree about whether anything was measured.
  const hasScore = row.occupancy.openness_score !== null && row.occupancy.openness_score !== undefined;
  if (row.occupancy.verdict === 'UNMEASURED' && hasScore) {
    fail(`UNMEASURED row carries an openness_score, which reads as a zero: ${q}`);
  }
  // A carried-forward reading must say so, or a stale number is indistinguishable
  // from a fresh one.
  if (row.occupancy.stale === true && !row.occupancy.stale_reason) {
    fail(`row is marked stale with no stale_reason: ${q}`);
  }
  if (!row.blue_ocean_eligible || typeof row.blue_ocean_eligible.eligible !== 'boolean') {
    fail(`row carries an openness reading with no blue_ocean_eligible gate, so nothing distinguishes open ground from an unanchored citation set: ${q}`);
    continue;
  }
  gated++;
  if (!row.blue_ocean_eligible.eligible) refused++;
  if (!row.blue_ocean_eligible.reason) fail(`blue_ocean_eligible with no reason: ${q}`);
}

if (scoredRows === 0) fail('examined zero scored rows - refusing to pass on an empty loop.');
if (gated !== scoredRows) fail(`${scoredRows - gated} of ${scoredRows} scored rows are not gated.`);

// The gate must actually be doing work. If it refuses nothing on a corpus that
// demonstrably contains unanchored queries, it has been widened into a no-op.
const ANCHOR = /\b(horses?|equine|equestrian|stables?|barns?|boarding|riding|riders?|farriers?|vet|veterinary|usef|ushja|fei|pony|ponies|foals?|mares?|stallions?|geldings?|breeding|dressage|eventing|jumper|showing|racing)\b/;
const LOC = /\b(near me|wellington|ocala|aiken|lexington|florida|fl|kentucky|ky|north carolina|nc|south carolina|sc|virginia|va|texas|tx|california|ca|local|in my state|by state)\b/;
const unanchored = rows.filter((r) => {
  const q = String(r.query || '').toLowerCase();
  return q && !ANCHOR.test(q) && !LOC.test(q);
});
if (unanchored.length && refused === 0) {
  fail(`${unanchored.length} queries carry no equine or location anchor (e.g. "${unanchored[0].query}") yet the blue-ocean gate refused none of them - the gate has been widened into a no-op.`);
}
for (const r of unanchored) {
  if (r.blue_ocean_eligible && r.blue_ocean_eligible.eligible) {
    fail(`unanchored query passed the blue-ocean gate: "${r.query}". The engine has nothing to anchor retrieval to, so its citation set does not describe this property's ground.`);
  }
}

// ------------------------------------------------------------------- verdict
if (problems.length) {
  console.error('Discovery-gap contract FAILED:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`Discovery-gap contract OK: ${scoredRows} scored rows, all gated; ${refused} refused as unanchored or navigational; carry-forward and blue-ocean gate present; scorer invoked by "npm run ${npmName}" from ${WORKFLOW}.`);

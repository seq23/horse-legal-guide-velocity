#!/usr/bin/env node
'use strict';
/**
 * Guards the repair loop in _ops/selfheal/heal_until_clean.js.
 *
 * The loop was written, was correct, and repaired real breakage when tested -
 * and nothing invoked it. A repair lane no scheduler reaches is indistinguishable
 * from one that does not exist, so this validator asserts three things:
 *
 *   1. reachability - a scheduled workflow actually runs `npm run selfheal`;
 *   2. pairing integrity - every declared repair names a real npm script, and
 *      every step it claims to repair is really a step of validate:all;
 *   3. honest reporting - the loop's report names its outcome instead of
 *      going quiet, and a report that says CLEAN carries no unresolved steps.
 *
 * It hard-fails when it finds zero declared repairs, so gutting the REPAIRS map
 * cannot turn this check into a green empty loop.
 */
const fs = require('fs');
const path = require('path');

let failures = 0;
function fail(message) {
  console.error(`SELF_HEAL_LOOP_FAIL: ${message}`);
  failures += 1;
}

const ROOT = process.cwd();
const read = (rel) => {
  const file = path.resolve(ROOT, rel);
  if (!fs.existsSync(file)) { fail(`${rel} missing`); return ''; }
  return fs.readFileSync(file, 'utf8');
};

const LOOP = '_ops/selfheal/heal_until_clean.js';
const WORKFLOW = '.github/workflows/self-heal-loop.yml';
const REPORT = '_ops/reports/self-heal-loop.json';

const loopSource = read(LOOP);
const workflow = read(WORKFLOW);
const pkg = JSON.parse(read('package.json') || '{}');
const scripts = pkg.scripts || {};

// 1. Reachability.
if (!scripts.selfheal || !scripts.selfheal.includes('heal_until_clean.js')) {
  fail('package.json has no `selfheal` script pointing at heal_until_clean.js');
}
if (workflow) {
  if (!/\bschedule:/.test(workflow)) fail(`${WORKFLOW} has no schedule - the loop would only ever run when a human remembers it`);
  if (!/cron:/.test(workflow)) fail(`${WORKFLOW} declares a schedule with no cron entry`);
  if (!/npm run selfheal\b/.test(workflow)) fail(`${WORKFLOW} does not invoke \`npm run selfheal\``);
  if (!/workflow_dispatch:/.test(workflow)) fail(`${WORKFLOW} cannot be dispatched by hand`);
  // The loop only earns its keep if its repairs survive the run.
  if (!/git (commit|push)/.test(workflow)) fail(`${WORKFLOW} never commits, so any repair it makes is discarded with the runner`);
  if (!/--allow-content/.test(workflow) && !/content-affecting/.test(workflow)) {
    // Not a failure: running without --allow-content is the safe default for a
    // client repo whose drafts need human approval. Recorded so the omission is
    // visible rather than accidental.
    console.log('Self-heal loop runs in non-content mode (drafts are left to the approval lane).');
  }
}

// 2. Pairing integrity.
const declared = [...loopSource.matchAll(/'(validate:[a-z0-9:_-]+)':\s*\{\s*command:\s*'([^']+)'/g)]
  .map(([, step, command]) => ({ step, command }));
if (!declared.length) {
  fail('no declared step->repair pairs found in the loop - an empty REPAIRS map is a loop that can never repair anything');
}
// Mirrors the loop's own aggregate expansion. validate:content-ops is a chain of
// six checks; before the loop expanded aggregates, a repair declared for one of
// those inner checks could never fire, because validate:all only ever named the
// aggregate. This resolves the same way so the check reflects what the loop sees.
const expand = (script, seen = new Set()) => {
  const body = scripts[script];
  if (!body || seen.has(script)) return [script];
  const parts = body.split('&&').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2 || !parts.every((p) => /^npm (run [\w:@._-]+|test)$/.test(p))) return [script];
  const next = new Set(seen).add(script);
  return parts.flatMap((p) => expand(p === 'npm test' ? 'npm test' : p.replace(/^npm run /, ''), next));
};
const validateAllSteps = new Set(
  String(scripts['validate:all'] || '')
    .split('&&')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => (s === 'npm test' ? ['npm test'] : expand(s.replace(/^npm run /, ''))))
);
if (!validateAllSteps.size) fail('validate:all resolved to zero steps - nothing to pair repairs against');

// The loop must resolve aggregates the same way, or inner-step repairs go inert.
if (loopSource && !/const expand = /.test(loopSource)) {
  fail('the loop no longer expands aggregate npm scripts - a repair declared for a check nested inside validate:content-ops can never fire');
}
for (const { step, command } of declared) {
  if (!validateAllSteps.has(step)) {
    fail(`declared repair targets \`${step}\`, which is not a step of validate:all - it can never fire`);
  }
  const scriptName = command.replace(/^npm run /, '').trim();
  if (command.startsWith('npm run ') && !scripts[scriptName]) {
    fail(`declared repair for ${step} runs \`${command}\`, but no such npm script exists`);
  }
}

// 3. Honest reporting.
const reportFile = path.resolve(ROOT, REPORT);
if (fs.existsSync(reportFile)) {
  let report;
  try { report = JSON.parse(fs.readFileSync(reportFile, 'utf8')); } catch (error) {
    fail(`${REPORT} is not valid JSON: ${error.message}`);
  }
  if (report) {
    if (!['CLEAN', 'UNRESOLVED'].includes(report.status)) {
      fail(`${REPORT} status must name its outcome as CLEAN or UNRESOLVED, got ${JSON.stringify(report.status)}`);
    }
    if (report.status === 'CLEAN' && (report.unresolved || []).length) {
      fail(`${REPORT} claims CLEAN while listing ${report.unresolved.length} unresolved step(s)`);
    }
    if (report.status === 'UNRESOLVED' && !(report.unresolved || []).length) {
      fail(`${REPORT} claims UNRESOLVED but names no step - a failure with no name is not a report`);
    }
    if (!Number.isInteger(report.steps_checked) || report.steps_checked < 1) {
      fail(`${REPORT} records steps_checked=${report.steps_checked}; a run that checked nothing must not be recorded as a run`);
    }
  }
}

// The loop must never end silently.
if (loopSource && !/nothing repairable, stopping/.test(loopSource)) {
  fail('the loop no longer names the "nothing repairable" outcome - a silent stop is indistinguishable from a repair');
}

if (failures) {
  process.exitCode = 1;
} else {
  console.log(`Self-heal loop contract OK (${declared.length} declared step->repair pairs, all reachable from validate:all; scheduled lane commits its repairs).`);
}

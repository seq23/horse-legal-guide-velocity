#!/usr/bin/env node
'use strict';
/**
 * Run validation, repair what is repairable, re-validate, and loop until the
 * tree is clean or the attempt budget runs out.
 *
 * validate:all is a 43-step && chain, so it stops at the first failure and one
 * broken step hides the rest. This runs the same steps in collect-all mode so a
 * single pass attributes every failure, then runs only the repairs that are
 * declared for the steps that actually failed.
 *
 * The pairing rule is narrow on purpose: a repair is declared only when it
 * writes the artifact the check reads. A command that merely sounds related
 * gets left out - running it would produce motion without fixing the defect and
 * make the loop look like it had tried something.
 *
 * Publishing safety: this repo's content:self-heal rewrites DRAFTS and leaves
 * approval to a human through /admin. No repair here touches published work or
 * the publishing cadence. --allow-content is still required before any
 * content-affecting repair runs, so the default mode cannot alter a draft
 * unattended.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const REPORT = path.join(ROOT, '_ops/reports/self-heal-loop.json');

// step -> repair. Only where the repair writes what the check reads.
const REPAIRS = {
  'validate:generated-surfaces': { command: 'npm run build', content: false,
    why: 'The check reads dist/; build is what writes it. A stale or missing surface is regenerated, not hand-patched.' },
  'validate:page-manifests': { command: 'npm run build', content: false,
    why: 'Manifests are emitted by the build; the validator reads the emitted files.' },
  // These five read rendered pages under dist/, which the build is the only
  // writer of. They were unpaired only because a corrupt dist could never reach
  // them: `build` used to run as the first step of the detection pass and
  // repaired the tree before they looked at it. With detection made read-only
  // they see the break, and the pairing rule applies to them exactly as it does
  // to generated-surfaces above - the repair writes what the check reads.
  //
  // Measured, not assumed: dist/index.html was replaced with
  // `<html>faux corruption</html>`; these are the five steps that failed, and
  // `npm run build` on its own returned all five to PASS. A break in the SOURCE
  // rather than in dist is not repaired by a rebuild, the re-validation fails
  // again, and the loop reports UNRESOLVED - which is the correct outcome, since
  // no published word may be rewritten here.
  'validate:content': { command: 'npm run build', content: false,
    why: 'Reads rendered pages under dist/; the build is their only writer.' },
  'validate:public-page-phrase-contract': { command: 'npm run build', content: false,
    why: 'Reads rendered public pages under dist/; the build is their only writer.' },
  'validate:footer': { command: 'npm run build', content: false,
    why: 'Reads footer links in rendered dist/ pages; the build is their only writer.' },
  'validate:public-surfaces': { command: 'npm run build', content: false,
    why: 'Reads rendered public surfaces under dist/; the build is their only writer.' },
  'validate:meta-uniqueness': { command: 'npm run build', content: false,
    why: 'Reads titles and meta descriptions from rendered dist/ pages; the build is their only writer.' },
  'validate:ingestion': { command: 'npm run normalize:signals', content: false,
    why: 'normalize_signals.js is the only writer of the normalized signal file this check reads.' },
  'validate:query-intelligence': { command: 'npm run query:rebuild', content: false,
    why: 'build_provider_query_intelligence.js produces the intelligence artifact the check validates.' },
  'validate:remediation-workflow': { command: 'npm run search:prepare-repairs', content: false,
    why: 'prepare_query_repairs.js writes the repair proposals this check reads.' },
  'validate:publish_quality': { command: 'npm run content:self-heal', content: true,
    why: 'run_self_heal.js differentiates substantially similar DRAFTS, which is the defect this check reports. Approval stays manual.' },
  'validate:self-heal-report': { command: 'npm run content:self-heal', content: true,
    why: 'The report this check validates is written by the self-heal run itself.' },
};

// Deliberately unpaired, recorded so the omissions are auditable rather than
// forgotten: validate:mode / validate:review / validate:manual / validate:
// automation-mode describe operator state - repairing them would mean asserting
// a mode nobody selected. validate:workflow-trace, validate:agency-monitoring,
// validate:live-query-loop and validate:external-provider-truth measure
// externally observed reality; generating their inputs would be fabrication.
// The remaining content contracts (answer-shape, above-fold, extractability,
// editorial, faq-opening, compare/scenario contracts) need words written, and
// this repo's published content is frozen by agreement.

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// validate:all contains aggregate scripts - validate:content-ops is itself a
// chain of six checks. Without expanding them, a failure inside an aggregate is
// only ever attributed to the aggregate, and a repair declared for the inner
// check can never fire: the loop looks up 'validate:content-ops', finds no
// declared repair, and stops. That made the content:self-heal pairing inert by
// construction. Expanding one aggregate into its parts restores attribution to
// the step whose artifact the repair actually writes.
const expand = (script, seen = new Set()) => {
  const body = pkg.scripts[script];
  if (!body || seen.has(script)) return [script];
  const parts = body.split('&&').map((s) => s.trim()).filter(Boolean);
  // Only expand a pure chain of npm scripts; anything else is a real command
  // and stays a single step.
  if (parts.length < 2 || !parts.every((p) => /^npm (run [\w:@._-]+|test)$/.test(p))) return [script];
  const next = new Set(seen).add(script);
  return parts.flatMap((p) => expand(p === 'npm test' ? 'npm test' : p.replace(/^npm run /, ''), next));
};

// validate:all opens with `npm run build`, and carries `atlas:coverage` further
// in. Neither is a check. They are generators: they rewrite the artifacts the
// validators are about to read, and they exit 0 whatever the tree looked like
// beforehand, so they can never appear in `failed`.
//
// Running them inside the DETECTION pass is the whole bug. The first thing the
// loop did was regenerate every build-owned artifact, which silently repaired
// the tree before a single validator could see the break. Reproduced by
// corrupting dist/index.html and running `npm run selfheal`: "attempt 0 - 0
// failing step(s)", status CLEAN, attempts [] - and dist/index.html rewritten
// anyway. The repair happened; nothing recorded that it had.
//
// That is worse than a missed repair, because of how the workflow commits.
// .github/workflows/self-heal-loop.yml gates its commit on the report's
// attempts[].actions[].ran, and on an empty list it runs `git checkout -- .`.
// So the lane would repair a genuinely corrupt committed artifact, report that
// nothing needed repairing, and then throw the repair away - every scheduled
// run, forever, with the corruption still on main.
//
// Both stay available as DECLARED repairs in REPAIRS above, which is the shape
// that works: the validator fails, the loop runs the generator, re-validates,
// and records ran:true so the workflow commits what it fixed. Detection reads;
// repair writes.
const GENERATORS = new Set(['build', 'atlas:coverage']);

const allSteps = [...new Set(
  pkg.scripts['validate:all'].split('&&')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => (s === 'npm test' ? ['npm test'] : expand(s.replace(/^npm run /, ''))))
)];

// A step that is neither a check nor a known generator is a mutation nobody has
// classified, and letting it into detection is how this bug came back. Fail
// loudly rather than guess.
const unclassified = allSteps.filter((s) => s !== 'npm test' && !s.startsWith('validate:') && !GENERATORS.has(s));
if (unclassified.length) {
  console.error(`self-heal: validate:all contains unclassified step(s): ${unclassified.join(', ')}.`);
  console.error('Add each to GENERATORS in this file if it writes artifacts, or rename it validate:* if it only checks.');
  console.error('Refusing to run: an unclassified mutation inside the detection pass repairs the tree before anything can see the break.');
  process.exit(1);
}

const steps = allSteps.filter((s) => !GENERATORS.has(s));

if (!steps.length) {
  console.error('self-heal: validate:all resolved to zero steps - refusing to report a clean tree it never checked.');
  process.exit(1);
}
console.log(`self-heal: detecting with ${steps.length} read-only step(s); ${allSteps.length - steps.length} generator(s) held back for the repair phase.`);

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const ALLOW_CONTENT = args.has('--allow-content');
const MAX = Number((process.argv.find((a) => a.startsWith('--max=')) || '--max=3').split('=')[1]);

const run = (script) => {
  const cmd = script === 'npm test' ? ['test'] : ['run', script];
  const r = spawnSync('npm', [...cmd, '--silent'], { cwd: ROOT, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}` };
};

const validateAll = () => {
  const failed = [];
  for (const step of steps) {
    const { code } = run(step);
    if (code !== 0) failed.push(step);
  }
  return failed;
};

const attempts = [];
let failed = validateAll();
console.log(`self-heal: attempt 0 - ${failed.length} failing step(s)${failed.length ? `: ${failed.join(', ')}` : ''}`);

for (let attempt = 1; attempt <= MAX && failed.length; attempt += 1) {
  const actions = [];
  for (const step of failed) {
    const repair = REPAIRS[step];
    if (!repair) { actions.push({ step, action: 'no declared repair', ran: false }); continue; }
    if (repair.content && !ALLOW_CONTENT) {
      actions.push({ step, action: repair.command, ran: false, skipped: 'content-affecting; pass --allow-content' });
      continue;
    }
    if (DRY) { actions.push({ step, action: repair.command, ran: false, skipped: 'dry-run' }); continue; }
    const r = spawnSync('sh', ['-c', repair.command], { cwd: ROOT, encoding: 'utf8' });
    actions.push({ step, action: repair.command, ran: true, repair_exit: r.status ?? 1, why: repair.why });
  }
  const ranAny = actions.some((a) => a.ran);
  attempts.push({ attempt, failed_before: failed, actions });
  if (!ranAny) { console.log(`self-heal: attempt ${attempt} - nothing repairable, stopping`); break; }
  failed = validateAll();
  console.log(`self-heal: attempt ${attempt} - ${failed.length} failing step(s)${failed.length ? `: ${failed.join(', ')}` : ''}`);
}

fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${JSON.stringify({
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  mode: DRY ? 'dry-run' : (ALLOW_CONTENT ? 'repair-with-content' : 'repair-non-content'),
  max_attempts: MAX,
  steps_checked: steps.length,
  status: failed.length ? 'UNRESOLVED' : 'CLEAN',
  unresolved: failed,
  attempts,
}, null, 2)}\n`);

console.log(`self-heal: ${failed.length ? `UNRESOLVED (${failed.join(', ')})` : 'CLEAN'} - report at ${path.relative(ROOT, REPORT)}`);
process.exit(failed.length ? 1 : 0);

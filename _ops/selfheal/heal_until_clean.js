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

const steps = [...new Set(
  pkg.scripts['validate:all'].split('&&')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => (s === 'npm test' ? ['npm test'] : expand(s.replace(/^npm run /, ''))))
)];

if (!steps.length) {
  console.error('self-heal: validate:all resolved to zero steps - refusing to report a clean tree it never checked.');
  process.exit(1);
}

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

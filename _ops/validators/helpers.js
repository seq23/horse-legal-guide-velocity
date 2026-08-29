const fs = require('fs');
const path = require('path');

function getMode() {
  const raw = String(process.env.VALIDATION_MODE || process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] || 'enforce').toLowerCase();
  return raw === 'audit' ? 'audit' : 'enforce';
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function ensureExists(relPath) {
  const filePath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) {
    fail(`Missing required path: ${relPath}`);
  }
  return filePath;
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(ensureExists(relPath), 'utf8'));
}

function collectFiles(dir, matcher) {
  const root = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(root)) return [];
  const results = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!matcher || matcher(full)) results.push(full);
    }
  }
  walk(root);
  return results;
}

/**
 * collectFiles, but a gate that found nothing to examine is a failure.
 *
 * collectFiles returns [] for a directory that does not exist, and every page
 * gate in this repo was written as `for (const file of collectFiles('dist',
 * ...)) { ...fail()... }` followed by `ok(...)`. With dist/ absent or empty the
 * loop body never executes and the gate exits 0. Reproduced by moving dist/
 * aside and running the suite: validate:content, validate:footer,
 * validate:links, validate:manual, validate:review, validate:above-fold,
 * validate:extractability, validate:public-page-phrase-contract,
 * validate:content-pattern, validate:meta-uniqueness, validate:publish-safety
 * and the family contracts all reported success against zero pages.
 *
 * Nothing was breaking today - validate:all runs `npm run build` as its first
 * step and dist/ is tracked, so the gates do see freshly built pages. But
 * "passed" and "found nothing to check" were the same observable outcome, and
 * no gate printed its count, so the day the two diverged nobody would have
 * seen it. A publish-safety gate that vacuously passes is the worst version of
 * this: validate_review_flow asserts no unapproved page is live, which is
 * trivially true of zero pages.
 *
 * This makes the count part of the contract: it is printed, it is recorded to
 * _ops/reports/gate-coverage.json, and zero is a named failure.
 */
function collectRequired(dir, matcher, label) {
  const files = collectFiles(dir, matcher);
  const name = label || dir;
  if (!files.length) {
    fail(`GATE_EXAMINED_NOTHING: ${name} found 0 files under ${dir}/. A gate that examines nothing has not passed - it has not run. dist/ is written by \`npm run build\`; run the build before the gates.`);
  }
  recordCoverage(name, dir, files.length);
  return files;
}

/**
 * The other half of the same defect, for gates that walk a target list rather
 * than a directory.
 *
 * The idiom is `for (const page of approvedTargets) { const file = ...; if
 * (!fs.existsSync(file)) continue; ... }`. Every approved page missing from
 * dist/ is skipped, so a dist that is empty, partial, or stale in exactly the
 * pages under test leaves the gate iterating and asserting nothing - and
 * reporting success. Reproduced by emptying dist/: validate:above-fold,
 * validate:extractability, validate:content-pattern, validate:meta-uniqueness,
 * validate:publish-safety and the family contracts all passed against zero
 * pages.
 *
 * Call this after the loop with the number of pages that were actually read.
 * Zero is a structural break rather than a content issue, so it fails in audit
 * mode too - a report saying "0 issues in 0 pages" is not an audit.
 */
function assertExamined(label, examined, ofTotal) {
  const n = Number(examined) || 0;
  if (n <= 0) {
    fail(`GATE_EXAMINED_NOTHING: ${label} examined 0${ofTotal === undefined ? '' : ` of ${ofTotal}`} page(s). Every candidate was skipped because its rendered file was absent, so this gate asserted nothing. dist/ is written by \`npm run build\`; run the build before the gates.`);
  }
  recordCoverage(label, 'dist', n);
  console.log(`GATE_COVERAGE: ${label} examined ${n}${ofTotal === undefined ? '' : ` of ${ofTotal}`} page(s).`);
  return n;
}

const COVERAGE_REPORT = '_ops/reports/gate-coverage.json';
function recordCoverage(label, dir, count) {
  try {
    const file = path.resolve(process.cwd(), COVERAGE_REPORT);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let doc = { schema_version: '1.0', note: 'How many files each page gate actually examined. Zero is a failure, not a pass; see collectRequired in _ops/validators/helpers.js.', gates: {} };
    if (fs.existsSync(file)) {
      try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* rebuild below */ }
    }
    if (!doc.gates || typeof doc.gates !== 'object') doc.gates = {};
    // No timestamp. dist/ is tracked here, so a per-run clock in this file would
    // churn every build - the same noise the self-heal lane was taught not to
    // commit. The count is the fact worth keeping, and it only moves when the
    // number of pages does.
    doc.gates[label] = { dir, count };
    const sorted = {};
    for (const key of Object.keys(doc.gates).sort()) sorted[key] = doc.gates[key];
    doc.gates = sorted;
    fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
  } catch {
    // Coverage bookkeeping must never be the reason a validator fails.
  }
}

function ok(message) {
  console.log(`OK: ${message}`);
  process.exit(0);
}

function createReport(validatorName, scope = 'repo') {
  const issues = [];
  const mode = getMode();
  function addIssue({ file = '', severity = 'error', code = 'validation_issue', message, fixHint = '', autofix = false, blocking = true }) {
    issues.push({ validator: validatorName, scope, file, severity, code, message, fixHint, autofix, blocking });
  }
  function finalize(successMessage) {
    const reportDir = path.resolve(process.cwd(), '_ops/reports');
    fs.mkdirSync(reportDir, { recursive: true });
    const payload = { validator: validatorName, scope, mode, issue_count: issues.length, issues };
    fs.writeFileSync(path.join(reportDir, `${validatorName}.json`), JSON.stringify(payload, null, 2));
    if (issues.length) {
      console.log(`AUDIT REPORT: ${validatorName} found ${issues.length} issue(s).`);
      for (const issue of issues) {
        console.log(`- [${issue.severity}] ${issue.file || '<repo>'}: ${issue.message}${issue.fixHint ? ` | Fix: ${issue.fixHint}` : ''}`);
      }
      if (mode === 'enforce' && issues.some((issue) => issue.blocking)) {
        process.exit(1);
      }
      process.exit(0);
    }
    console.log(`OK: ${successMessage}`);
    process.exit(0);
  }
  return { mode, addIssue, finalize };
}

module.exports = { fail, ensureExists, readJson, collectFiles, collectRequired, assertExamined, ok, getMode, createReport };

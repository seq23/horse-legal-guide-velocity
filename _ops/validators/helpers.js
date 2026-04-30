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

module.exports = { fail, ensureExists, readJson, collectFiles, ok, getMode, createReport };

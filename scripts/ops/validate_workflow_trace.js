const fs = require('fs');
const path = require('path');
const root = process.cwd();
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
function fail(msg) { console.error(`WORKFLOW_TRACE_FAIL: ${msg}`); process.exitCode = 1; }
const healthPath = path.join(root, 'data/admin/workflow_health.json');
if (!fs.existsSync(healthPath)) fail('data/admin/workflow_health.json missing. Run npm run ops:trace-workflows.');
else {
  const health = readJson('data/admin/workflow_health.json');
  if (!Array.isArray(health.workflows) || !health.workflows.length) fail('workflow health has no workflow traces');
  for (const w of health.workflows || []) {
    if (!w.workflow || !w.path || !w.proof_type) fail(`malformed trace row: ${JSON.stringify(w)}`);
    if (w.status !== 'passed') fail(`${w.workflow} trace did not pass: ${(w.hard_fails || []).join('; ')}`);
    if (w.live_github_actions_status !== 'not_executed_in_chatgpt_container') fail(`${w.workflow} has invalid live action truth boundary`);
    const traceFile = path.join(root, 'reports/workflow-trace', w.workflow.replace(/\.ya?ml$/, '.json'));
    if (!fs.existsSync(traceFile)) fail(`missing trace file for ${w.workflow}`);
  }
  if (!String(health.truth_boundary || '').includes('Live GitHub Actions')) fail('workflow health must state live GitHub Actions truth boundary');
}
for (const rel of ['data/admin/signal_ingestion_status.json', 'data/admin/signal_trace_summary.json']) {
  if (!fs.existsSync(path.join(root, rel))) fail(`${rel} missing`);
}
if (!process.exitCode) console.log('Workflow trace OK');

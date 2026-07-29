const fs = require('fs');
const path = require('path');
const { createReport, readJson } = require('./helpers');
const report = createReport('validate_indexnow_workflow', 'repo');
function read(relPath) { const abs = path.resolve(process.cwd(), relPath); return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : ''; }
function requireContains(file, content, needle, code, message, fixHint) { if (!content.includes(needle)) report.addIssue({ file, code, message, fixHint }); }
function main() {
  const workflowPath = '.github/workflows/deploy-distribution.yml';
  const workflow = read(workflowPath);
  if (!workflow) report.addIssue({ file: workflowPath, code: 'missing_deploy_distribution_workflow', message: 'Missing post-publish distribution workflow.', fixHint: 'Create the workflow with build, validation, provider submission, receipt commit, and evidence upload.' });
  else {
    requireContains(workflowPath, workflow, 'workflow_run:', 'workflow_missing_workflow_run', 'Distribution must follow the existing Manual Publish workflow.', 'Add workflow_run trigger.');
    requireContains(workflowPath, workflow, 'workflows: ["Manual Publish"]', 'workflow_missing_manual_publish', 'Distribution must follow Manual Publish.', 'Target Manual Publish.');
    requireContains(workflowPath, workflow, "github.event.workflow_run.conclusion == 'success'", 'workflow_missing_success_gate', 'Distribution must require successful Manual Publish.', 'Add a success-conclusion job gate.');
    requireContains(workflowPath, workflow, 'npm run build', 'workflow_missing_build', 'Distribution must refresh sitemap/build artifacts.', 'Add npm run build.');
    requireContains(workflowPath, workflow, 'npm run validate:all', 'workflow_missing_validation', 'Distribution must validate before provider submission.', 'Add npm run validate:all.');
    requireContains(workflowPath, workflow, 'npm run distribution:post-publish', 'workflow_missing_runner', 'Distribution must run the complete post-publish provider chain.', 'Run distribution:post-publish.');
    requireContains(workflowPath, workflow, 'GSC_SERVICE_ACCOUNT_JSON: ${{ secrets.GSC_SERVICE_ACCOUNT_JSON }}', 'workflow_missing_gsc_secret', 'Workflow must expose the GSC service-account secret.', 'Add GSC_SERVICE_ACCOUNT_JSON.');
    requireContains(workflowPath, workflow, 'INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }}', 'workflow_missing_indexnow_secret', 'Workflow must expose INDEXNOW_KEY.', 'Add INDEXNOW_KEY.');
    requireContains(workflowPath, workflow, 'git add data/distribution', 'workflow_missing_receipt_commit', 'Workflow must commit durable distribution receipts.', 'Commit data/distribution only.');
    requireContains(workflowPath, workflow, 'actions/upload-artifact@v4', 'workflow_missing_report_upload', 'Workflow must upload evidence.', 'Upload data/distribution, .build, and reports.');
  }
  const runnerPath = 'scripts/distribution/run_post_publish_distribution.mjs';
  const runner = read(runnerPath);
  if (!runner) report.addIssue({ file: runnerPath, code: 'missing_post_publish_runner', message: 'Missing complete post-publish distribution runner.', fixHint: 'Create the runner.' });
  else for (const token of ['api.indexnow.org/indexnow','webmasters/v3/sites/','searchconsole.googleapis.com/v1/urlInspection/index:inspect','data/distribution/provider_receipt.json','data/distribution/receipts/','data/distribution/observation_feedback.json']) requireContains(runnerPath, runner, token, 'runner_incomplete', `Runner missing ${token}.`, 'Restore the complete chain.');
  const config = readJson('distribution.config.json');
  if (config?.distribution_outputs?.indexnow_priority !== '.build/indexnow-priority.txt') report.addIssue({ file: 'distribution.config.json', code: 'distribution_priority_not_build_source', message: 'Priority artifact must be .build/indexnow-priority.txt.', fixHint: 'Restore the canonical path.' });
  if (config?.distribution_outputs?.indexnow_batch !== '.build/indexnow-batch.txt') report.addIssue({ file: 'distribution.config.json', code: 'distribution_batch_not_build_source', message: 'Batch artifact must be .build/indexnow-batch.txt.', fixHint: 'Restore the canonical path.' });
  const buildScript = read('scripts/build/build_site.js');
  if (!buildScript.includes("'indexnow.txt'")) report.addIssue({ file: 'scripts/build/build_site.js', code: 'build_not_copying_indexnow_key_file', message: 'Build must copy root indexnow.txt into dist/indexnow.txt.', fixHint: 'Restore key-file copying.' });
  report.finalize('post-publish distribution workflow contract OK');
}
main();

const fs = require('fs');
const path = require('path');
const { createReport, readJson } = require('./helpers');

const report = createReport('validate_indexnow_workflow', 'repo');

function read(relPath) {
  const abs = path.resolve(process.cwd(), relPath);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
}

function requireContains(file, content, needle, code, message, fixHint) {
  if (!content.includes(needle)) {
    report.addIssue({ file, code, message, fixHint });
  }
}

function main() {
  const workflowPath = '.github/workflows/deploy-distribution.yml';
  const workflow = read(workflowPath);
  if (!workflow) {
    report.addIssue({
      file: workflowPath,
      code: 'missing_deploy_distribution_workflow',
      message: 'Missing push-based deploy distribution workflow.',
      fixHint: 'Create .github/workflows/deploy-distribution.yml with build, validate, IndexNow submit, and report upload steps.'
    });
  } else {
    requireContains(workflowPath, workflow, 'push:', 'workflow_missing_push_trigger', 'Deploy distribution workflow must run on push.', 'Add push trigger for main branch.');
    requireContains(workflowPath, workflow, 'branches: [main]', 'workflow_missing_main_branch', 'Deploy distribution workflow must target main branch pushes.', 'Set branches: [main].');
    requireContains(workflowPath, workflow, 'npm run build', 'workflow_missing_build', 'Deploy distribution workflow must build the site before submission.', 'Add npm run build before submission.');
    requireContains(workflowPath, workflow, 'npm run validate:all', 'workflow_missing_validation', 'Deploy distribution workflow must validate before submission.', 'Add npm run validate:all before submission.');
    requireContains(workflowPath, workflow, './distribution_scripts/indexnow_submit.sh .build/indexnow-priority.txt .build/indexnow-batch.txt', 'workflow_missing_indexnow_submit', 'Deploy distribution workflow must submit .build priority and batch IndexNow files.', 'Call distribution_scripts/indexnow_submit.sh with .build priority and batch files.');
    requireContains(workflowPath, workflow, 'INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }}', 'workflow_missing_indexnow_secret_env', 'Deploy distribution workflow must expose INDEXNOW_KEY from GitHub Actions secrets.', 'Add INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }} to the workflow environment.');
    requireContains(workflowPath, workflow, 'INDEXNOW_KEY_LOCATION: https://horselegalguide.com/indexnow.txt', 'workflow_missing_key_location', 'Deploy distribution workflow must declare the public IndexNow key location.', 'Set INDEXNOW_KEY_LOCATION to https://horselegalguide.com/indexnow.txt.');
    requireContains(workflowPath, workflow, 'gsc_submit_sitemaps.py || true', 'workflow_gsc_sitemap_not_optional', 'GSC sitemap submission must be optional and must not block IndexNow.', 'Keep GSC sitemap submission non-blocking with || true.');
    requireContains(workflowPath, workflow, 'gsc_inspect_urls.py .build/distribution-priority-urls.txt || true', 'workflow_gsc_inspection_not_optional', 'GSC URL inspection must be optional and must not block IndexNow.', 'Keep GSC URL inspection non-blocking with || true.');
    requireContains(workflowPath, workflow, '_ops/reports', 'workflow_missing_report_upload', 'Deploy distribution workflow must upload _ops/reports as an artifact.', 'Upload _ops/reports with actions/upload-artifact.');
    requireContains(workflowPath, workflow, '.build', 'workflow_missing_build_artifact_upload', 'Deploy distribution workflow must upload .build distribution artifacts.', 'Upload .build with actions/upload-artifact.');
  }

  const submitPath = 'distribution_scripts/indexnow_submit.sh';
  const submit = read(submitPath);
  if (!submit) {
    report.addIssue({
      file: submitPath,
      code: 'missing_indexnow_submit_script',
      message: 'Missing IndexNow submit script.',
      fixHint: 'Create distribution_scripts/indexnow_submit.sh.'
    });
  } else {
    requireContains(submitPath, submit, '_ops/reports/indexnow-submit-report.json', 'submit_missing_report_path', 'IndexNow submit script must write a durable report.', 'Write _ops/reports/indexnow-submit-report.json.');
    requireContains(submitPath, submit, 'INDEXNOW_DRY_RUN', 'submit_missing_dry_run', 'IndexNow submit script must support dry-run mode.', 'Support INDEXNOW_DRY_RUN=1 for validation-safe execution.');
    requireContains(submitPath, submit, '.build/indexnow-priority.txt', 'submit_missing_build_priority_default', 'IndexNow submit script must default to .build priority URLs.', 'Use .build/indexnow-priority.txt as default priority input.');
    requireContains(submitPath, submit, '.build/indexnow-batch.txt', 'submit_missing_build_batch_default', 'IndexNow submit script must default to .build batch URLs.', 'Use .build/indexnow-batch.txt as default batch input.');
    requireContains(submitPath, submit, 'dist/indexnow.txt', 'submit_missing_key_file_verification', 'IndexNow submit script must verify dist/indexnow.txt before live submission.', 'Check dist/indexnow.txt against INDEXNOW_KEY before posting live.');
  }

  const config = readJson('distribution.config.json');
  if (config?.distribution_outputs?.indexnow_priority !== '.build/indexnow-priority.txt') {
    report.addIssue({
      file: 'distribution.config.json',
      code: 'distribution_priority_not_build_source',
      message: 'distribution.config.json must declare .build/indexnow-priority.txt as the distribution IndexNow priority artifact.',
      fixHint: 'Set distribution_outputs.indexnow_priority to .build/indexnow-priority.txt.'
    });
  }
  if (config?.distribution_outputs?.indexnow_batch !== '.build/indexnow-batch.txt') {
    report.addIssue({
      file: 'distribution.config.json',
      code: 'distribution_batch_not_build_source',
      message: 'distribution.config.json must declare .build/indexnow-batch.txt as the distribution IndexNow batch artifact.',
      fixHint: 'Set distribution_outputs.indexnow_batch to .build/indexnow-batch.txt.'
    });
  }



  const buildPath = 'scripts/build/build_site.js';
  const buildScript = read(buildPath);
  if (!buildScript.includes("'indexnow.txt'")) {
    report.addIssue({
      file: buildPath,
      code: 'build_not_copying_indexnow_key_file',
      message: 'Build must copy root indexnow.txt into dist/indexnow.txt for live IndexNow verification.',
      fixHint: 'Include indexnow.txt in the static files copied into dist.'
    });
  }

  const publicSignalPath = '.github/workflows/public-signal-processing.yml';
  const publicSignal = read(publicSignalPath);
  if (publicSignal) {
    requireContains(publicSignalPath, publicSignal, 'git fetch origin main', 'public_signal_missing_fetch', 'Public signal workflow must fetch origin/main before pushing generated updates.', 'Fetch origin/main before rebase/push.');
    requireContains(publicSignalPath, publicSignal, 'git rebase origin/main', 'public_signal_missing_rebase', 'Public signal workflow must rebase before pushing generated updates.', 'Rebase onto origin/main before push.');
    requireContains(publicSignalPath, publicSignal, 'git push origin HEAD:main', 'public_signal_missing_explicit_push', 'Public signal workflow must push explicitly to origin main.', 'Use git push origin HEAD:main.');
  }

  report.finalize('IndexNow workflow contract OK');
}

main();

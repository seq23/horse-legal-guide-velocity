const fs = require('fs');
const path = require('path');
const { createReport, ensureExists, readJson } = require('./helpers');

const report = createReport('validate_distribution', 'repo');

function fileNonEmpty(relPath) {
  const filePath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) return false;
  return fs.readFileSync(filePath, 'utf8').trim().length > 0;
}

function main() {
  [
    'dist/sitemap.xml',
    'dist/sitemap-pages.xml',
    'dist/llms.txt',
    'dist/answers.json',
    'dist/coverage.json',
    'dist/indexnow-priority.txt',
    'dist/indexnow-batch.txt',
    'distribution.config.json',
    '.env.example',
    'distribution_scripts/indexnow_submit.sh',
    'distribution_scripts/gsc_submit_sitemaps.py',
    'distribution_scripts/gsc_inspect_urls.py',
    'scripts/distribution/run_post_publish_distribution.mjs',
    '.github/workflows/deploy-distribution.yml',
    '.build/distribution-manifest.json',
    '.build/distribution-priority-urls.txt',
    '.build/indexnow-priority.txt',
    '.build/indexnow-batch.txt'
  ].forEach((relPath) => {
    if (!fs.existsSync(path.resolve(process.cwd(), relPath))) {
      report.addIssue({
        file: relPath,
        code: 'missing_distribution_artifact',
        message: `Missing required distribution path: ${relPath}`,
        fixHint: 'Run npm run build and ensure Sprint 5 distribution files are present.'
      });
    }
  });

  const config = readJson('distribution.config.json');
  if (!Array.isArray(config.sitemaps) || !config.sitemaps.length) {
    report.addIssue({
      file: 'distribution.config.json',
      code: 'missing_sitemaps',
      message: 'distribution.config.json must declare at least one sitemap.',
      fixHint: 'Add dist sitemap entries to distribution.config.json.'
    });
  }
  if (!config.indexnow || !config.indexnow.priority_input || !config.indexnow.batch_input) {
    report.addIssue({
      file: 'distribution.config.json',
      code: 'missing_indexnow_contract',
      message: 'distribution.config.json must declare indexnow priority and batch inputs.',
      fixHint: 'Add indexnow.priority_input and indexnow.batch_input.'
    });
  }

  const sitemap = fileNonEmpty('dist/sitemap-pages.xml') ? fs.readFileSync(path.resolve(process.cwd(), 'dist/sitemap-pages.xml'), 'utf8') : '';
  if (sitemap && (!sitemap.includes('/disclaimer/') || !sitemap.includes('/privacy-policy/'))) {
    report.addIssue({
      file: 'dist/sitemap-pages.xml',
      code: 'policy_pages_missing',
      message: 'Required policy pages missing from sitemap.',
      fixHint: 'Ensure disclaimer and privacy-policy pages remain public and indexable.'
    });
  }

  ['dist/indexnow-priority.txt', 'dist/indexnow-batch.txt', '.build/distribution-priority-urls.txt'].forEach((relPath) => {
    if (!fileNonEmpty(relPath)) {
      report.addIssue({
        file: relPath,
        code: 'empty_distribution_file',
        message: `${relPath} is empty.`,
        fixHint: 'Regenerate build/distribution artifacts so publish and indexing jobs have URLs to submit.'
      });
    }
  });


  const postPublishWorkflow = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/deploy-distribution.yml'), 'utf8');
  if (!postPublishWorkflow.includes('workflows: ["Manual Publish"]') || !postPublishWorkflow.includes("github.event.workflow_run.conclusion == 'success'")) {
    report.addIssue({
      file: '.github/workflows/deploy-distribution.yml',
      code: 'distribution_not_post_publish',
      message: 'Distribution must run only after successful Manual Publish or explicit workflow dispatch.',
      fixHint: 'Use workflow_run for Manual Publish and require a success conclusion.'
    });
  }
  const postPublishRunner = fs.readFileSync(path.resolve(process.cwd(), 'scripts/distribution/run_post_publish_distribution.mjs'), 'utf8');
  for (const token of ['api.indexnow.org/indexnow', 'webmasters/v3/sites/', 'searchconsole.googleapis.com/v1/urlInspection/index:inspect', 'provider_receipt.json', 'observation_feedback.json']) {
    if (!postPublishRunner.includes(token)) {
      report.addIssue({ file: 'scripts/distribution/run_post_publish_distribution.mjs', code: 'post_publish_distribution_incomplete', message: `Post-publish distribution runner missing ${token}.`, fixHint: 'Restore the complete provider and receipt chain.' });
    }
  }

  report.finalize('distribution valid');
}

main();

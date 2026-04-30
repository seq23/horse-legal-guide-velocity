const fs = require('fs');
const path = require('path');
const { createReport, readJson } = require('./helpers');

const report = createReport('validate_above_fold', 'page');
const targets = readJson('data/queries/page_targets.json').filter((t) => t.review_status === 'approved');
for (const page of targets) {
  const file = path.resolve(process.cwd(), 'dist', page.slug.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const bodyStart = html.indexOf('<div class="page-card">');
  const firstChunk = html.slice(bodyStart >= 0 ? bodyStart : 0, (bodyStart >= 0 ? bodyStart : 0) + 5000);
  if (!firstChunk.includes('data-answer-summary="true"')) {
    report.addIssue({ file: page.slug, code: 'missing_quick_answer_block', message: 'Above-the-fold quick answer block missing.', fixHint: 'Render a quick-answer block before the main body.', blocking: true });
  }
  if (!firstChunk.includes('class="answer-shape-module"')) {
    report.addIssue({ file: page.slug, code: 'missing_above_fold_module', message: 'Answer-shape module is not visible in the first screen of the page.', fixHint: 'Move the structured answer module directly below the header and quick answer.', blocking: true });
  }
}
report.finalize('Above-the-fold answer blocks are present.');

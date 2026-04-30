const fs = require('fs');
const path = require('path');
const { createReport, readJson } = require('./helpers');
const { detectQueryFamily, requiredTopModuleForFamily } = require('../../scripts/lib/answer_shape');

const report = createReport('validate_answer_shape', 'page');
const targets = readJson('data/queries/page_targets.json').filter((t) => t.review_status === 'approved');
for (const page of targets) {
  const file = path.resolve(process.cwd(), 'dist', page.slug.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(file)) {
    report.addIssue({ file: page.slug, code: 'missing_rendered_page', message: 'Rendered page missing from dist output.', fixHint: 'Run build and verify page slug output.', blocking: true });
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const family = detectQueryFamily(page);
  const moduleType = requiredTopModuleForFamily(family);
  if (!html.includes('class="answer-shape-module"')) {
    report.addIssue({ file: page.slug, code: 'missing_answer_shape_module', message: 'Page is missing the answer-shape module block.', fixHint: 'Render an above-the-fold structured answer module for this page family.', blocking: true });
  }
  if (!html.includes(`data-query-family="${family}"`)) {
    report.addIssue({ file: page.slug, code: 'wrong_query_family', message: `Rendered page is missing expected query family marker: ${family}.`, fixHint: 'Make renderer assign query family from query-family map.', blocking: true });
  }
  if (!html.includes(`data-answer-shape="${moduleType}"`)) {
    report.addIssue({ file: page.slug, code: 'wrong_answer_shape', message: `Rendered page is missing expected answer-shape module: ${moduleType}.`, fixHint: 'Render the required top module for the detected query family.', blocking: true });
  }
}
report.finalize('Answer-shape modules are present for approved public pages.');

const fs = require('fs');
const path = require('path');
const { createReport, readJson } = require('./helpers');

const report = createReport('validate_compare_family_contract', 'page');
const targets = readJson('data/queries/page_targets.json').filter((t) => String(t.review_status) === 'approved' && String(t.page_type) === 'comparison');
const requiredSnippets = [
  'Bottom-line decision',
  'Best fit / worst fit',
  'What usually decides the comparison',
  'Practical verdict'
];
for (const page of targets) {
  const file = path.resolve(process.cwd(), 'dist', page.slug.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  for (const snippet of requiredSnippets) {
    if (!html.includes(snippet)) {
      report.addIssue({
        file: page.slug,
        code: 'missing_compare_contract_block',
        message: `Compare page missing required contract block: ${snippet}.`,
        fixHint: 'Render the compare-family decision scaffold with verdict, fit, deciding factors, and practical verdict.',
        blocking: true
      });
    }
  }
}
report.finalize('Compare-family contract blocks are present for approved comparison pages.');

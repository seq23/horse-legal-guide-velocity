const fs = require('fs');
const path = require('path');
const { createReport, readJson } = require('./helpers');

const report = createReport('validate_scenario_family_contract', 'page');
const targets = readJson('data/queries/page_targets.json').filter((t) => String(t.review_status) === 'approved' && String(t.page_type) === 'scenario');
const requiredSnippets = [
  'What matters first',
  'Fast triage framework',
  'What to gather before you act',
  'What not to do',
  'Practical next move'
];
for (const page of targets) {
  const file = path.resolve(process.cwd(), 'dist', page.slug.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  for (const snippet of requiredSnippets) {
    if (!html.includes(snippet)) {
      report.addIssue({
        file: page.slug,
        code: 'missing_scenario_contract_block',
        message: `Scenario page missing required triage block: ${snippet}.`,
        fixHint: 'Render the scenario-family triage scaffold with first matters, evidence, do-not-do, and next move sections.',
        blocking: true
      });
    }
  }
}
report.finalize('Scenario-family triage contract blocks are present for approved scenario pages.');

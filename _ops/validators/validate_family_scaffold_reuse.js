const fs = require('fs');
const path = require('path');
const { createReport, readJson } = require('./helpers');

const report = createReport('validate_family_scaffold_reuse', 'page');
const targets = readJson('data/queries/page_targets.json').filter((t) => t.review_status === 'approved');
const bannedPhrases = [
  'People often focus on who feels right',
  'The situation usually becomes harder',
  'Risk increases when someone keeps acting',
  'A careful next step is to gather the relevant documents',
  'This page is a general educational explanation for equestrians, horse owners, trainers, barn operators, sponsors, and equine businesses.'
];

for (const page of targets) {
  if (!['comparison', 'scenario', 'faq'].includes(String(page.page_type || '').toLowerCase())) continue;
  const file = path.resolve(process.cwd(), 'dist', page.slug.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const hits = bannedPhrases.filter((phrase) => html.includes(phrase));
  if (hits.length) {
    report.addIssue({
      file: page.slug,
      code: 'generic_scaffold_reuse',
      message: `Rendered page still contains banned generic scaffold language: ${hits.join(' | ')}`,
      fixHint: 'Replace generic repeated body scaffolding with family-specific decision, triage, or answer logic.',
      blocking: true
    });
  }
}

report.finalize('Family-level generic scaffold reuse is not present in stabilized families.');

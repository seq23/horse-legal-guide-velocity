const fs = require('fs');
const path = require('path');
const { createReport, readJson } = require('./helpers');

const report = createReport('validate_faq_opening_contract', 'page');
const targets = readJson('data/queries/page_targets.json').filter((t) => String(t.review_status) === 'approved' && String(t.page_type) === 'faq');
const badStarts = [/^generally\b/i, /^usually\b/i, /^it depends\b/i, /^depends\b/i, /^often\b/i];
for (const page of targets) {
  const file = path.resolve(process.cwd(), 'dist', page.slug.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const sectionMatch = html.match(/<section class="quick-answer-block"[\s\S]*?<\/section>/i);
  if (!sectionMatch) {
    report.addIssue({
      file: page.slug,
      code: 'missing_faq_quick_answer',
      message: 'FAQ page is missing parseable quick-answer text.',
      fixHint: 'Render the quick-answer block with a Short answer label and direct opening sentence.',
      blocking: true
    });
    continue;
  }
  const opening = sectionMatch[0]
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*Quick answer\s*/i, '')
    .replace(/^\s*Short answer:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (badStarts.some((rx) => rx.test(opening))) {
    report.addIssue({
      file: page.slug,
      code: 'hedged_faq_opening',
      message: `FAQ quick-answer opening is still too hedged: ${opening}`,
      fixHint: 'Open FAQ pages with a direct answer or a concrete deciding condition, not a soft hedge.',
      blocking: true
    });
  }
}
report.finalize('FAQ quick-answer openings are direct enough for stabilized answer extraction.');

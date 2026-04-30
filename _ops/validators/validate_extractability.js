const fs = require('fs');
const path = require('path');
const { createReport, readJson } = require('./helpers');

const report = createReport('validate_extractability', 'page');
const targets = readJson('data/queries/page_targets.json').filter((t) => t.review_status === 'approved');
for (const page of targets) {
  const file = path.resolve(process.cwd(), 'dist', page.slug.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const bodyStart = html.indexOf('<div class="page-card">');
  const firstChunk = html.slice(bodyStart >= 0 ? bodyStart : 0, (bodyStart >= 0 ? bodyStart : 0) + 6000).toLowerCase();
  if (!firstChunk.includes('<strong>short answer:</strong>')) {
    report.addIssue({ file: page.slug, code: 'missing_short_answer_label', message: 'Short answer label is missing from the liftable answer block.', fixHint: 'Prefix the lead answer with “Short answer:” so models can lift it cleanly.', blocking: true });
  }
  if (!firstChunk.includes('<table') && !firstChunk.includes('<ol>') && !firstChunk.includes('<ul>')) {
    report.addIssue({ file: page.slug, code: 'missing_scannable_structure', message: 'First screen lacks a scannable list or table.', fixHint: 'Render a checklist, table, or decision structure above the fold.', blocking: true });
  }
  if (firstChunk.includes('treat this as a faq question') || firstChunk.includes('treat this as a comparison question')) {
    report.addIssue({ file: page.slug, code: 'generator_language_leak', message: 'Generator meta-language leaked into the visible answer.', fixHint: 'Replace generator instructions with direct user-facing answer copy.', blocking: true });
  }
}
report.finalize('Pages expose extractable answer-first structures.');

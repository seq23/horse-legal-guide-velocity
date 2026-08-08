const fs = require('fs');
function fail(message) { console.error(`DRAFT_UNIQUENESS_FAIL: ${message}`); process.exitCode = 1; }
const reportFile = 'data/admin/draft_uniqueness_report.json';
const backlogFile = 'data/system/editorial_backlog.json';
if (!fs.existsSync(reportFile)) fail(`${reportFile} missing`);
if (!fs.existsSync(backlogFile)) fail(`${backlogFile} missing`);
if (fs.existsSync(reportFile) && fs.existsSync(backlogFile)) {
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const backlog = JSON.parse(fs.readFileSync(backlogFile, 'utf8'));
  if (report.automatic_repair !== true) fail('automatic draft similarity repair must be enabled');
  if (report.automatic_approval !== false || report.automatic_publication !== false) fail('manual approval/publication boundary changed');
  if (!Array.isArray(report.results) || report.results.length !== backlog.length) fail('draft uniqueness report does not cover the full backlog');
  for (const entry of backlog) {
    if (entry.approval_eligible && entry.uniqueness_status !== 'passed') fail(`${entry.entry_id} is approval-eligible without passed uniqueness self-heal`);
    if (entry.approval_eligible && Number(entry.uniqueness_max_similarity || 0) >= Number(entry.uniqueness_threshold || 0.85)) fail(`${entry.entry_id} is approval-eligible with substantial similarity remaining`);
  }
  if (Number(report.failed || 0) > 0) fail(`${report.failed} unresolved draft uniqueness failures remain`);
}
if (!process.exitCode) console.log('Draft uniqueness contract OK (automatic repair before manual client approval).');

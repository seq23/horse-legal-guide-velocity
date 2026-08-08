const fs = require('fs');
function fail(message) { console.error(`PAGE_UNIQUENESS_FAIL: ${message}`); process.exitCode = 1; }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
const reportFile = 'data/admin/page_uniqueness_report.json';
const ledgerFile = 'data/admin/consolidation_review_ledger.json';
for (const file of [reportFile, ledgerFile, 'reports/quality/page_uniqueness_report.json', 'reports/quality/consolidation_review_ledger.json']) if (!fs.existsSync(file)) fail(`${file} missing`);
if (fs.existsSync(reportFile) && fs.existsSync(ledgerFile)) {
  const report = read(reportFile);
  const ledger = read(ledgerFile);
  for (const key of ['indexable_pages_measured', 'duplicate_title_groups', 'duplicate_description_groups', 'high_similarity_pairs', 'intent_overlap_pairs']) {
    if (typeof report.metrics?.[key] !== 'number') fail(`report metric missing numeric ${key}`);
  }
  if (!report.source_fingerprint) fail('report source_fingerprint missing');
  if (!Array.isArray(report.high_similarity_pairs)) fail('high_similarity_pairs missing');
  if (!Array.isArray(report.intent_overlap_pairs)) fail('intent_overlap_pairs missing');
  if (!Array.isArray(ledger.entries)) fail('ledger entries missing');
  if (ledger.automatic_live_changes_allowed !== false) fail('existing live-page changes must remain owner-approved');
  for (const entry of ledger.entries || []) {
    if (entry.status !== 'owner_review_required') fail(`${entry.ledger_id} must remain owner_review_required`);
    if (entry.action_applied !== 'none') fail(`${entry.ledger_id} applied a live action without owner approval`);
    if (entry.approval_required_for_live_change !== true) fail(`${entry.ledger_id} missing live-change approval boundary`);
    if (!Array.isArray(entry.members) || entry.members.length < 2) fail(`${entry.ledger_id} has invalid members`);
  }
  if (report.metrics.high_similarity_pairs > 0 && ledger.entry_count < 1) fail('high-similarity findings exist without an owner-review ledger');
  if (ledger.source_fingerprint !== report.source_fingerprint) fail('ledger/report fingerprint mismatch');
}
if (!process.exitCode) console.log('Page uniqueness contract OK (fresh measurements, warning-level existing-page findings, owner approval preserved).');

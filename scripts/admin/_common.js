const fs = require('fs');
const path = require('path');
const { readJson } = require('../../_ops/validators/helpers');

function loadState() {
  return {
    backlog: readJson('data/system/editorial_backlog.json'),
    calendar: readJson('data/system/content_calendar.json')
  };
}

function writeJson(relPath, data) {
  fs.mkdirSync(path.dirname(path.resolve(process.cwd(), relPath)), { recursive: true });
  fs.writeFileSync(path.resolve(process.cwd(), relPath), JSON.stringify(data, null, 2) + '\n');
}

function saveState(backlog, calendar) {
  writeJson('data/system/editorial_backlog.json', backlog);
  writeJson('data/system/content_calendar.json', calendar);
}

function syncCalendar(backlog, calendar) {
  const byId = new Map(backlog.map((b) => [b.entry_id, b]));
  for (const item of calendar) {
    const entry = byId.get(item.entry_id);
    if (!entry) continue;
    item.status = entry.status;
    item.review_status = entry.review_status || entry.status;
    item.publish_date = entry.publish_date || null;
    item.generation_validation_status = entry.generation_validation?.status || 'pass';
    item.self_heal_status = entry.self_heal_status || 'not_run';
    item.prevalidation_status = entry.prevalidation_status || 'not_run';
    item.approval_eligible = Boolean(entry.approval_eligible);
  }
}

function blockingReasons(entry) {
  const reasons = [];
  if (!entry) return ['missing entry'];
  if ((entry.generation_validation?.status || 'pass') === 'fail') reasons.push('generation validation failed');
  if ((entry.self_heal_status || 'not_run') !== 'passed') reasons.push('self-heal has not passed');
  if ((entry.prevalidation_status || 'not_run') !== 'passed') reasons.push('prevalidation has not passed');
  if ((entry.uniqueness_status || 'not_run') !== 'passed') reasons.push('automatic draft uniqueness self-heal has not passed');
  if (Number(entry.uniqueness_max_similarity || 0) >= Number(entry.uniqueness_threshold || 0.85)) reasons.push(`substantial draft similarity remains: ${Number(entry.uniqueness_max_similarity).toFixed(4)}`);
  if (entry.hard_fails && entry.hard_fails.length) reasons.push(`hard fails: ${entry.hard_fails.join('; ')}`);
  if (!entry.data_atom_id) reasons.push('missing data atom');
  if ((entry.routing_score || 0) < 100) reasons.push('Wise Covington routing not verified');
  if ((entry.legal_safety_score || 0) < 100) reasons.push('legal safety not verified');
  if (entry.status === 'rejected' || entry.review_status === 'rejected') reasons.push('entry is rejected');
  if (entry.status === 'needs_revision' || entry.review_status === 'needs_revision') reasons.push('entry needs revision');
  return reasons;
}

function isReviewable(entry) {
  return blockingReasons(entry).length === 0;
}

function approveEntry(entry, publishDate = null) {
  const reasons = blockingReasons(entry);
  if (reasons.length) return { ok: false, reasons };
  entry.status = 'approved';
  entry.review_status = 'approved';
  entry.approved_at = new Date().toISOString();
  if (publishDate) entry.publish_date = publishDate;
  return { ok: true, reasons: [] };
}

function rejectEntry(entry, reason = 'owner bulk rejection') {
  entry.status = 'rejected';
  entry.review_status = 'rejected';
  entry.rejected_at = new Date().toISOString();
  entry.rejection_reason = reason;
}

function markNeedsRevision(entry, reason = 'owner marked needs revision') {
  entry.status = 'needs_revision';
  entry.review_status = 'needs_revision';
  entry.revision_requested_at = new Date().toISOString();
  entry.revision_reason = reason;
}

function assertDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw new Error('Publish date must be YYYY-MM-DD');
}

module.exports = { loadState, saveState, syncCalendar, isReviewable, blockingReasons, approveEntry, rejectEntry, markNeedsRevision, assertDate };

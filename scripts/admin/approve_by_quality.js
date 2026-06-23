const { loadState, saveState, syncCalendar, approveEntry } = require('./_common');
const min = Number(process.argv[2] || 90);
if (!Number.isFinite(min)) throw new Error('Usage: node scripts/admin/approve_by_quality.js [min_score]');
const { backlog, calendar } = loadState();
let approved = 0;
const skipped = [];
for (const entry of backlog) {
  const score = Math.min(entry.humanization_score || 0, entry.seo_score || 0, entry.aeo_score || 0, entry.geo_score || 0, entry.llm_citation_score || 0, entry.legal_safety_score || 0);
  if ((entry.status === 'pending' || entry.review_status === 'pending') && score >= min) {
    const result = approveEntry(entry);
    if (result.ok) approved += 1; else skipped.push({ id: entry.entry_id, reasons: result.reasons });
  }
}
syncCalendar(backlog, calendar);
saveState(backlog, calendar);
console.log(JSON.stringify({ min_score: min, approved, skipped_count: skipped.length, skipped: skipped.slice(0, 50) }, null, 2));

const { loadState, saveState, syncCalendar, approveEntry } = require('./_common');
const cluster = process.argv[2];
if (!cluster) throw new Error('Usage: node scripts/admin/approve_by_cluster.js <source_cluster>');
const { backlog, calendar } = loadState();
let approved = 0;
const skipped = [];
for (const entry of backlog) {
  if (entry.source_cluster === cluster && (entry.status === 'pending' || entry.review_status === 'pending')) {
    const result = approveEntry(entry);
    if (result.ok) approved += 1; else skipped.push({ id: entry.entry_id, reasons: result.reasons });
  }
}
syncCalendar(backlog, calendar);
saveState(backlog, calendar);
console.log(JSON.stringify({ cluster, approved, skipped_count: skipped.length, skipped: skipped.slice(0, 50) }, null, 2));

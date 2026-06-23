const { loadState, saveState, syncCalendar, approveEntry } = require('./_common');
const { backlog, calendar } = loadState();
let approved = 0;
const skipped = [];
for (const entry of backlog) {
  if (entry.status !== 'pending' && entry.review_status !== 'pending') continue;
  const result = approveEntry(entry);
  if (result.ok) approved += 1; else skipped.push({ id: entry.entry_id, reasons: result.reasons });
}
syncCalendar(backlog, calendar);
saveState(backlog, calendar);
console.log(JSON.stringify({ approved, skipped_count: skipped.length, skipped: skipped.slice(0, 50) }, null, 2));

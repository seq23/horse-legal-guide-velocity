const { loadState, saveState, syncCalendar, approveEntry } = require('./_common');
const ids = process.argv.slice(2).filter(Boolean);
if (!ids.length) throw new Error('Usage: node scripts/admin/approve_many.js <entry_id> [entry_id...]');
const { backlog, calendar } = loadState();
const byId = new Map(backlog.map((b) => [b.entry_id, b]));
let approved = 0;
const skipped = [];
for (const id of ids) {
  const entry = byId.get(id);
  if (!entry) { skipped.push({ id, reasons: ['unknown entry_id'] }); continue; }
  const result = approveEntry(entry);
  if (result.ok) approved += 1; else skipped.push({ id, reasons: result.reasons });
}
syncCalendar(backlog, calendar);
saveState(backlog, calendar);
console.log(JSON.stringify({ approved, skipped }, null, 2));
if (skipped.length) process.exitCode = 1;

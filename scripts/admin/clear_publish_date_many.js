const { loadState, saveState, syncCalendar } = require('./_common');
const ids = process.argv.slice(2).filter(Boolean);
if (!ids.length) throw new Error('Usage: node scripts/admin/clear_publish_date_many.js <entry_id> [entry_id...]');
const { backlog, calendar } = loadState();
const byId = new Map(backlog.map((b) => [b.entry_id, b]));
let updated = 0;
const skipped = [];
for (const id of ids) {
  const entry = byId.get(id);
  if (!entry) { skipped.push({ id, reasons: ['unknown entry_id'] }); continue; }
  entry.publish_date = null;
  entry.publish_date_updated_at = new Date().toISOString();
  updated += 1;
}
syncCalendar(backlog, calendar);
saveState(backlog, calendar);
console.log(JSON.stringify({ cleared: updated, skipped }, null, 2));
if (skipped.length) process.exitCode = 1;

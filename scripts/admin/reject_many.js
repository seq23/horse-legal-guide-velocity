const { loadState, saveState, syncCalendar, rejectEntry } = require('./_common');
const allIds = process.argv.slice(2).filter(Boolean);
if (!allIds.length) throw new Error('Usage: node scripts/admin/reject_many.js <entry_id> [entry_id...]');
// sl:<slug> (search-loop pages) and change:<id> (site changes) are decided in the owners' queue module.
const queued = require('../search_loop/owner_queue').decide(allIds, 'reject');
const ids = queued.rest;
const { backlog, calendar } = loadState();
const byId = new Map(backlog.map((b) => [b.entry_id, b]));
let rejected = queued.done.length;
const skipped = [...queued.skipped];
for (const id of ids) {
  const entry = byId.get(id);
  if (!entry) { skipped.push({ id, reasons: ['unknown entry_id'] }); continue; }
  rejectEntry(entry);
  rejected += 1;
}
syncCalendar(backlog, calendar);
saveState(backlog, calendar);
console.log(JSON.stringify({ rejected, skipped }, null, 2));
if (skipped.length) process.exitCode = 1;

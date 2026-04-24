const { loadState, saveState, syncCalendar, isReviewable } = require('./_common');
const field = process.argv[2];
const value = process.argv[3];
if (!field || !value) throw new Error('Usage: node scripts/admin/approve_by_filter.js <field> <value>');
const { backlog, calendar } = loadState();
let count = 0;
for (const entry of backlog) {
  if (String(entry[field]) === String(value) && entry.status === 'pending' && isReviewable(entry)) {
    entry.status = 'approved';
    entry.review_status = 'approved';
    count += 1;
  }
}
syncCalendar(backlog, calendar);
saveState(backlog, calendar);
console.log(`Approved ${count} drafts where ${field}=${value}`);

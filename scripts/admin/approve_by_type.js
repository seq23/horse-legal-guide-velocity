const { loadState, saveState, syncCalendar, isReviewable } = require('./_common');
const contentType = process.argv[2];
if (!contentType) throw new Error('Usage: node scripts/admin/approve_by_type.js <content_type>');
const { backlog, calendar } = loadState();
let count = 0;
for (const entry of backlog) {
  if (entry.content_type === contentType && entry.status === 'pending' && isReviewable(entry)) {
    entry.status = 'approved';
    entry.review_status = 'approved';
    count += 1;
  }
}
syncCalendar(backlog, calendar);
saveState(backlog, calendar);
console.log(`Approved ${count} ${contentType} drafts`);

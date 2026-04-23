const fs = require('fs');
const path = require('path');
const { readJson } = require('../../_ops/validators/helpers');

function loadState() {
  return { backlog: readJson('data/system/editorial_backlog.json'), calendar: readJson('data/system/content_calendar.json') };
}

function writeJson(relPath, data) {
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
    item.generation_validation_status = entry.generation_validation?.status || 'pass';
  }
}

function isReviewable(entry) {
  return (entry.generation_validation?.status || 'pass') !== 'fail';
}

module.exports = { loadState, saveState, syncCalendar, isReviewable };

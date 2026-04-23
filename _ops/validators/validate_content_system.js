const { ensureExists, readJson, fail, ok } = require('./helpers');

function main() {
  ensureExists('data/system/content_strategy.json');
  ensureExists('data/system/content_calendar.json');
  ensureExists('data/system/editorial_backlog.json');
  ensureExists('templates/content_profiles.json');
  ensureExists('content/drafts/generated');
  ensureExists('dist/admin/index.html');
  const strategy = readJson('data/system/content_strategy.json');
  const calendar = readJson('data/system/content_calendar.json');
  const backlog = readJson('data/system/editorial_backlog.json');
  const profiles = readJson('templates/content_profiles.json');
  if (!Array.isArray(strategy.daily) || !Array.isArray(strategy.weekly) || !Array.isArray(strategy.monthly) || !Array.isArray(strategy.quarterly)) {
    fail('Content strategy cadence arrays are missing or invalid.');
  }
  const validTypes = new Set(Object.keys(profiles));
  const validStatuses = new Set(['pending', 'approved', 'published', 'rejected', 'needs_revision']);
  const ids = new Set();
  for (const entry of backlog) {
    if (!entry.entry_id || ids.has(entry.entry_id)) fail(`Duplicate or missing editorial backlog entry_id: ${entry.entry_id}`);
    ids.add(entry.entry_id);
    if (!validTypes.has(entry.content_type)) fail(`Invalid content_type in editorial backlog: ${entry.content_type}`);
    if (!validStatuses.has(entry.status)) fail(`Invalid status in editorial backlog: ${entry.status}`);
    if (!entry.github_path) fail(`Missing github_path in editorial backlog entry: ${entry.entry_id}`);
  }
  for (const item of calendar) {
    if (!ids.has(item.entry_id)) fail(`Calendar entry references unknown entry_id: ${item.entry_id}`);
    if (!validStatuses.has(item.status)) fail(`Invalid calendar status: ${item.status}`);
  }
  ok(`Content system files validated for ${backlog.length} backlog entries and ${calendar.length} calendar entries.`);
}

main();

const { readJson, fail, ok } = require('./helpers');
const backlog = readJson('data/system/editorial_backlog.json');
for (const entry of backlog) {
  if (entry.status === 'approved' && (entry.generation_validation?.status || 'pass') === 'fail') {
    fail(`Approved draft has fail-state generation validation: ${entry.entry_id}`);
  }
}
ok('Publish-quality validation passed for approved draft set.');

const { readJson, fail, ok } = require('./helpers');
const config = readJson('data/system/config.json');
if (!['manual','hybrid','full_velocity'].includes(config.publishing_mode)) fail('Invalid publishing_mode');
const targets = readJson('data/queries/page_targets.json');
for (const page of targets) {
  if (!page.review_status) fail(`Missing review_status on ${page.page_id}`);
}
ok('mode configuration valid');

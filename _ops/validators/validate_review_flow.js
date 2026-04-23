const fs = require('fs');
const { readJson, collectFiles, fail, ok } = require('./helpers');
const queue = readJson('data/community/publish_queue.json');
if (!Array.isArray(queue)) fail('publish_queue.json must be an array');
const targets = readJson('data/queries/page_targets.json');
const approvedSlugs = new Set(targets.filter((p) => p.review_status === 'approved').map((p) => p.slug));
const liveFiles = collectFiles('dist', (file) => file.endsWith('index.html'));
for (const file of liveFiles) {
  const rel = file.split('/dist')[1].replace(/\/index\.html$/, '/').replace(/\\/g, '/');
  const allowedGenerated = rel.startsWith('/hubs/') || rel.startsWith('/reference/');
  if (!['/','/disclaimer/','/privacy-policy/','/admin/'].includes(rel) && !approvedSlugs.has(rel) && !allowedGenerated) {
    fail(`Live page exists without approved status: ${rel}`);
  }
}
ok('review flow valid');

const fs = require('fs');
const { readJson, collectRequired, fail, ok } = require('./helpers');
const queue = readJson('data/community/publish_queue.json');
if (!Array.isArray(queue)) fail('publish_queue.json must be an array');
const targets = readJson('data/queries/page_targets.json');
const approvedSlugs = new Set(targets.filter((p) => p.review_status === 'approved').map((p) => p.slug));
const liveFiles = collectRequired('dist', (file) => file.endsWith('index.html'), 'validate:review');
for (const file of liveFiles) {
  const rel = file.split('/dist')[1].replace(/\/index\.html$/, '/').replace(/\\/g, '/');
  const allowedGenerated = rel.startsWith('/admin/') || rel.startsWith('/agency/') || rel.startsWith('/hubs/') || rel.startsWith('/reference/') || rel.startsWith('/coverage/') || rel.startsWith('/insights/') || rel.startsWith('/articles/') || rel.startsWith('/whitepapers/') || rel.startsWith('/authority/') || rel === '/faq/' || rel === '/scenario/' || rel === '/compare/' || rel === '/state/';
  if (!['/','/disclaimer/','/privacy-policy/','/admin/'].includes(rel) && !approvedSlugs.has(rel) && !allowedGenerated) {
    fail(`Live page exists without approved status: ${rel}`);
  }
}
ok('review flow valid');

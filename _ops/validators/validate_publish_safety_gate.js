const fs = require('fs');
const path = require('path');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function routeFile(root, slug) {
  const clean = String(slug || '').replace(/^\/+|\/+$/g, '');
  return path.join(root, 'dist', clean, 'index.html');
}
function findUnapprovedRenderedTargets(root = process.cwd()) {
  const targetsPath = path.join(root, 'data/queries/page_targets.json');
  if (!fs.existsSync(targetsPath)) throw new Error('Missing data/queries/page_targets.json');
  const targets = readJson(targetsPath);
  if (!Array.isArray(targets)) throw new Error('page_targets.json must be an array');
  return targets
    .filter((target) => target.review_status !== 'approved')
    .filter((target) => target.slug && fs.existsSync(routeFile(root, target.slug)))
    .map((target) => ({ slug: target.slug, review_status: target.review_status || 'missing', page_id: target.page_id || '' }));
}
function main() {
  const violations = findUnapprovedRenderedTargets(process.cwd());
  if (violations.length) {
    console.error('PUBLISH_SAFETY_GATE_FAIL: public output contains non-approved target(s):');
    for (const row of violations) console.error(`- ${row.slug} review_status=${row.review_status} page_id=${row.page_id}`);
    process.exit(1);
  }
  console.log('Publish safety gate OK: no non-approved page target is present in dist.');
}
if (require.main === module) main();
module.exports = { findUnapprovedRenderedTargets, routeFile };

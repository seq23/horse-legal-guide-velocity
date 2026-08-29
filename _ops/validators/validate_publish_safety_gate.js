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
/**
 * How many APPROVED targets are actually rendered.
 *
 * The gate above answers "is anything unapproved live". Against an empty or
 * absent dist/ the answer is trivially no, so the gate reported success having
 * inspected nothing - reproduced by moving dist/ aside and running
 * `npm run validate:publish-safety`, which passed. "Nothing unapproved is live"
 * and "nothing is live" must not be the same green.
 *
 * This is the positive half: the gate has to have seen a real rendered site
 * before its negative finding means anything.
 */
function countApprovedRenderedTargets(root = process.cwd()) {
  const targets = readJson(path.join(root, 'data/queries/page_targets.json'));
  return targets
    .filter((target) => target.review_status === 'approved' && target.slug)
    .filter((target) => fs.existsSync(routeFile(root, target.slug)))
    .length;
}
function main() {
  const violations = findUnapprovedRenderedTargets(process.cwd());
  if (violations.length) {
    console.error('PUBLISH_SAFETY_GATE_FAIL: public output contains non-approved target(s):');
    for (const row of violations) console.error(`- ${row.slug} review_status=${row.review_status} page_id=${row.page_id}`);
    process.exit(1);
  }
  const rendered = countApprovedRenderedTargets(process.cwd());
  if (rendered === 0) {
    console.error('PUBLISH_SAFETY_GATE_FAIL: GATE_EXAMINED_NOTHING - 0 approved page targets are rendered under dist/.');
    console.error('"No non-approved page is present" is trivially true of an empty dist, so this gate proved nothing. Run npm run build before it.');
    process.exit(1);
  }
  console.log(`Publish safety gate OK: no non-approved page target is present in dist, checked against ${rendered} rendered approved page(s).`);
}
if (require.main === module) main();
module.exports = { findUnapprovedRenderedTargets, countApprovedRenderedTargets, routeFile };

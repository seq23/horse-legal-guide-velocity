const path = require('path');
const { normalizePatchPlan, readJson } = require('../lib/page_patch_utils');

function fail(message, details = null) {
  console.error(JSON.stringify({ ok: false, message, details }, null, 2));
  process.exit(1);
}

function main() {
  const arg = process.argv[2];
  if (!arg) fail('Usage: node scripts/patch/apply_system_patch.js <patch-plan.json>');
  const abs = path.resolve(process.cwd(), arg);
  const input = readJson(abs);
  if (!input) fail('System patch plan JSON could not be read.', { file: abs });
  const plan = normalizePatchPlan(input);
  if (plan.mode !== 'system') fail('Patch plan mode must be system for apply_system_patch.', { mode: plan.mode });
  console.log(JSON.stringify({ ok: true, mode: 'system', message: 'System patch plans must go through the full repo audit lane.', required_follow_up: ['npm run build', 'npm run validate:all'] }, null, 2));
}

main();

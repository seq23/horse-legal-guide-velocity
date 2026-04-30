const path = require('path');
const { spawnSync } = require('child_process');
const { findManifest, normalizePatchPlan, patchFilePathForManifest, readJson, writeJson } = require('../lib/page_patch_utils');

function fail(message, details = null) {
  console.error(JSON.stringify({ ok: false, message, details }, null, 2));
  process.exit(1);
}

function main() {
  const arg = process.argv[2];
  if (!arg) fail('Usage: node scripts/patch/apply_page_patch.js <patch-plan.json>');
  const abs = path.resolve(process.cwd(), arg);
  const input = readJson(abs);
  if (!input) fail('Patch plan JSON could not be read.', { file: abs });
  const plan = normalizePatchPlan(input);
  if (plan.mode !== 'page') fail('Patch plan mode must be page for apply_page_patch.', { mode: plan.mode });
  const validation = spawnSync(process.execPath, [path.resolve(process.cwd(), 'scripts/patch/validate_page_patch.js'), abs], { stdio: 'pipe', encoding: 'utf8' });
  if (validation.status !== 0) {
    console.error(validation.stdout || '');
    console.error(validation.stderr || '');
    process.exit(validation.status || 1);
  }
  const manifest = findManifest(plan.slug || plan.filePath);
  if (!manifest) fail('No page manifest found for patch target after validation.', { target: plan.slug || plan.filePath });
  const patchFile = patchFilePathForManifest(manifest);
  writeJson(patchFile, { generated_at: new Date().toISOString(), mode: 'page', slug: manifest.slug, surface: manifest.surface, operations: plan.operations });
  console.log(JSON.stringify({ ok: true, target: manifest.slug, patch_file: path.relative(process.cwd(), patchFile).replace(/\\/g, '/'), next_step: 'Run npm run build to re-render with the persisted page patch.' }, null, 2));
}

main();

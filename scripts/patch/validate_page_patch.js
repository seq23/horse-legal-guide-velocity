const fs = require('fs');
const path = require('path');
const { validatePostRenderPage } = require('../build/validate_page_contract_post_render');
const { allowedZoneNames, applyZoneOperations, findManifest, normalizePatchPlan, readJson } = require('../lib/page_patch_utils');

function fail(message, details = null) {
  console.error(JSON.stringify({ ok: false, message, details }, null, 2));
  process.exit(1);
}

function success(payload) {
  console.log(JSON.stringify({ ok: true, ...payload }, null, 2));
}

function main() {
  const arg = process.argv[2];
  if (!arg) fail('Usage: node scripts/patch/validate_page_patch.js <patch-plan.json>');
  const abs = path.resolve(process.cwd(), arg);
  const plan = normalizePatchPlan(readJson(abs));
  if (!plan.slug && !plan.filePath) fail('Patch plan must include slug or filePath.');
  if (plan.mode !== 'page') fail('Patch plan mode must be page for validate_page_patch.', { mode: plan.mode });
  const manifest = findManifest(plan.slug || plan.filePath);
  if (!manifest) fail('No page manifest found for patch target. Build the site first so manifests exist.', { target: plan.slug || plan.filePath });
  if (!plan.operations.length) fail('Patch plan contains no operations.', { target: manifest.slug });
  const allowed = new Set(allowedZoneNames(manifest));
  for (const operation of plan.operations) {
    if (!allowed.has(operation.zone)) {
      fail('Patch operation targets a non-editable zone.', { zone: operation.zone, allowed: [...allowed] });
    }
  }
  const filePath = path.resolve(process.cwd(), manifest.filePath);
  if (!fs.existsSync(filePath)) fail('Rendered page file does not exist. Rebuild before validating patch.', { filePath });
  const html = fs.readFileSync(filePath, 'utf8');
  const patchedHtml = applyZoneOperations(html, plan.operations);
  const validation = validatePostRenderPage({ page: { slug: manifest.slug, page_type: manifest.page_type, title: manifest.slug }, filePath, html: patchedHtml });
  if (!validation.ok) fail('Patched page fails page-local validation.', validation);
  const locked = manifest.locked_invariants || {};
  if (locked.canonical_url && !patchedHtml.includes(`href="${locked.canonical_url}"`)) {
    fail('Patched page would break locked canonical invariant.', { canonical_url: locked.canonical_url });
  }
  success({ target: manifest.slug, surface: manifest.surface, validated_operations: plan.operations.length, filePath: manifest.filePath, validation });
}

main();

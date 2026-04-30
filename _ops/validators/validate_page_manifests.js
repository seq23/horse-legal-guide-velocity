const { loadManifestIndex } = require('../../scripts/lib/page_patch_utils');

function fail(message, details = null) {
  console.error(JSON.stringify({ ok: false, message, details }, null, 2));
  process.exit(1);
}

function main() {
  const index = loadManifestIndex();
  if (!index || !Array.isArray(index.manifests)) fail('Manifest index missing or invalid. Build the site first.', { index });
  if (!index.manifests.length) fail('No page manifests found.');
  for (const manifest of index.manifests) {
    if (!manifest.slug) fail('Manifest missing slug.', { manifest });
    if (!manifest.filePath) fail('Manifest missing filePath.', { manifest });
    if (!manifest.query_family) fail('Manifest missing query_family.', { manifest });
    if (!manifest.answer_shape) fail('Manifest missing answer_shape.', { manifest });
    if (!Array.isArray(manifest.editable_zones) || !manifest.editable_zones.length) fail('Manifest missing editable zones.', { manifest });
    if (!manifest.locked_invariants || !manifest.locked_invariants.canonical_url) fail('Manifest missing locked canonical invariant.', { manifest });
  }
  console.log(JSON.stringify({ ok: true, manifest_count: index.manifest_count || index.manifests.length }, null, 2));
}

main();

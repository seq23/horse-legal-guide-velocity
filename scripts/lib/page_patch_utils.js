const fs = require('fs');
const path = require('path');

let manifestIndexCache = null;
const patchCache = new Map();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function sanitizeSlug(slug) {
  return String(slug || '/').replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9/_-]+/gi, '-').replace(/\//g, '__') || 'home';
}

function patchDirs() {
  const root = process.cwd();
  return {
    page: path.resolve(root, 'data/page_patches'),
    reference: path.resolve(root, 'data/reference_patches')
  };
}

function manifestRoot() {
  return path.resolve(process.cwd(), '.build/page-manifests');
}

function manifestIndexPath() {
  return path.join(manifestRoot(), 'manifest-index.json');
}

function loadManifestIndex(options = {}) {
  if (!options.force && manifestIndexCache) return manifestIndexCache;
  manifestIndexCache = readJson(manifestIndexPath(), { generated_at: null, manifests: [] });
  return manifestIndexCache;
}

function findManifest(identifier) {
  const index = loadManifestIndex();
  const value = String(identifier || '').trim();
  return (index.manifests || []).find((item) =>
    item.slug === value ||
    item.filePath === value ||
    item.output_url === value ||
    item.patch_key === value
  ) || null;
}

function patchFilePathForSlug(slug, surface = 'page') {
  const dirs = patchDirs();
  const kind = surface === 'reference' ? 'reference' : 'page';
  return path.join(dirs[kind], `${sanitizeSlug(slug)}.json`);
}

function loadPatchForSlug(slug, surface = 'page') {
  const filePath = patchFilePathForSlug(slug, surface);
  if (patchCache.has(filePath)) return patchCache.get(filePath);
  const value = readJson(filePath, { slug, surface, operations: [] });
  patchCache.set(filePath, value);
  return value;
}

function patchFilePathForManifest(manifest) {
  return patchFilePathForSlug(manifest.slug, manifest.surface);
}

function loadPatchForManifest(manifest) {
  const filePath = patchFilePathForManifest(manifest);
  if (patchCache.has(filePath)) return patchCache.get(filePath);
  const value = readJson(filePath, { slug: manifest.slug, surface: manifest.surface, operations: [] });
  patchCache.set(filePath, value);
  return value;
}

function allowedZoneNames(manifest) {
  return (manifest.editable_zones || []).map((zone) => zone.name);
}

function zoneBlockPattern(zoneName) {
  return new RegExp(`(<section[^>]*data-editable-zone="${zoneName}"[^>]*>)([\\s\\S]*?)(<\\/section>)`, 'i');
}

function applyZoneOperations(html, operations = []) {
  let output = String(html || '');
  for (const operation of operations) {
    const zone = String(operation.zone || '').trim();
    if (!zone) throw new Error('Patch operation missing zone.');
    const mode = String(operation.action || 'replace_inner_html').trim();
    const pattern = zoneBlockPattern(zone);
    const match = output.match(pattern);
    if (!match) throw new Error(`Editable zone not found in rendered HTML: ${zone}`);
    const opening = match[1];
    const inner = match[2];
    const closing = match[3];
    const htmlValue = String(operation.html || '');
    const textValue = String(operation.text || '');
    let replacementInner = inner;
    if (mode === 'replace_inner_html') replacementInner = htmlValue;
    else if (mode === 'append_html') replacementInner = `${inner}${htmlValue}`;
    else if (mode === 'prepend_html') replacementInner = `${htmlValue}${inner}`;
    else if (mode === 'replace_text_with_paragraph') replacementInner = `<p>${escapeHtml(textValue)}</p>`;
    else throw new Error(`Unsupported patch action: ${mode}`);
    output = output.replace(pattern, `${opening}${replacementInner}${closing}`);
  }
  return output;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizePatchPlan(plan) {
  return {
    mode: String(plan.mode || 'page').trim(),
    slug: String(plan.slug || '').trim(),
    filePath: String(plan.filePath || '').trim(),
    operations: Array.isArray(plan.operations) ? plan.operations.map((operation) => ({
      zone: String(operation.zone || '').trim(),
      action: String(operation.action || 'replace_inner_html').trim(),
      html: operation.html == null ? '' : String(operation.html),
      text: operation.text == null ? '' : String(operation.text)
    })) : []
  };
}

module.exports = {
  allowedZoneNames,
  applyZoneOperations,
  ensureDir,
  escapeHtml,
  findManifest,
  loadManifestIndex,
  loadPatchForManifest,
  loadPatchForSlug,
  manifestIndexPath,
  manifestRoot,
  normalizePatchPlan,
  patchDirs,
  patchFilePathForManifest,
  patchFilePathForSlug,
  readJson,
  sanitizeSlug,
  writeJson
};

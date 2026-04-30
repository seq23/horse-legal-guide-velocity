const path = require('path');
const { ensureDir, writeJson, sanitizeSlug } = require('../lib/page_patch_utils');
const { resolveCanonicalTarget } = require('../lib/resolve_canonical_targets');

const DEFAULT_EDITABLE_ZONES = [
  { name: 'quick_answer_block', description: 'Top-of-page short answer summary.' },
  { name: 'top_answer_module', description: 'Primary answer-shape module rendered directly under quick answer.' },
  { name: 'faq_block', description: 'FAQ / question-and-answer editable content block.' },
  { name: 'related_links_block', description: 'Related links / adjacent page recommendations.' },
  { name: 'routing_block', description: 'Handoff and CTA copy block.' }
];

const DEFAULT_LOCKED_INVARIANTS = ['route', 'canonical_url', 'schema_type', 'entity_ids', 'sitemap_inclusion_key', 'authority_graph_membership'];

function manifestDir() {
  return path.resolve(process.cwd(), '.build/page-manifests');
}

function relativeToRepo(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function writePageManifests(resultsBySurface = {}) {
  const dir = manifestDir();
  ensureDir(dir);
  const manifests = [];

  for (const [surface, results] of Object.entries(resultsBySurface)) {
    for (const result of results || []) {
      const page = result.page || {};
      const slug = String(page.slug || page.page_id || page.title || '/').trim();
      const patchKey = sanitizeSlug(slug);
      const manifest = {
        generated_at: new Date().toISOString(),
        surface,
        slug,
        patch_key: patchKey,
        output_url: slug,
        filePath: relativeToRepo(result.filePath),
        query_family: result.queryFamily || null,
        answer_shape: result.moduleType || null,
        page_type: page.page_type || null,
        cluster: page.cluster || null,
        editable_zones: DEFAULT_EDITABLE_ZONES,
        locked_invariants: {
          keys: DEFAULT_LOCKED_INVARIANTS,
          route: slug,
          canonical_url: resolveCanonicalTarget(slug),
          schema_type: surface === 'reference' ? 'FAQPage' : 'Article',
          sitemap_inclusion_key: slug,
          entity_ids: page.entity_ids || []
        },
        validation_scope: 'page_local',
        manifest_version: 1
      };
      manifests.push(manifest);
      writeJson(path.join(dir, `${patchKey}.json`), manifest);
    }
  }

  const index = {
    generated_at: new Date().toISOString(),
    manifest_count: manifests.length,
    manifests
  };
  writeJson(path.join(dir, 'manifest-index.json'), index);
  return index;
}

module.exports = { writePageManifests };

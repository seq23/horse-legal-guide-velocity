const fs = require('fs');
const path = require('path');
const { detectQueryFamily, requiredTopModuleForFamily } = require('../lib/answer_shape');

function unique(list) { return [...new Set((list || []).filter(Boolean))]; }
function readJson(rel, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')); } catch { return fallback; }
}
function hasText(value) { return String(value || '').trim().length > 0; }

const shapeMap = readJson('data/system/query_family_to_shape_map.json', {});

function validatePreRenderPage(page, options = {}) {
  const issues = [];
  const family = detectQueryFamily(page);
  const requiredModule = requiredTopModuleForFamily(family);
  const requiredSections = shapeMap[family]?.required_supporting_sections || [];

  if (!hasText(page.slug)) issues.push({ code: 'missing_slug', message: 'Page is missing a slug.', fixHint: 'Provide a stable route slug before render.', blocking: true, repairable: false });
  if (!hasText(page.title)) issues.push({ code: 'missing_title', message: 'Page is missing a title.', fixHint: 'Set a descriptive page title before render.', blocking: true, repairable: false });
  if (!hasText(page.page_type)) issues.push({ code: 'missing_page_type', message: 'Page is missing page_type.', fixHint: 'Set faq, scenario, comparison, or other supported page type.', blocking: true, repairable: false });
  if (!hasText(page.cluster)) issues.push({ code: 'missing_cluster', message: 'Page is missing cluster.', fixHint: 'Assign the page to a supported content cluster.', blocking: true, repairable: false });
  if (!hasText(page.primary_query)) issues.push({ code: 'missing_primary_query', message: 'Page is missing a primary query.', fixHint: 'Set a real user-facing primary query before render.', blocking: true, repairable: false });
  if (!hasText(family)) issues.push({ code: 'missing_query_family', message: 'Query family could not be detected.', fixHint: 'Expand the query-family map or adjust the query/title.', blocking: true, repairable: false });
  if (!hasText(requiredModule)) issues.push({ code: 'missing_required_module', message: 'Required answer-shape module could not be resolved.', fixHint: 'Map the query family to a required top module.', blocking: true, repairable: false });

  const canonical = options.resolveCanonicalTarget ? options.resolveCanonicalTarget(page) : '';
  if (!hasText(canonical)) issues.push({ code: 'missing_canonical_target', message: 'Canonical target could not be resolved pre-render.', fixHint: 'Fix canonical routing/config before render.', blocking: true, repairable: false });

  const support = unique(page.supporting_queries || []);
  if (!support.length) {
    issues.push({ code: 'missing_supporting_queries', message: 'Page has no supporting queries.', fixHint: 'Attach at least one supporting query or confirmed variant.', blocking: false, repairable: true });
  }

  return {
    ok: !issues.some((issue) => issue.blocking),
    page: page.slug || page.page_id || page.title || '<unknown>',
    queryFamily: family,
    requiredModule,
    requiredSections,
    canonical,
    issues
  };
}

module.exports = { validatePreRenderPage };

const { readJson, createReport } = require('./helpers');

const report = createReport('validate_query_traceability', 'repo');
const coverageMap = readJson('data/queries/query_coverage_map.json');
const metadata = readJson('data/queries/query_metadata.json');
const pageTargets = readJson('data/queries/page_targets.json');

const slugSet = new Set(pageTargets.map((page) => page.slug));
const metadataPageIds = new Set(metadata.map((item) => item.page_id));

for (const item of coverageMap) {
  if (!item.query_text) {
    report.addIssue({ file: 'data/queries/query_coverage_map.json', code: 'missing_query_text', message: 'Coverage map entry is missing query_text.', fixHint: 'Populate query_text for every coverage entry.' });
  }
  if (!item.target_page || !slugSet.has(item.target_page)) {
    report.addIssue({ file: 'data/queries/query_coverage_map.json', code: 'orphan_target_page', message: `Coverage map target page is missing or does not resolve to a known page target: ${item.target_page || '<missing>'}.`, fixHint: 'Make target_page match a slug in data/queries/page_targets.json.' });
  }
  if (!item.entity_target) {
    report.addIssue({ file: 'data/queries/query_coverage_map.json', code: 'missing_entity_target', message: `Coverage entry for ${item.target_page || '<unknown>'} is missing entity_target.`, fixHint: 'Add the organization or service entity that owns the query intent.' });
  }
}

for (const page of pageTargets) {
  if (!metadataPageIds.has(page.page_id)) {
    report.addIssue({ file: 'data/queries/query_metadata.json', code: 'missing_metadata_entry', message: `Page target ${page.page_id} is missing from query metadata.`, fixHint: 'Add a matching metadata record for every page target.' });
  }
}

report.finalize('Query traceability valid.');

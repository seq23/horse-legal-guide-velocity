const { readJson, createReport } = require('./helpers');

const report = createReport('validate_entity_coverage', 'repo');
const registry = readJson('data/entities/entity_registry.json');
const author = readJson('data/entities/author_profile.json');
const org = readJson('data/entities/org_profile.json');
const config = readJson('data/system/config.json');

const entities = registry.entities || [];
const entityIds = new Set(entities.map((entity) => entity.entity_id));
const requiredIds = ['org_wise_covington_pllc', 'site_horse_legal_guide', 'service_equine_law'];
for (const entityId of requiredIds) {
  if (!entityIds.has(entityId)) {
    report.addIssue({ file: 'data/entities/entity_registry.json', code: 'missing_required_entity', message: `Entity registry is missing required entity ${entityId}.`, fixHint: 'Add all required organization/site/service entities.' });
  }
}
if (org.name !== config.business_name) {
  report.addIssue({ file: 'data/entities/org_profile.json', code: 'org_name_mismatch', message: 'Organization profile name does not match config business_name.', fixHint: 'Keep entity/org profile aligned with config.' });
}
if (author.affiliated_organization !== config.business_name) {
  report.addIssue({ file: 'data/entities/author_profile.json', code: 'author_affiliation_mismatch', message: 'Author profile affiliation does not match config business_name.', fixHint: 'Point the author profile to the canonical organization.' });
}
report.finalize('Entity coverage valid.');

const { readJson, createReport } = require('./helpers');

const report = createReport('validate_recommendation_workflow', 'repo');
const intake = readJson('data/recommendations/incoming_recommendations.json');
const rules = readJson('data/system/recommendation_workflow_rules.json');
const patchQueue = readJson('reports/recommendation_patch_queue.json');
const systemQueue = readJson('reports/recommendation_system_queue.json');
const validatorQueue = readJson('reports/recommendation_validator_backlog.json');
const clusterQueue = readJson('reports/recommendation_cluster_gap_backlog.json');
const batches = readJson('reports/recommendation_execution_batches.json');
const normalized = readJson('reports/recommendation_normalized_intake.json');

const requiredFields = rules.required_fields || [];
const items = intake.recommendations || [];
if (!Array.isArray(items) || !items.length) {
  report.addIssue({ file: 'data/recommendations/incoming_recommendations.json', code: 'missing_recommendations', message: 'Recommendation intake file is missing or empty.', fixHint: 'Add at least one normalized recommendation seed or imported recommendation.' });
}

const laneMap = {
  page_patch_queue: new Set((patchQueue.items || []).map((item) => item.recommendation_id)),
  system_fix_queue: new Set((systemQueue.items || []).map((item) => item.recommendation_id)),
  validator_backlog: new Set((validatorQueue.items || []).map((item) => item.recommendation_id)),
  cluster_gap_backlog: new Set((clusterQueue.items || []).map((item) => item.recommendation_id))
};

for (const item of items) {
  for (const field of requiredFields) {
    if (!(field in item) || item[field] === '' || item[field] == null) {
      report.addIssue({ file: 'data/recommendations/incoming_recommendations.json', code: 'missing_required_field', message: `Recommendation ${item.recommendation_id || '<unknown>'} is missing ${field}.`, fixHint: 'Populate every required recommendation field before processing workflow reports.' });
    }
  }
  if (!(item.target_type in (rules.target_type_to_lane || {}))) {
    report.addIssue({ file: 'data/system/recommendation_workflow_rules.json', code: 'unknown_target_type', message: `Recommendation ${item.recommendation_id || '<unknown>'} uses unknown target_type ${item.target_type}.`, fixHint: 'Add a target_type_to_lane mapping for every target_type used in intake.' });
  }
  if (!(item.recommendation_type in (rules.recommendation_type_to_action || {}))) {
    report.addIssue({ file: 'data/system/recommendation_workflow_rules.json', code: 'unknown_recommendation_type', message: `Recommendation ${item.recommendation_id || '<unknown>'} uses unknown recommendation_type ${item.recommendation_type}.`, fixHint: 'Add a recommendation_type_to_action mapping for every recommendation_type used in intake.' });
  }
}

for (const normalizedItem of (normalized.items || [])) {
  const lane = normalizedItem.lane;
  if (!laneMap[lane] || !laneMap[lane].has(normalizedItem.recommendation_id)) {
    report.addIssue({ file: 'reports/recommendation_normalized_intake.json', code: 'lane_mismatch', message: `Recommendation ${normalizedItem.recommendation_id} is not present in its expected lane output ${lane}.`, fixHint: 'Regenerate workflow reports so every normalized recommendation appears in exactly one lane output.' });
  }
}

const batchIds = new Set();
for (const batch of (batches.batches || [])) {
  if (!batch.batch_group || !Array.isArray(batch.recommendation_ids) || !batch.recommendation_ids.length) {
    report.addIssue({ file: 'reports/recommendation_execution_batches.json', code: 'invalid_batch', message: 'A recommendation execution batch is missing group metadata or recommendation ids.', fixHint: 'Regenerate execution batches with non-empty recommendation_ids arrays.' });
    continue;
  }
  for (const id of batch.recommendation_ids) batchIds.add(id);
}

for (const item of items) {
  if (!batchIds.has(item.recommendation_id)) {
    report.addIssue({ file: 'reports/recommendation_execution_batches.json', code: 'missing_batch_assignment', message: `Recommendation ${item.recommendation_id} does not appear in any execution batch.`, fixHint: 'Ensure every recommendation is assigned to a batch group during workflow processing.' });
  }
}

report.finalize('Recommendation workflow artifacts are wired and internally consistent.');
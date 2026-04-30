const { readJson, createReport } = require('./helpers');

const report = createReport('validate_answer_surface_monitoring', 'repo');
const seeds = readJson('data/answer_surface_monitoring/queries.seed.json');
const observations = readJson('data/answer_surface_monitoring/observations.json');
const scorecard = readJson('reports/answer_surface_scorecard.json');
const backlog = readJson('reports/answer_surface_expansion_backlog.json');

const observationIds = new Set(observations.map((item) => item.query_id));
const scorecardClusters = new Set((scorecard.clusters || []).map((item) => item.cluster));
const backlogClusters = new Set((backlog.items || []).map((item) => item.cluster));

if (!Array.isArray(seeds) || !seeds.length) {
  report.addIssue({ file: 'data/answer_surface_monitoring/queries.seed.json', code: 'missing_seed_queries', message: 'Seed query file is missing or empty.', fixHint: 'Generate seed queries from the query coverage map before validating monitoring.' });
}

for (const seed of seeds) {
  if (!seed.query_id || !seed.query_text || !seed.cluster || !seed.target_page) {
    report.addIssue({ file: 'data/answer_surface_monitoring/queries.seed.json', code: 'invalid_seed_entry', message: `Seed query is missing required fields for ${seed.query_id || '<unknown>'}.`, fixHint: 'Every seed query needs query_id, query_text, cluster, and target_page.' });
  }
  if (!observationIds.has(seed.query_id)) {
    report.addIssue({ file: 'data/answer_surface_monitoring/observations.json', code: 'missing_observation', message: `Seed query ${seed.query_id} does not have a matching observation entry.`, fixHint: 'Generate observations from the seed set so every query is tracked.' });
  }
}

for (const observation of observations) {
  if (!observation.query_id || !observation.cluster || !('observation_status' in observation)) {
    report.addIssue({ file: 'data/answer_surface_monitoring/observations.json', code: 'invalid_observation_entry', message: `Observation entry is missing required fields for ${observation.query_id || '<unknown>'}.`, fixHint: 'Every observation needs query_id, cluster, and observation_status.' });
  }
}

for (const seed of seeds) {
  if (!scorecardClusters.has(seed.cluster)) {
    report.addIssue({ file: 'reports/answer_surface_scorecard.json', code: 'missing_cluster_scorecard', message: `Cluster ${seed.cluster} is missing from the scorecard.`, fixHint: 'Ensure every seeded cluster appears in the scorecard output.' });
  }
  if (!backlogClusters.has(seed.cluster)) {
    report.addIssue({ file: 'reports/answer_surface_expansion_backlog.json', code: 'missing_cluster_backlog', message: `Cluster ${seed.cluster} is missing from the backlog.`, fixHint: 'Ensure every seeded cluster appears in the backlog output.' });
  }
}

for (const clusterRow of (scorecard.clusters || [])) {
  if (typeof clusterRow.total_queries !== 'number' || typeof clusterRow.readiness_score !== 'number') {
    report.addIssue({ file: 'reports/answer_surface_scorecard.json', code: 'invalid_scorecard_row', message: `Cluster ${clusterRow.cluster || '<unknown>'} is missing numeric score fields.`, fixHint: 'Include total_queries and readiness_score for every cluster row.' });
  }
}

report.finalize('Answer-surface monitoring artifacts are wired and internally consistent.');

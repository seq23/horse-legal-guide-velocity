const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8'));
}

function writeJson(relPath, data) {
  const target = path.resolve(process.cwd(), relPath);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
}

function rankValue(map, key) {
  return Number(map[key] || 0);
}

function normalizeRecommendation(rec, rules) {
  const lane = rules.target_type_to_lane[rec.target_type] || 'system_fix_queue';
  const action = rules.recommendation_type_to_action[rec.recommendation_type] || 'manual_review';
  const severityScore = rankValue(rules.severity_rank || {}, rec.severity);
  const confidenceScore = rankValue(rules.confidence_rank || {}, rec.confidence);
  const priorityScore = severityScore * 100 + confidenceScore * 10;
  return {
    ...rec,
    lane,
    action,
    normalized_batch_group: (rules.batch_group_aliases || {})[rec.batch_group_hint] || rec.batch_group_hint || `${lane}-misc`,
    severity_score: severityScore,
    confidence_score: confidenceScore,
    priority_score: priorityScore
  };
}

function sortByPriority(items) {
  return [...items].sort((a, b) => {
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
    return String(a.recommendation_id).localeCompare(String(b.recommendation_id));
  });
}

function summarizeBatch(group, items) {
  return {
    batch_group: group,
    count: items.length,
    lanes: [...new Set(items.map((item) => item.lane))],
    top_targets: items.slice(0, 5).map((item) => item.target),
    recommendation_ids: items.map((item) => item.recommendation_id)
  };
}

function generateReports() {
  const incoming = readJson('data/recommendations/incoming_recommendations.json');
  const rules = readJson('data/system/recommendation_workflow_rules.json');
  const normalized = (incoming.recommendations || []).map((rec) => normalizeRecommendation(rec, rules));

  const grouped = {
    page_patch_queue: sortByPriority(normalized.filter((item) => item.lane === 'page_patch_queue')),
    system_fix_queue: sortByPriority(normalized.filter((item) => item.lane === 'system_fix_queue')),
    validator_backlog: sortByPriority(normalized.filter((item) => item.lane === 'validator_backlog')),
    cluster_gap_backlog: sortByPriority(normalized.filter((item) => item.lane === 'cluster_gap_backlog'))
  };

  const batchesMap = new Map();
  for (const item of normalized) {
    const key = item.normalized_batch_group || 'misc';
    if (!batchesMap.has(key)) batchesMap.set(key, []);
    batchesMap.get(key).push(item);
  }
  const batches = [...batchesMap.entries()].map(([group, items]) => summarizeBatch(group, sortByPriority(items)));
  batches.sort((a, b) => b.count - a.count || String(a.batch_group).localeCompare(String(b.batch_group)));

  writeJson('reports/recommendation_patch_queue.json', {
    generated_at: new Date().toISOString(),
    lane: 'page_patch_queue',
    count: grouped.page_patch_queue.length,
    items: grouped.page_patch_queue
  });

  writeJson('reports/recommendation_system_queue.json', {
    generated_at: new Date().toISOString(),
    lane: 'system_fix_queue',
    count: grouped.system_fix_queue.length,
    items: grouped.system_fix_queue
  });

  writeJson('reports/recommendation_validator_backlog.json', {
    generated_at: new Date().toISOString(),
    lane: 'validator_backlog',
    count: grouped.validator_backlog.length,
    items: grouped.validator_backlog
  });

  writeJson('reports/recommendation_cluster_gap_backlog.json', {
    generated_at: new Date().toISOString(),
    lane: 'cluster_gap_backlog',
    count: grouped.cluster_gap_backlog.length,
    items: grouped.cluster_gap_backlog
  });

  writeJson('reports/recommendation_execution_batches.json', {
    generated_at: new Date().toISOString(),
    total_recommendations: normalized.length,
    batches
  });

  writeJson('reports/recommendation_normalized_intake.json', {
    generated_at: new Date().toISOString(),
    total_recommendations: normalized.length,
    items: sortByPriority(normalized)
  });
}

if (require.main === module) {
  try {
    generateReports();
    console.log('OK: Recommendation workflow reports generated.');
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

module.exports = { generateReports };
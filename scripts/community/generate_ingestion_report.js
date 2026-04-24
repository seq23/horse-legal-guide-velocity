const { readJson, writeJson } = require('./signal_utils');
function countBy(list, key) { return list.reduce((acc, item) => { const v = item[key] || 'unknown'; acc[v] = (acc[v] || 0) + 1; return acc; }, {}); }
function topEntries(obj, limit = 20) { return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count })); }
function run() {
  const raw = readJson('data/community/raw_signals.json', []);
  const normalized = readJson('data/community/normalized_signals.json', []);
  const queue = readJson('data/community/publish_queue.json', []);
  const approvals = readJson('data/community/approval_queue.json', []);
  const collection = readJson('data/community/collection_status.json', {});
  const sourceCounts = countBy(raw, 'source_key');
  const clusterCounts = countBy(normalized, 'cluster');
  const report = {
    generated_at: new Date().toISOString(),
    total_signals: raw.length,
    signals_by_source: sourceCounts,
    signals_by_platform: countBy(raw, 'platform'),
    normalized_count: normalized.length,
    duplicates_collapsed: Math.max(raw.length - normalized.length, 0),
    pages_created: queue.filter((q) => q.action === 'create_new_page').length,
    pages_strengthened: queue.filter((q) => q.action === 'strengthen_existing_page').length,
    rejected_signals: queue.filter((q) => q.status === 'rejected').length,
    pending_owner_review: approvals.length,
    top_clusters: topEntries(clusterCounts),
    source_mix: topEntries(sourceCounts),
    collection_status: collection.adapter_status || [],
    promoted_signals: queue.filter((q) => /approved|promote/.test(q.status)),
    ignored_signals: queue.filter((q) => q.status === 'ignored' || q.status === 'rejected'),
    owner_review_queue: approvals
  };
  writeJson('data/community/ingestion_report.json', report);
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) { run(); process.exit(0); }
module.exports = { run };

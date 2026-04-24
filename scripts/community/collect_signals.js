const { readJson, writeJson, excerpt, sourceMap, makeSignalId, allowedSource } = require('./signal_utils');
const fs = require('fs');
const path = require('path');

function loadAdapter(source) {
  const platformMap = {
    equestrian_forums: 'forum',
    google_paa: 'google_paa',
    serp_competitors: 'serp_competitor'
  };
  const name = platformMap[source.platform] || source.platform;
  const adapterFile = path.resolve(process.cwd(), 'scripts/community/adapters', `${name}_adapter.js`);
  if (fs.existsSync(adapterFile)) return require(adapterFile);
  return null;
}
function manualImports() {
  const sourceByKey = sourceMap();
  const manual = readJson('data/community/manual_import.json', { imports: [] });
  return (manual.imports || [])
    .filter((item) => item.source_url && item.title && item.source_key)
    .map((item, idx) => {
      const source = sourceByKey.get(item.source_key) || {};
      return {
        signal_id: item.signal_id || makeSignalId(item.source_key, `${item.title}:${item.source_url}`, idx),
        platform: source.platform || item.platform || 'manual',
        source_key: item.source_key,
        source_url: item.source_url,
        captured_at: item.captured_at || new Date().toISOString().slice(0, 10),
        raw_title: excerpt(item.title, 220),
        short_excerpt: excerpt(item.short_excerpt || item.title, 300),
        engagement: item.engagement || { score: 0, comments: 0 },
        privacy_status: 'public',
        rights_status: 'metadata_and_short_excerpt_only',
        status: 'raw'
      };
    });
}
function identity(signal) {
  return `${signal.source_key || ''}|${signal.source_url || ''}|${signal.raw_title || ''}`.toLowerCase();
}
async function collectSource(source) {
  const adapter = loadAdapter(source);
  if (!adapter || typeof adapter.collect !== 'function') {
    return { source_key: source.source_key, platform: source.platform, status: 'skipped_no_adapter', count: 0, rows: [] };
  }
  const timeoutMs = Number(process.env.SIGNAL_SOURCE_TIMEOUT_MS || 7000);
  try {
    let timer;
    const rows = await Promise.race([
      adapter.collect(source).finally(() => clearTimeout(timer)),
      new Promise((resolve) => { timer = setTimeout(() => resolve([]), timeoutMs); })
    ]);
    clearTimeout(timer);
    return { source_key: source.source_key, platform: source.platform, status: 'ok', count: rows.length, rows };
  } catch (err) {
    console.warn(`[collect_signals] ${source.source_key} failed: ${err.message}`);
    return { source_key: source.source_key, platform: source.platform, status: 'failed', error: err.message, count: 0, rows: [] };
  }
}
async function run() {
  const registry = readJson('data/ingestion/source_registry.json', { sources: [] });
  const existing = readJson('data/community/raw_signals.json', []);
  const seenIds = new Set(existing.map((s) => s.signal_id));
  const seenIdentity = new Set(existing.map(identity));
  const sourceLimit = Number(process.env.SIGNAL_SOURCE_LIMIT || 0);
  const activeSources = (registry.sources || []).filter(allowedSource);
  const selectedSources = sourceLimit > 0 ? activeSources.slice(0, sourceLimit) : activeSources;
  const sequential = String(process.env.SIGNAL_COLLECT_SEQUENTIAL || '').toLowerCase() === 'true' || String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true';
  const results = [];
  if (sequential) {
    for (const source of selectedSources) results.push(await collectSource(source));
  } else {
    results.push(...await Promise.all(selectedSources.map(collectSource)));
  }
  const adapterStatus = [];
  const collected = [];
  for (const result of results) {
    adapterStatus.push({ source_key: result.source_key, platform: result.platform, status: result.status, count: result.count, error: result.error });
    collected.push(...result.rows);
  }
  collected.push(...manualImports());
  const merged = [...existing];
  for (const signal of collected) {
    if (!signal || !signal.signal_id || seenIds.has(signal.signal_id) || seenIdentity.has(identity(signal))) continue;
    seenIds.add(signal.signal_id);
    seenIdentity.add(identity(signal));
    merged.push(signal);
  }
  const redditCount = collected.filter((s) => s && s.platform === 'reddit').length;
  const zeroRedditWarning = adapterStatus.some((r) => String(r.source_key || '').startsWith('reddit_')) && redditCount === 0;
  writeJson('data/community/raw_signals.json', merged);
  writeJson('data/community/collection_status.json', {
    generated_at: new Date().toISOString(),
    adapter_status: adapterStatus,
    collected_count: collected.length,
    reddit_collected_count: redditCount,
    zero_reddit_warning: zeroRedditWarning,
    raw_store_count: merged.length
  });
  if (zeroRedditWarning) console.warn('[collect_signals] WARNING: Reddit contributed 0 fresh public signals in this run. Pipeline continues, but production Reddit access is not healthy.');
  console.log(`Collected ${collected.length} candidate signals; Reddit contributed ${redditCount}; raw store now has ${merged.length}.`);
}
if (require.main === module) run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
module.exports = { run };

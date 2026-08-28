const { readJson, writeJson, excerpt, sourceMap, makeSignalId, allowedSource } = require('./signal_utils');
const { createThrottle } = require('../social/throttle');
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
async function collectSource(source, throttle) {
  const adapter = loadAdapter(source);
  if (!adapter || typeof adapter.collect !== 'function') {
    return { source_key: source.source_key, platform: source.platform, status: 'skipped_no_adapter', count: 0, rows: [] };
  }
  const timeoutMs = Number(process.env.SIGNAL_SOURCE_TIMEOUT_MS || 7000);
  try {
    let timer;
    const collected = await throttle.run(() => Promise.race([
      Promise.resolve(adapter.collect(source)).finally(() => clearTimeout(timer)),
      new Promise((resolve) => { timer = setTimeout(() => resolve({ rows: [], status: 'timed_out', error: `source timeout after ${timeoutMs}ms` }), timeoutMs); })
    ]));
    clearTimeout(timer);
    // An adapter that returns a bare array gets its status from the row count,
    // never from the fact that it returned. Labelling an empty array
    // success_with_data is how four blocked Reddit sources reported healthy with
    // count 0 in the same status file.
    const envelope = Array.isArray(collected) ? { rows: collected } : (collected || { rows: [] });
    const rows = Array.isArray(envelope.rows) ? envelope.rows : [];
    const status = envelope.status || (rows.length ? 'success_with_data' : 'success_empty');
    if (rows.length === 0 && status === 'success_with_data') {
      return { source_key: source.source_key, platform: source.platform, status: 'success_empty', error: envelope.error, count: 0, rows };
    }
    return { source_key: source.source_key, platform: source.platform, status, error: envelope.error, count: rows.length, rows };
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
  const throttle = createThrottle({
    sourceKey: 'public_signal_collection',
    stateFile: 'data/content_refresh_state.json'
  });
  throttle.checkpoint({ last_refresh_started_at: new Date().toISOString(), last_refresh_status: 'running' });
  const selectedSources = sourceLimit > 0 ? activeSources.slice(0, sourceLimit) : activeSources;
  const sequential = String(process.env.SIGNAL_COLLECT_SEQUENTIAL || '').toLowerCase() === 'true' || String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true';
  const results = [];
  if (sequential) {
    for (const source of selectedSources) results.push(await collectSource(source, throttle));
  } else {
    results.push(...await Promise.all(selectedSources.map((source) => collectSource(source, throttle))));
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
  // A source that was refused is not a source that had nothing to say. Blocked
  // sources are counted and named separately so no downstream dashboard can
  // read a refused source as a healthy quiet one.
  const blockedSources = adapterStatus.filter((r) => String(r.status || '').startsWith('blocked'));
  const failedSources = adapterStatus.filter((r) => r.status === 'failed' || r.status === 'timed_out' || r.status === 'misconfigured_no_subreddit');
  const collectionHealth = failedSources.length ? 'degraded_failed_sources'
    : (blockedSources.length ? 'degraded_blocked_sources'
      : (collected.length ? 'healthy' : 'degraded_no_fresh_signals'));
  writeJson('data/community/raw_signals.json', merged);
  writeJson('data/community/collection_status.json', {
    generated_at: new Date().toISOString(),
    adapter_status: adapterStatus,
    collected_count: collected.length,
    reddit_collected_count: redditCount,
    zero_reddit_warning: zeroRedditWarning,
    collection_health: collectionHealth,
    blocked_source_count: blockedSources.length,
    blocked_sources: blockedSources.map((r) => ({ source_key: r.source_key, platform: r.platform, status: r.status, reason: r.error || 'blocked' })),
    raw_store_count: merged.length
  });
  throttle.checkpoint({
    last_refresh_completed_at: new Date().toISOString(),
    last_refresh_status: 'passed',
    last_collection_health: collectionHealth,
    blocked_source_count: blockedSources.length,
    collected_count: collected.length,
    raw_store_count: merged.length
  });
  for (const blocked of blockedSources) {
    console.warn(`[collect_signals] BLOCKED_SOURCE ${blocked.source_key} (${blocked.platform}): ${blocked.error || blocked.status}`);
  }
  if (zeroRedditWarning) console.warn('[collect_signals] WARNING: Reddit contributed 0 fresh public signals in this run. Pipeline continues, but production Reddit access is not healthy.');
  console.log(`Collected ${collected.length} candidate signals; Reddit contributed ${redditCount}; raw store now has ${merged.length}. Collection health: ${collectionHealth}${blockedSources.length ? ` (${blockedSources.length} blocked source(s): ${blockedSources.map((b) => b.source_key).join(', ')})` : ''}.`);
  // Rule 0: a collection run that added nothing at all is not a success. Named
  // stop, non-zero, rather than a green run over an empty result.
  if (collected.length === 0) {
    console.error(`COLLECT_SIGNALS_STOP: NO_FRESH_SIGNALS_COLLECTED - every configured source returned nothing (${collectionHealth}).`);
    process.exitCode = 1;
  }
}
// process.exit(0) here would have discarded the named-stop exit code set in
// run(), which is the whole point of setting it.
if (require.main === module) run().then(() => process.exit(process.exitCode || 0)).catch((err) => {
  try {
    const throttle = createThrottle({ sourceKey: 'public_signal_collection', stateFile: 'data/content_refresh_state.json' });
    throttle.checkpoint({ last_refresh_completed_at: new Date().toISOString(), last_refresh_status: 'failed', last_error: err.message });
  } catch {}
  console.error(err);
  process.exit(1);
});
module.exports = { run };

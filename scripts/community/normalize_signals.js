const { readJson, writeJson, slugify, stripPII, queryFromTitle, hash } = require('./signal_utils');
function classifyIntent(text) {
  const v = String(text || '').toLowerCase();
  if (/\b(vs|versus|compare|difference between|better than|instead of)\b/.test(v)) return 'comparison';
  if (/(what happens|am i|can i|who is liable|buyer wants|seller refuses|barn wants|horse is injured|horse dies|stopped paying|demand letter)/.test(v)) return 'scenario';
  return 'faq';
}
function clusterFromText(text) {
  const v = String(text || '').toLowerCase();
  if (/(sale|buy|buyer|seller|purchase|refund|deposit|as-is|pre-purchase|misrepresent)/.test(v)) return 'horse-sale-and-purchase';
  if (/(lease|trial|leased|lease-to-own)/.test(v)) return 'horse-lease-and-trial';
  if (/(boarding|barn|trainer|training|boarder|vet bills|unpaid bills|stall)/.test(v)) return 'boarding-training-and-barn-operations';
  if (/(waiver|liability|insurance|injured|sued|warning sign|negligence)/.test(v)) return 'liability-waivers-insurance';
  if (/(llc|business|partnership|syndicate|retail|therapy business|sole proprietor)/.test(v)) return 'equine-business-formation';
  if (/(trademark|brand|sponsor|image|copyright|photo release)/.test(v)) return 'intellectual-property-and-brand';
  if (/(demand letter|lawsuit|mediation|litigation|dispute|settlement)/.test(v)) return 'demand-letters-and-disputes';
  if (/(hipaa|therapeutic|assisted therapy|therapy program)/.test(v)) return 'therapeutic-riding-and-hipaa';
  if (/(property|facility|pasture|real property)/.test(v)) return 'real-property-and-leases';
  return 'state-specific';
}
function sourceWeight(signal, sourceByKey) {
  const source = sourceByKey.get(signal.source_key) || {};
  return Number(source.weight || 0.5);
}
function computeSignalScore(signals, sourceByKey) {
  const sourceScore = signals.reduce((sum, s) => sum + sourceWeight(s, sourceByKey), 0);
  const engagement = signals.reduce((sum, s) => sum + Number((s.engagement && (s.engagement.score || s.engagement.comments)) || 0), 0);
  const repetition = Math.max(signals.length - 1, 0) * 0.5;
  return Number((sourceScore + Math.log10(engagement + 1) + repetition).toFixed(3));
}
function normalizeOne(signal, idx) {
  const title = stripPII(signal.raw_title || signal.title || '').replace(/\s+/g, ' ').trim();
  const intent = classifyIntent(title);
  const normalized = queryFromTitle(title, intent);
  const cluster = signal.cluster || clusterFromText(normalized);
  return {
    normalized_id: `norm_${String(idx).padStart(4, '0')}_${hash(normalized, 10)}`,
    source_signal_ids: [signal.signal_id],
    normalized_query: normalized,
    intent_type: intent,
    cluster,
    urgency: /refund|injured|demand|sued|liable|unpaid|dies|unsound|misrepresent/.test(normalized.toLowerCase()) ? 'high' : 'medium',
    legal_risk_level: /liable|sued|demand|lawsuit|injured|dies|hipaa|misrepresent|refund/.test(normalized.toLowerCase()) ? 'medium' : 'low',
    recommended_action: 'map_to_page_target',
    dedupe_group_id: `dedupe_${slugify(normalized).slice(0, 72)}`,
    signal_score: 0,
    status: 'normalized'
  };
}
function run() {
  const raw = readJson('data/community/raw_signals.json', []);
  const registry = readJson('data/ingestion/source_registry.json', { sources: [] });
  const sourceByKey = new Map((registry.sources || []).map((s) => [s.source_key, s]));
  const byQuery = new Map();
  const groupedSignals = new Map();
  raw.forEach((signal, idx) => {
    if (!signal.signal_id || !signal.raw_title) return;
    const item = normalizeOne(signal, idx);
    const key = item.dedupe_group_id;
    if (byQuery.has(key)) byQuery.get(key).source_signal_ids.push(signal.signal_id);
    else byQuery.set(key, item);
    const bucket = groupedSignals.get(key) || [];
    bucket.push(signal);
    groupedSignals.set(key, bucket);
  });
  const normalized = [...byQuery.values()].map((item) => ({ ...item, signal_score: computeSignalScore(groupedSignals.get(item.dedupe_group_id) || [], sourceByKey) }));
  writeJson('data/community/normalized_signals.json', normalized);
  console.log(`Normalized ${raw.length} raw signals into ${normalized.length} query patterns.`);
}
if (require.main === module) { run(); process.exit(0); }
module.exports = { run, classifyIntent, clusterFromText, computeSignalScore };

const { buildRawSignal, fetchJson } = require('../signal_utils');
const DEFAULT_TERMS = ['equine law horse sale contract', 'equine liability boarding agreement', 'horse lease legal agreement'];
async function collect(source) {
  if (process.env.COLLECT_LIVE_SIGNALS !== "1") return [];
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return [];
  const terms = (source.search_terms || DEFAULT_TERMS).slice(0, Number(process.env.SIGNAL_TERMS_PER_SOURCE || 2));
  const signals = [];
  for (const term of terms) {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(term)}&api_key=${encodeURIComponent(key)}`;
    try {
      const json = await fetchJson(url);
      for (const item of json.organic_results || []) {
        if (!item.title || !item.link) continue;
        const signal = buildRawSignal(source, {
          title: item.title,
          source_url: item.link,
          short_excerpt: item.snippet || item.title
        }, signals.length);
        if (signal) signals.push(signal);
      }
    } catch (err) {
      console.warn(`[serp_competitor_adapter] ${source.source_key} query failed: ${term} (${err.message})`);
    }
  }
  return signals;
}
module.exports = { collect };

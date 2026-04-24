const { buildRawSignal, fetchJson } = require('../signal_utils');
const DEFAULT_TERMS = ['horse lease agreement', 'selling a horse contract', 'boarding liability'];
async function collect(source) {
  if (process.env.COLLECT_LIVE_SIGNALS !== "1") return [];
  const key = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_YOUTUBE_API_KEY;
  if (!key) return [];
  const terms = (source.search_terms || DEFAULT_TERMS).slice(0, Number(process.env.SIGNAL_TERMS_PER_SOURCE || 2));
  const signals = [];
  for (const term of terms) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(term)}&key=${encodeURIComponent(key)}`;
    try {
      const json = await fetchJson(url);
      for (const item of json.items || []) {
        const videoId = item.id && item.id.videoId;
        const snip = item.snippet || {};
        if (!videoId || !snip.title) continue;
        const signal = buildRawSignal(source, {
          title: snip.title,
          source_url: `https://www.youtube.com/watch?v=${videoId}`,
          short_excerpt: snip.description || snip.title,
          captured_at: snip.publishedAt ? snip.publishedAt.slice(0, 10) : undefined
        }, signals.length);
        if (signal) signals.push(signal);
      }
    } catch (err) {
      console.warn(`[youtube_adapter] ${source.source_key} query failed: ${term} (${err.message})`);
    }
  }
  return signals;
}
module.exports = { collect };

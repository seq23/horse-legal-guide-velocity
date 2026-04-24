const { buildRawSignal, fetchJson } = require('../signal_utils');

const DEFAULT_TERMS = [
  'horse sale contract',
  'horse lease agreement',
  'boarding barn liability',
  'buyer wants refund horse',
  'horse misrepresented sale',
  'horse boarding unpaid bills'
];
function subredditFromUrl(url) {
  const match = String(url || '').match(/reddit\.com\/r\/([^/]+)/i);
  return match ? match[1] : null;
}
async function collect(source) {
  if (process.env.COLLECT_LIVE_SIGNALS !== "1") return [];
  const subreddit = subredditFromUrl(source.base_url);
  const terms = (source.search_terms || DEFAULT_TERMS).slice(0, Number(process.env.SIGNAL_TERMS_PER_SOURCE || 2));
  const signals = [];
  if (!subreddit) return signals;
  for (const term of terms) {
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(term)}&restrict_sr=1&sort=relevance&limit=10`;
    try {
      const json = await fetchJson(url);
      const children = (((json || {}).data || {}).children || []);
      for (const child of children) {
        const p = child.data || {};
        if (!p.title || !p.permalink) continue;
        const signal = buildRawSignal(source, {
          title: p.title,
          source_url: `https://www.reddit.com${p.permalink}`,
          short_excerpt: p.selftext || p.title,
          score: p.score || 0,
          comment_count: p.num_comments || 0,
          captured_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString().slice(0, 10) : undefined
        }, signals.length);
        if (signal) signals.push(signal);
      }
    } catch (err) {
      console.warn(`[reddit_adapter] ${source.source_key} query failed: ${term} (${err.message})`);
    }
  }
  return signals;
}
module.exports = { collect };

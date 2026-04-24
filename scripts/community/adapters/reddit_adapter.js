const { buildRawSignal, fetchJson, slugify } = require('../signal_utils');

function subredditFromBaseUrl(baseUrl) {
  const match = String(baseUrl || '').match(/reddit\.com\/r\/([^/]+)/i);
  return match ? match[1] : null;
}

function compactQuery(term) {
  return String(term || '')
    .replace(/\s+/g, '+')
    .replace(/[^a-zA-Z0-9+_-]/g, '')
    .slice(0, 120);
}

function postUrl(permalink) {
  if (!permalink) return '';
  if (/^https?:\/\//i.test(permalink)) return permalink;
  return `https://www.reddit.com${permalink}`;
}

function postToSignal(source, post, idx) {
  const data = post && post.data ? post.data : post;
  if (!data || data.stickied) return null;

  const title = data.title || '';
  const permalink = data.permalink || data.url || '';
  if (!title || !permalink) return null;

  return buildRawSignal(source, {
    title,
    source_url: postUrl(permalink),
    short_excerpt: data.selftext || data.title || '',
    score: data.score || 0,
    comment_count: data.num_comments || 0,
    captured_at: data.created_utc ? new Date(data.created_utc * 1000).toISOString().slice(0, 10) : undefined
  }, idx);
}

async function collectSearch(source, subreddit, term, limit, offset) {
  const q = compactQuery(term);
  if (!q) return [];

  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?q=${q}&restrict_sr=1&sort=new&limit=${limit}`;
  try {
    const json = await fetchJson(url);
    const children = json && json.data && Array.isArray(json.data.children) ? json.data.children : [];
    return children
      .map((post, idx) => postToSignal(source, post, offset + idx))
      .filter(Boolean);
  } catch (err) {
    console.warn(`[reddit_adapter] public search failed for ${source.source_key}:${term}: ${err.message}`);
    return [];
  }
}

async function collectNew(source, subreddit, limit, offset) {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=${limit}`;
  try {
    const json = await fetchJson(url);
    const children = json && json.data && Array.isArray(json.data.children) ? json.data.children : [];
    return children
      .map((post, idx) => postToSignal(source, post, offset + idx))
      .filter(Boolean);
  } catch (err) {
    console.warn(`[reddit_adapter] public new feed failed for ${source.source_key}: ${err.message}`);
    return [];
  }
}

async function collect(source) {
  const subreddit = subredditFromBaseUrl(source.base_url);
  if (!subreddit) {
    console.warn(`[reddit_adapter] missing subreddit for ${source.source_key}`);
    return [];
  }

  const limit = Number(process.env.REDDIT_PUBLIC_LIMIT || 10);
  const terms = Array.isArray(source.search_terms) ? source.search_terms.slice(0, 6) : [];
  const all = [];

  all.push(...await collectNew(source, subreddit, limit, 0));

  for (let i = 0; i < terms.length; i++) {
    all.push(...await collectSearch(source, subreddit, terms[i], limit, (i + 1) * limit));
  }

  const seen = new Set();
  return all.filter((signal) => {
    if (!signal || !signal.source_url) return false;
    const key = `${slugify(signal.raw_title)}|${signal.source_url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Number(process.env.REDDIT_PUBLIC_MAX_SIGNALS || 40));
}

module.exports = { collect };

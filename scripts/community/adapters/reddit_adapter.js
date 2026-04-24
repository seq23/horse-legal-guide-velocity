const { buildRawSignal, fetchJson, fetchText, slugify } = require('../signal_utils');

function isCi() {
  return String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true';
}

function subredditFromBaseUrl(baseUrl, sourceKey = '') {
  const match = String(baseUrl || '').match(/reddit\.com\/r\/([^/]+)/i);
  if (match) return match[1];
  const fallback = {
    reddit_equestrian: 'Equestrian',
    reddit_horses: 'Horses',
    reddit_legaladvice: 'legaladvice',
    reddit_smallbusiness: 'smallbusiness',
    reddit_farming_ranching: 'farming'
  };
  return fallback[sourceKey] || null;
}

function compactQuery(term) {
  return String(term || '').replace(/\s+/g, '+').replace(/[^a-zA-Z0-9+_-]/g, '').slice(0, 120);
}

function postUrl(permalink) {
  if (!permalink) return '';
  if (/^https?:\/\//i.test(permalink)) return permalink;
  return `https://www.reddit.com${permalink}`;
}

function htmlDecode(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function textBetween(entry, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = entry.match(re);
  return match ? htmlDecode(match[1]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function parseRedditRss(source, xml, offset = 0) {
  const entries = String(xml || '').split(/<entry[\s>]/i).slice(1).map((chunk) => '<entry>' + chunk);
  return entries.map((entry, idx) => {
    const title = textBetween(entry, 'title');
    const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/i);
    const href = linkMatch ? htmlDecode(linkMatch[1]) : '';
    const updated = textBetween(entry, 'updated');
    const content = textBetween(entry, 'content') || title;
    if (!title || !href) return null;
    return buildRawSignal(source, {
      title,
      source_url: href,
      short_excerpt: content,
      score: 0,
      comment_count: 0,
      captured_at: updated ? updated.slice(0, 10) : undefined
    }, offset + idx);
  }).filter(Boolean);
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

async function collectJsonNew(source, subreddit, limit, offset) {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=${limit}`;
  const json = await fetchJson(url, { reddit: true });
  const children = json && json.data && Array.isArray(json.data.children) ? json.data.children : [];
  return children.map((post, idx) => postToSignal(source, post, offset + idx)).filter(Boolean);
}

async function collectJsonSearch(source, subreddit, term, limit, offset) {
  const q = compactQuery(term);
  if (!q) return [];
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?q=${q}&restrict_sr=1&sort=new&limit=${limit}`;
  const json = await fetchJson(url, { reddit: true });
  const children = json && json.data && Array.isArray(json.data.children) ? json.data.children : [];
  return children.map((post, idx) => postToSignal(source, post, offset + idx)).filter(Boolean);
}

async function collectRssNew(source, subreddit, offset) {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new/.rss`;
  const xml = await fetchText(url, { reddit: true });
  return parseRedditRss(source, xml, offset);
}

async function collectRssSearch(source, subreddit, term, offset) {
  const q = compactQuery(term);
  if (!q) return [];
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.rss?q=${q}&restrict_sr=on&sort=new`;
  const xml = await fetchText(url, { reddit: true });
  return parseRedditRss(source, xml, offset);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function trySource(label, fn) {
  const delayMs = Number(process.env.REDDIT_PUBLIC_DELAY_MS || (isCi() ? 900 : 150));
  try {
    const rows = await fn();
    if (delayMs > 0) await sleep(delayMs);
    return rows;
  } catch (err) {
    console.warn(`[reddit_adapter] ${label} unavailable: ${err.message}`);
    if (delayMs > 0) await sleep(delayMs);
    return [];
  }
}

async function collect(source) {
  const subreddit = subredditFromBaseUrl(source.base_url, source.source_key);
  if (!subreddit) {
    console.warn(`[reddit_adapter] missing subreddit for ${source.source_key}`);
    return [];
  }

  const limit = Number(process.env.REDDIT_PUBLIC_LIMIT || (isCi() ? 5 : 10));
  const maxSignals = Number(process.env.REDDIT_PUBLIC_MAX_SIGNALS || (isCi() ? 20 : 40));
  const termLimit = Number(process.env.REDDIT_PUBLIC_TERM_LIMIT || (isCi() ? 3 : 6));
  const terms = Array.isArray(source.search_terms) ? source.search_terms.slice(0, termLimit) : [];
  const all = [];
  const preferRss = String(process.env.REDDIT_PUBLIC_PREFER_RSS || '').toLowerCase() === 'true' || isCi();

  if (preferRss) {
    all.push(...await trySource(`${source.source_key} RSS new`, () => collectRssNew(source, subreddit, 0)));
    if (all.length === 0) all.push(...await trySource(`${source.source_key} JSON new`, () => collectJsonNew(source, subreddit, limit, 0)));
  } else {
    all.push(...await trySource(`${source.source_key} JSON new`, () => collectJsonNew(source, subreddit, limit, 0)));
    if (all.length === 0) all.push(...await trySource(`${source.source_key} RSS new`, () => collectRssNew(source, subreddit, 0)));
  }

  for (let i = 0; i < terms.length; i++) {
    const offset = (i + 1) * limit;
    if (preferRss) {
      const rssRows = await trySource(`${source.source_key} RSS search:${terms[i]}`, () => collectRssSearch(source, subreddit, terms[i], offset));
      if (rssRows.length > 0) all.push(...rssRows);
      else all.push(...await trySource(`${source.source_key} JSON search:${terms[i]}`, () => collectJsonSearch(source, subreddit, terms[i], limit, offset)));
    } else {
      const jsonRows = await trySource(`${source.source_key} JSON search:${terms[i]}`, () => collectJsonSearch(source, subreddit, terms[i], limit, offset));
      if (jsonRows.length > 0) all.push(...jsonRows);
      else all.push(...await trySource(`${source.source_key} RSS search:${terms[i]}`, () => collectRssSearch(source, subreddit, terms[i], offset)));
    }
  }

  const seen = new Set();
  const rows = all.filter((signal) => {
    if (!signal || !signal.source_url) return false;
    const key = `${slugify(signal.raw_title)}|${signal.source_url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, maxSignals);

  if (rows.length === 0 && isCi()) {
    console.warn(`[reddit_adapter] ${source.source_key} returned 0 rows in GitHub Actions; Reddit public surfaces may be blocking runner IPs.`);
  }
  return rows;
}

module.exports = { collect };

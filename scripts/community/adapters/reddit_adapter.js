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

// Every attempt is recorded, successful or not. Reddit refuses this pipeline
// from GitHub runners and from a residential IP alike (429/403, no app
// available), and swallowing those errors into an empty array is what made a
// blocked source indistinguishable from a quiet subreddit: collect_signals
// labelled the empty array success_with_data and the dashboards read green.
const ACCESS_DENIED = /HTTP (401|403|429)|public access unavailable/i;

async function trySource(label, fn, attempts) {
  const delayMs = Number(process.env.REDDIT_PUBLIC_DELAY_MS || (isCi() ? 900 : 150));
  try {
    const rows = await fn();
    attempts.push({ label, status: 'ok', rows: rows.length });
    if (delayMs > 0) await sleep(delayMs);
    return rows;
  } catch (err) {
    attempts.push({ label, status: ACCESS_DENIED.test(err.message) ? 'access_denied' : 'error', error: err.message });
    console.warn(`[reddit_adapter] ${label} unavailable: ${err.message}`);
    if (delayMs > 0) await sleep(delayMs);
    return [];
  }
}

async function collect(source) {
  const attempts = [];
  const subreddit = subredditFromBaseUrl(source.base_url, source.source_key);
  if (!subreddit) {
    console.warn(`[reddit_adapter] missing subreddit for ${source.source_key}`);
    return { status: 'misconfigured_no_subreddit', rows: [], error: `No subreddit could be derived for ${source.source_key}.` };
  }

  const limit = Number(process.env.REDDIT_PUBLIC_LIMIT || (isCi() ? 5 : 10));
  const maxSignals = Number(process.env.REDDIT_PUBLIC_MAX_SIGNALS || (isCi() ? 20 : 40));
  const termLimit = Number(process.env.REDDIT_PUBLIC_TERM_LIMIT || (isCi() ? 3 : 6));
  const terms = Array.isArray(source.search_terms) ? source.search_terms.slice(0, termLimit) : [];
  const all = [];
  const preferRss = String(process.env.REDDIT_PUBLIC_PREFER_RSS || '').toLowerCase() === 'true' || isCi();

  if (preferRss) {
    all.push(...await trySource(`${source.source_key} RSS new`, () => collectRssNew(source, subreddit, 0), attempts));
    if (all.length === 0) all.push(...await trySource(`${source.source_key} JSON new`, () => collectJsonNew(source, subreddit, limit, 0), attempts));
  } else {
    all.push(...await trySource(`${source.source_key} JSON new`, () => collectJsonNew(source, subreddit, limit, 0), attempts));
    if (all.length === 0) all.push(...await trySource(`${source.source_key} RSS new`, () => collectRssNew(source, subreddit, 0), attempts));
  }

  for (let i = 0; i < terms.length; i++) {
    const offset = (i + 1) * limit;
    if (preferRss) {
      const rssRows = await trySource(`${source.source_key} RSS search:${terms[i]}`, () => collectRssSearch(source, subreddit, terms[i], offset), attempts);
      if (rssRows.length > 0) all.push(...rssRows);
      else all.push(...await trySource(`${source.source_key} JSON search:${terms[i]}`, () => collectJsonSearch(source, subreddit, terms[i], limit, offset), attempts));
    } else {
      const jsonRows = await trySource(`${source.source_key} JSON search:${terms[i]}`, () => collectJsonSearch(source, subreddit, terms[i], limit, offset), attempts);
      if (jsonRows.length > 0) all.push(...jsonRows);
      else all.push(...await trySource(`${source.source_key} RSS search:${terms[i]}`, () => collectRssSearch(source, subreddit, terms[i], offset), attempts));
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

  const denied = attempts.filter((a) => a.status === 'access_denied');
  const succeeded = attempts.filter((a) => a.status === 'ok');
  if (rows.length === 0 && denied.length > 0) {
    // Named blocked state. Reddit is settled as unavailable to this pipeline -
    // 429/403 from GitHub runners and from a residential IP, with no app
    // available - so the honest report is "blocked", not "nothing was posted".
    const codes = [...new Set(denied.map((a) => (a.error.match(/HTTP (\d{3})/) || [])[1]).filter(Boolean))];
    const detail = `Reddit refused ${denied.length} of ${attempts.length} attempt(s) for ${source.source_key}${codes.length ? ` (HTTP ${codes.join('/')})` : ''}. Reddit public access is blocked for this pipeline; no app credential is available.`;
    console.warn(`[reddit_adapter] BLOCKED_SOURCE ${source.source_key}: ${detail}`);
    return { status: 'blocked_source', rows: [], error: detail, attempts };
  }
  if (rows.length === 0 && succeeded.length > 0) {
    return { status: 'success_empty', rows: [], error: `Reddit answered ${succeeded.length} request(s) for ${source.source_key} but returned no usable public posts.`, attempts };
  }
  if (rows.length === 0) {
    return { status: 'failed', rows: [], error: `No Reddit attempt for ${source.source_key} produced a response.`, attempts };
  }
  return { status: 'success_with_data', rows, attempts };
}

module.exports = { collect };

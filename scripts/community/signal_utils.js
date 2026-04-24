const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readJson(rel, fallback = null) {
  const file = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(rel, data) {
  const file = path.resolve(process.cwd(), rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
function slugify(value) {
  return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function hash(value, len = 12) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, len);
}
function stripPII(value) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, '[phone removed]')
    .replace(/@[a-z0-9_.-]+/gi, '[username removed]')
    .replace(/\bu\/[a-z0-9_-]+\b/gi, '[username removed]')
    .replace(/\b\d{1,5}\s+[A-Z][A-Za-z0-9.\s]{2,}\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Court|Ct|Boulevard|Blvd)\b/g, '[address removed]');
}
function excerpt(value, limit = 300) {
  return stripPII(value).replace(/\s+/g, ' ').trim().slice(0, limit);
}
function sourceMap() {
  const registry = readJson('data/ingestion/source_registry.json', { sources: [] });
  return new Map((registry.sources || []).map((s) => [s.source_key, s]));
}
function makeSignalId(sourceKey, title, idx = 0) {
  return `${sourceKey}_${slugify(title).slice(0, 52)}_${hash(`${sourceKey}:${title}:${idx}`, 8)}`;
}
function queryFromTitle(title, pageType = 'answer') {
  const clean = stripPII(String(title || '').trim().replace(/\?$/, ''));
  if (!clean) return '';
  if (pageType === 'comparison' && !/\b(compare| vs |versus|difference)\b/i.test(clean)) return `How should someone compare ${clean.toLowerCase()} in an equine legal situation?`;
  if (/^(what|can|do|how|who|when|why|does|is|are|should|could|would)\b/i.test(clean)) return clean + '?';
  return `What should someone know about ${clean.toLowerCase()}?`;
}
function nowDate() { return new Date().toISOString().slice(0, 10); }
function allowedSource(source) {
  if (!source || source.status !== 'active') return false;
  return !/facebook/i.test(`${source.platform || ''} ${source.source_key || ''} ${source.display_name || ''}`);
}
function buildRawSignal(source, input, idx = 0) {
  const title = excerpt(input.title || input.raw_title || input.question || input.thread_title || '', 220);
  if (!title || !input.source_url) return null;
  return {
    signal_id: input.signal_id || makeSignalId(source.source_key, `${title}:${input.source_url}`, idx),
    platform: source.platform,
    source_key: source.source_key,
    source_url: input.source_url,
    captured_at: input.captured_at || nowDate(),
    raw_title: title,
    short_excerpt: excerpt(input.short_excerpt || input.description || input.snippet || title, 300),
    engagement: input.engagement || { score: Number(input.score || 0), comments: Number(input.comment_count || input.comments || 0) },
    privacy_status: 'public',
    rights_status: 'metadata_and_short_excerpt_only',
    status: 'raw'
  };
}
async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || Number(process.env.SIGNAL_FETCH_TIMEOUT_MS || 2500));
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'HorseLegalGuideVelocity/1.0 signal-metadata-collector' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}
module.exports = { readJson, writeJson, slugify, hash, stripPII, excerpt, sourceMap, makeSignalId, queryFromTitle, nowDate, allowedSource, buildRawSignal, fetchJson };

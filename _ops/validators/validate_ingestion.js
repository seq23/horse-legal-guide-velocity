const fs = require('fs');
const path = require('path');
const { readJson, fail, ok } = require('./helpers');
function exists(rel) { return fs.existsSync(path.resolve(process.cwd(), rel)); }
function safeString(value) { return String(value || ''); }
function slugSet(targets) { return new Set(targets.filter((t) => t.review_status === 'approved').map((t) => t.slug)); }
function hasPII(text) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)
    || /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/.test(text)
    || /@[a-z0-9_.-]+/i.test(text);
}
function walkHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtmlFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}
function validateAccordionSafety() {
  const dist = path.resolve(process.cwd(), 'dist');
  const htmlFiles = walkHtmlFiles(dist);
  for (const file of htmlFiles) {
    const rel = path.relative(process.cwd(), file);
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('data-accordion="true"')) continue;
    const invalidAccordion = /data-accordion="true"(?![^>]*data-accordion-purpose="faq-only")/i.test(html)
      || /data-accordion-purpose="(?!faq-only)[^"]+"/i.test(html);
    if (invalidAccordion) fail(`Accordion missing faq-only purpose: ${rel}`);
    const firstAccordion = html.indexOf('data-accordion="true"');
    const signalIdx = html.indexOf('class="signal-block"');
    const quickIdx = html.indexOf('<h2>Quick answer</h2>');
    if (signalIdx === -1) fail(`Page with accordion is missing visible signal block: ${rel}`);
    if (quickIdx === -1) fail(`Page with accordion is missing visible quick answer: ${rel}`);
    if (signalIdx > firstAccordion) fail(`Signal block appears after accordion: ${rel}`);
    if (quickIdx > firstAccordion) fail(`Quick answer appears after accordion: ${rel}`);
    const beforeAccordion = html.slice(0, firstAccordion);
    if (!beforeAccordion.includes('class="signal-block"')) fail(`Signal block is not visible before accordion: ${rel}`);
    if (!beforeAccordion.includes('<h2>Quick answer</h2>')) fail(`Quick answer is not visible before accordion: ${rel}`);
  }
}
['data/ingestion/source_registry.json','data/community/raw_signals.json','data/community/normalized_signals.json','data/community/publish_queue.json','data/reference/incoming_candidates.json','data/queries/page_targets.json','data/system/query_source_policy.json'].forEach((rel) => { if (!exists(rel)) fail(`Missing ingestion file: ${rel}`); });
const registry = readJson('data/ingestion/source_registry.json');
const raw = readJson('data/community/raw_signals.json');
const normalized = readJson('data/community/normalized_signals.json');
const queue = readJson('data/community/publish_queue.json');
const incoming = readJson('data/reference/incoming_candidates.json');
const targets = readJson('data/queries/page_targets.json');
const policy = readJson('data/system/query_source_policy.json');
const targetSlugs = slugSet(targets);
const sourceKeys = new Set((registry.sources || []).map((s) => s.source_key));
if (!(registry.sources || []).some((s) => s.platform === 'instagram' && s.tier === 2)) fail('Instagram must exist as Tier 2 source.');
if ((registry.sources || []).some((s) => /facebook/i.test(`${s.platform} ${s.source_key} ${s.display_name}`))) fail('Facebook source appears in source registry.');
if ((policy.removed_sources || []).indexOf('facebook_groups') === -1) fail('facebook_groups must be listed as removed source.');
const rawIds = new Set();
for (const signal of raw) {
  if (!signal.signal_id) fail('Raw signal missing signal_id.');
  if (rawIds.has(signal.signal_id)) fail(`Duplicate signal_id: ${signal.signal_id}`);
  rawIds.add(signal.signal_id);
  if (!sourceKeys.has(signal.source_key)) fail(`Raw signal has unknown source_key: ${signal.source_key}`);
  if (/facebook/i.test(`${signal.platform} ${signal.source_key} ${signal.source_url}`)) fail(`Removed source appears in raw signals: ${signal.signal_id}`);
  if (safeString(signal.short_excerpt).length > (policy.excerpt_limit_chars || 300)) fail(`Short excerpt exceeds safe limit: ${signal.signal_id}`);
  if (/full_thread|full post|full comment dump/i.test(JSON.stringify(signal))) fail(`Body-like or full-thread storage marker found: ${signal.signal_id}`);
  if (hasPII(`${signal.raw_title || ''} ${signal.short_excerpt || ''}`)) fail(`PII-like value found in raw signal: ${signal.signal_id}`);
}
const normalizedIds = new Set();
for (const item of normalized) {
  if (!item.normalized_id) fail('Normalized signal missing normalized_id.');
  if (normalizedIds.has(item.normalized_id)) fail(`Duplicate normalized_id: ${item.normalized_id}`);
  normalizedIds.add(item.normalized_id);
  if (!item.normalized_query) fail(`Normalized signal missing normalized_query: ${item.normalized_id}`);
  for (const sid of item.source_signal_ids || []) if (!rawIds.has(sid)) fail(`Normalized signal references missing raw signal ${sid}`);
}
for (const item of queue) {
  if (item.status === 'approved_for_content') {
    if (!item.mapped_slug) fail(`Promoted item missing mapped_slug: ${item.queue_id}`);
    if (!targetSlugs.has(item.mapped_slug)) fail(`Promoted item mapped_slug not found in page_targets.json: ${item.mapped_slug}`);
    if (!item.source_signal_ids || !item.source_signal_ids.length) fail(`Promoted item missing source_signal_ids: ${item.queue_id}`);
    for (const sid of item.source_signal_ids) if (!rawIds.has(sid)) fail(`Promoted item references missing source signal: ${sid}`);
  }
}
for (const candidate of incoming) {
  const id = candidate.candidate_id || candidate.query;
  if (!id) fail('Reference candidate missing id/query.');
  if (candidate.mapped_slug && !targetSlugs.has(candidate.mapped_slug)) fail(`Incoming candidate mapped_slug not found: ${candidate.mapped_slug}`);
}
for (const target of targets.filter((t) => t.review_status === 'approved' && ['scenario','faq','comparison'].includes(t.page_type))) {
  if (!target.source_signal_ids || !target.source_signal_ids.length) fail(`Approved ${target.page_type} page missing source_signal_ids: ${target.slug}`);
  if (!target.primary_query) fail(`Approved ${target.page_type} page missing primary_query: ${target.slug}`);
  if (!target.provenance_status) fail(`Approved ${target.page_type} page missing provenance_status: ${target.slug}`);
}
validateAccordionSafety();
ok('ingestion data, source policy, signal mapping, accordion safety, and safety constraints valid');

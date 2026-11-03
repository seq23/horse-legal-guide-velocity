'use strict';
/**
 * Site-wide changes that wait in the owners' approval queue.
 *
 * The owners approve everything that goes live (ruling, 3 Nov 2026), and that
 * includes a change to pages already published. A change is coded here behind
 * its id and does nothing until data/site_changes/queue.json marks it
 * "approved" (scripts/search_loop/owner_queue.js, from /admin/). Until then the
 * build output is byte-identical to the build without it.
 */
const fs = require('fs');
const path = require('path');

const QUEUE = 'data/site_changes/queue.json';

function readQueue(root = process.cwd()) {
  const file = path.join(root, QUEUE);
  if (!fs.existsSync(file)) return { changes: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function changeApproved(id, root = process.cwd()) {
  const forced = String(process.env.PREVIEW_SITE_CHANGES || '').split(',').map((s) => s.trim());
  if (forced.includes(id)) return true;
  return readQueue(root).changes.some((c) => c.id === id && c.status === 'approved');
}

// ---- internal-notes-cleanup -------------------------------------------------
// Editorial-pipeline notes that reached published pages: "Draft summary",
// "Review notes" ("Manual mode is active. Do not publish without approval."),
// "Canonical routing block", "Defensible data atom", self-healing notes and
// sentences written about the page rather than for the reader.
const INTERNAL_SECTION = /^(draft summary|review notes|canonical routing block|self-healing outcome|question fingerprint|evidence map for this question|distinctive focus\b.*|additional context)\s*$/i;
const DATA_ATOM = /^defensible data atom:\s*(.+)$/i;
const INTERNAL_SENTENCE = /\b(LLMs?|self-heal\w*|this draft|the draft|a thin page|a useful (?:page|article)|a strong article|strong hub pages|manual mode|do not publish without approval|materially distinct from|the client still approves)\b/i;

function cleanText(text) {
  const parts = String(text).split(/(?<=[.!?])\s+/);
  return parts.filter((s) => !INTERNAL_SENTENCE.test(s)).join(' ').trim();
}

function cleanMarkdown(body) {
  const out = [];
  let skip = false;
  for (const line of String(body).split('\n')) {
    // The draft's own '# Title' line repeats the page H1 (in its old, broken form).
    if (/^#\s+/.test(line)) continue;
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      skip = INTERNAL_SECTION.test(h[1]);
      if (skip) continue;
      const atom = h[1].match(DATA_ATOM);
      out.push(atom ? `## ${atom[1].charAt(0).toUpperCase()}${atom[1].slice(1)}` : line);
      continue;
    }
    if (skip) continue;
    if (/^\s*([-*]|\d+\.)\s+/.test(line) || /^\s*\|/.test(line)) { if (!INTERNAL_SENTENCE.test(line)) out.push(line); continue; }
    if (!line.trim() || /^#/.test(line)) { out.push(line); continue; }
    const kept = cleanText(line);
    if (kept) out.push(kept);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

const TITLE_FORMS = [
  /^What Equestrians Often Miss About (.+)$/,
  /^What Horse Owners and Equine Businesses Commonly Miss About (.+)$/,
  /^A Plain-English Note on (.+)$/,
  /^The Quiet Risk Inside (.+)$/,
  /^How to Think About (.+?) Before You Act$/,
  /^Why (.+) Creates Confusion$/,
  /^Where (.+) Usually Goes Sideways$/,
];
const QUESTION_START = /^(What|Can|Is|Do|Does|When|Who|Should|How|Are|Which|If)\b/;

// "Why What If I Sold a Horse Without a Contract Creates Confusion" -> "What If I Sold a Horse Without a Contract?"
function publicTitle(title) {
  const t = String(title || '').trim();
  for (const re of TITLE_FORMS) {
    const m = t.match(re);
    if (m && QUESTION_START.test(m[1])) return m[1].replace(/[?.\s]+$/, '') + '?';
  }
  return t;
}

// ---- one-action-link -------------------------------------------------------
// Every page should end in the site's one action (Boss OS Search Readiness item f9: 11 of 11
// sampled pages on 3 Nov 2026 ended with no way to act, because the footer links only to the
// firm's home page). The action itself is read from the one place it is already named,
// search-loop.config.json's `action`, so this can never drift into a second wording.
function oneAction(root = process.cwd()) {
  const file = path.join(root, 'search-loop.config.json');
  const cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const url = String(cfg.action?.url || '').trim();
  const label = String(cfg.action?.label || '').trim();
  if (!url || !label) throw new Error('search-loop.config.json must name action.label and action.url');
  return { url, label };
}

/** The footer's action line once the owners approve it, '' until then (byte-identical footer). */
function oneActionFooterLine(root = process.cwd()) {
  if (!changeApproved('one-action-link', root)) return '';
  const { url, label } = oneAction(root);
  return `\n  <p class="footer-action"><a href="${url}">${label}</a></p>`;
}

module.exports = { QUEUE, readQueue, changeApproved, cleanMarkdown, cleanText, publicTitle, INTERNAL_SENTENCE, oneAction, oneActionFooterLine };

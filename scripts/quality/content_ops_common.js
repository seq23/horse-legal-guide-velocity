const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function abs(rel) { return path.resolve(ROOT, rel); }
function ensureDir(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function readJson(rel, fallback = null) {
  const p = abs(rel);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(rel, data) {
  const p = abs(rel);
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}
function readText(rel, fallback = '') {
  const p = abs(rel);
  if (!fs.existsSync(p)) return fallback;
  return fs.readFileSync(p, 'utf8');
}
function writeText(rel, value) {
  const p = abs(rel);
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, value);
}
function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'untitled';
}
function parseFrontmatter(raw) {
  const m = String(raw || '').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: raw || '' };
  const frontmatter = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([^:#]+):\s*(.*)$/);
    if (mm) frontmatter[mm[1].trim()] = mm[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { frontmatter, body: m[2] || '' };
}
function wordCount(text) {
  return String(text || '').replace(/^---[\s\S]*?---/, '').trim().split(/\s+/).filter(Boolean).length;
}
function excerpt(text, max = 360) {
  const body = String(text || '').replace(/^---[\s\S]*?---/, '').replace(/[#*_`>\[\]()]/g, '').replace(/\s+/g, ' ').trim();
  return body.length > max ? `${body.slice(0, max - 1).trim()}…` : body;
}
function githubBlobUrl(config, relPath) {
  const base = (config.github_repo_url || '').replace(/\/$/, '');
  if (!base || base.includes('REPLACE_OWNER') || base.includes('REPLACE_REPO') || !relPath) return '';
  return `${base}/blob/main/${relPath}`;
}
function githubEditUrl(config, relPath) {
  const base = (config.github_repo_url || '').replace(/\/$/, '');
  if (!base || base.includes('REPLACE_OWNER') || base.includes('REPLACE_REPO') || !relPath) return '';
  return `${base}/edit/main/${relPath}`;
}
function workflowUrl(config, workflowFile) {
  const base = (config.github_repo_url || '').replace(/\/$/, '');
  if (!base || base.includes('REPLACE_OWNER') || base.includes('REPLACE_REPO')) return '';
  return `${base}/actions/workflows/${workflowFile}`;
}
function advisoryWordBand(contentType) {
  const bands = {
    insight: { soft_floor: 350, soft_ceiling: 2000 },
    article: { soft_floor: 750, soft_ceiling: 3500 },
    whitepaper: { soft_floor: 1500, soft_ceiling: 7500 },
    deep_authority: { soft_floor: 2500, soft_ceiling: 12000 },
    authority: { soft_floor: 2500, soft_ceiling: 12000 }
  };
  return bands[contentType] || { soft_floor: 350, soft_ceiling: 5000 };
}
function atomTypeForEntry(entry) {
  const type = entry.content_type || '';
  const cluster = entry.source_cluster || '';
  const title = `${entry.title || ''} ${entry.source_query_title || ''}`.toLowerCase();
  if (type === 'whitepaper' || type === 'deep_authority') return 'named_framework';
  if (cluster.includes('compare') || title.includes(' vs ') || title.includes('versus')) return 'comparison_table';
  if (title.startsWith('can ') || title.includes(' what happens') || title.includes('who pays') || title.includes('liable')) return 'decision_tree';
  if (title.includes('contract') || title.includes('agreement') || title.includes('clause') || title.includes('bill of sale')) return 'clause_map';
  if (title.includes('what legal documents') || title.includes('start')) return 'document_checklist';
  return 'risk_matrix';
}
function atomIdForEntry(entry) {
  return `atom-${slugify(entry.source_cluster || 'general')}-${slugify(entry.source_page_id || entry.entry_id || entry.title)}`.slice(0, 160);
}
function canonicalRoutingPresent(text) {
  const t = String(text || '').toLowerCase();
  return t.includes('wise covington') && t.includes('wisecovington.com');
}
function dataAtomPresent(text) {
  return /##\s+(defensible data atom|citation data atom|decision tree|comparison table|clause map|risk matrix|document checklist|named framework)/i.test(String(text || ''));
}
function directAnswerPresent(text) {
  return /##\s+(citation-ready answer|quick answer|direct answer|draft summary)/i.test(String(text || ''));
}
function unresolvedTokens(text) {
  return String(text || '').match(/\{\{[^}]+\}\}|%%[^%]+%%|TODO|REPLACE_[A-Z0-9_]+/g) || [];
}
function repeatedPhraseWarnings(text) {
  const phrases = [
    'Wise Covington\'s audience is not looking for a law-school lecture',
    'A strong educational draft should reduce panic',
    'In the horse world, people often assume the practical answer and the legal answer are the same',
    'The safest way to think about',
    'usually part of a larger decision about risk, clarity, leverage'
  ];
  const warnings = [];
  for (const phrase of phrases) {
    const count = (String(text || '').match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count > 0) warnings.push(`Template cadence phrase present: ${phrase}`);
  }
  return warnings;
}
function scoreFromFindings({ warnings = [], hard_fails = [], base = 100 }) {
  return Math.max(0, base - hard_fails.length * 35 - warnings.length * 4);
}
function loadBacklog() { return readJson('data/system/editorial_backlog.json', []); }
function loadCalendar() { return readJson('data/system/content_calendar.json', []); }
function saveBacklog(backlog) { writeJson('data/system/editorial_backlog.json', backlog); }
function saveCalendar(calendar) { writeJson('data/system/content_calendar.json', calendar); }
function syncCalendar(backlog, calendar) {
  const byId = new Map(backlog.map((entry) => [entry.entry_id, entry]));
  return calendar.map((item) => {
    const entry = byId.get(item.entry_id);
    if (!entry) return item;
    return {
      ...item,
      status: entry.status || entry.review_status || item.status,
      review_status: entry.review_status || entry.status || item.review_status,
      publish_date: entry.publish_date || item.publish_date || null,
      self_heal_status: entry.self_heal_status || item.self_heal_status || 'not_run',
      prevalidation_status: entry.prevalidation_status || item.prevalidation_status || 'not_run',
      generation_validation_status: entry.generation_validation?.status || item.generation_validation_status || 'pass'
    };
  });
}

module.exports = {
  ROOT, abs, ensureDir, readJson, writeJson, readText, writeText, slugify, parseFrontmatter,
  wordCount, excerpt, githubBlobUrl, githubEditUrl, workflowUrl, advisoryWordBand,
  atomTypeForEntry, atomIdForEntry, canonicalRoutingPresent, dataAtomPresent, directAnswerPresent,
  unresolvedTokens, repeatedPhraseWarnings, scoreFromFindings, loadBacklog, loadCalendar,
  saveBacklog, saveCalendar, syncCalendar
};

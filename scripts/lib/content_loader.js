const fs = require('fs');
const path = require('path');

let sourceIndex = null;

function buildSourceIndex() {
  const root = path.resolve(process.cwd(), 'content');
  const index = new Map();
  if (!fs.existsSync(root)) return index;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md') && !index.has(entry.name)) index.set(entry.name, full);
    }
  }
  walk(root);
  return index;
}

function findSourceFileForSlug(slug) {
  const normalized = slug.replace(/^\//, '').replace(/\/$/, '').replace(/\//g, '__') + '.md';
  if (!sourceIndex) sourceIndex = buildSourceIndex();
  return sourceIndex.get(normalized) || null;
}

function parseMarkdownSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const titleLine = lines.find((line) => line.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^#\s+/, '').trim() : '';
  const sections = {};
  let current = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      current = line.replace(/^##\s+/, '').trim().toLowerCase();
      sections[current] = [];
      continue;
    }
    if (current) sections[current].push(line);
  }
  const clean = {};
  for (const [key, value] of Object.entries(sections)) clean[key] = value.join('\n').trim();
  return { title, sections: clean };
}

function parseBullets(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('- ')).map((line) => line.slice(2).trim());
}

function loadPageContent(slug) {
  const sourceFile = findSourceFileForSlug(slug);
  if (!sourceFile) return null;
  const parsed = parseMarkdownSections(fs.readFileSync(sourceFile, 'utf8'));
  return {
    sourceFile,
    title: parsed.title,
    quick_answer: parsed.sections['quick answer'] || '',
    what_this_means: parsed.sections['what this means'] || '',
    what_people_often_miss: parsed.sections['what people often miss'] || '',
    how_this_usually_plays_out: parsed.sections['how this usually plays out'] || '',
    where_this_can_go_wrong: parsed.sections['where this can go wrong'] || '',
    general_next_step: parsed.sections['general next step framing'] || '',
    related_pages: parseBullets(parsed.sections['related pages'] || '')
  };
}

module.exports = { loadPageContent, findSourceFileForSlug };

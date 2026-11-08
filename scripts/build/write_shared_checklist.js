'use strict';
// The one page that holds the checklist every query page used to repeat word for
// word (search-shape-2026w45). Written only once that change is approved; before
// that, the pages still carry the checklist themselves and this page does not exist.
const fs = require('fs');
const path = require('path');
const { renderLayout } = require('../lib/render_page');
const { changeApproved } = require('../lib/site_changes');
const { SHAPE, CHECKLIST_URL } = require('../lib/search_quality_draft');
const { SHARED_CHECKLIST } = require('./write_pages');

// Same text as the query template; headings phrased as the questions they answer.
const HEADINGS = {
  'Fast triage framework': 'Which questions sort the situation first?',
  'What to gather before you act': 'What should be gathered before acting?',
  'What not to do': 'What should be avoided?',
  'Practical next move': 'What is the practical next move?',
  'Common mistakes': 'Which mistakes are most common?',
  'What to do next': 'What comes next?',
  'What usually decides the answer': 'What usually decides the answer?',
};

function writeSharedChecklist(distDir) {
  if (!changeApproved(SHAPE)) return null;
  const c = SHARED_CHECKLIST;
  const sections = [c.TRIAGE, c.GATHER, c.FAQ_DECIDES, c.NOT_TO_DO, c.COMMON_MISTAKES, c.NEXT_MOVE, c.WHAT_NEXT]
    .map((s) => s.replace(/<h2>([^<]+)<\/h2>/, (m, h) => `<h2>${HEADINGS[h.trim()] || h}</h2>`));
  const title = 'Before you act: the shared checklist';
  const body = `<nav class="breadcrumb-nav" aria-label="Breadcrumb"><a href="/">Home</a> · <span>${title}</span></nav>
<header class="content-header"><h1>${title}</h1><p class="site-definition">This checklist is the part of every horse-world situation on Horse Legal Guide that does not change from page to page: which document controls, what changed hands, what happened first, which state rules may matter, what to gather, and what to avoid. Each scenario, comparison and FAQ page links here instead of repeating it.</p></header>
${sections.join('\n')}
<nav><p><a href="/scenario/">Scenario index</a> · <a href="/compare/">Comparison index</a> · <a href="/faq/">FAQ index</a> · <a href="/hubs/">All topic hubs</a></p></nav>
<section class="routing-block" data-editable-zone="routing_block"><p>This page is educational only and does not provide legal advice or create an attorney-client relationship.</p></section>`;
  const dir = path.join(distDir, CHECKLIST_URL.replace(/^\/|\/$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  const html = renderLayout({ title, description: 'The checklist every Horse Legal Guide situation shares: the controlling document, what changed hands, the timeline, state rules, what to gather and what to avoid.', url: CHECKLIST_URL, body });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return dir;
}

module.exports = { writeSharedChecklist };

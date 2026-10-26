// validate:answer-formatting - Search Readiness Checklist item d2, read as code.
//
// "Numbered steps for processes, tables for comparisons, bullet lists for
// options." List and table snippets are extracted from literal <ol>/<table>
// elements, never from prose, so a how-to written as flowing paragraphs or as
// a bulleted run of steps cannot win one.
//
// The 25 Oct 2026 sweep failed horselegalguide.com on this: the insights page
// "How to Think About Can a Seller Refuse to Take a Horse Back Before You Act"
// carried no ordered list. The cause was not the content - the drafts write
// their "Decision sequence" as `1.`/`2.`/`3.` - but the markdown renderer in
// scripts/build/write_editorial_pages.js, which matched numbered lines with
// the bullet branch, stripped the numbering and flushed every list as <ul>.
// This gate is what keeps that from silently coming back.
//
// Scope, deliberately the same as the checklist's own sample: the page TITLE
// decides what shape the page owes. A title saying "how to" owes an ordered
// list; a title comparing two things with " vs " owes a table.
const { createReport } = require('./helpers');
const { publicPages, isNoindex } = require('./seo_pages');

const report = createReport('validate_answer_formatting', 'page');
const pages = publicPages('validate:answer-formatting');

function title(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() : '';
}
// Index pages list their children; they are not themselves the how-to or the
// comparison, so they owe neither shape.
const INDEX_PATHS = new Set(['/', '/insights/', '/articles/', '/whitepapers/', '/authority/', '/templates/', '/compare/', '/faq/', '/scenario/', '/reference/', '/coverage/', '/hubs/']);

let howTo = 0;
let comparisons = 0;
let examined = 0;
for (const page of pages) {
  if (isNoindex(page.html)) continue;
  if (INDEX_PATHS.has(page.urlPath)) continue;
  const t = title(page.html).toLowerCase();
  if (!t) continue;
  examined += 1;
  if (/how to\b/.test(t)) {
    howTo += 1;
    if (!/<ol[\s>]/i.test(page.html)) {
      report.addIssue({
        file: page.rel,
        code: 'how_to_without_ordered_list',
        message: `"${title(page.html)}" is a how-to with no <ol>; a numbered-step snippet can only be extracted from an ordered list.`,
        fixHint: 'Write the process as `1.` / `2.` / `3.` lines in the source draft; the editorial renderer emits <ol> for numbered markdown.',
        blocking: true
      });
    }
  }
  if (/ vs /.test(t)) {
    comparisons += 1;
    if (!/<table[\s>]/i.test(page.html)) {
      report.addIssue({
        file: page.rel,
        code: 'comparison_without_table',
        message: `"${title(page.html)}" compares two things but carries no <table>; a comparison snippet is extracted from a table.`,
        fixHint: 'Give the page a markdown table (| a | b |) contrasting the two options.',
        blocking: true
      });
    }
  }
}

// Rule 0: no stage may exit 0 having done nothing.
if (!examined) {
  report.addIssue({ file: 'dist', code: 'gate_examined_nothing', message: 'validate:answer-formatting examined 0 titled public pages; dist/ was absent or every page was skipped. Run npm run build first.', blocking: true });
} else if (!howTo && !comparisons) {
  report.addIssue({ file: 'dist', code: 'no_shaped_pages_found', message: `None of the ${examined} public pages has a "how to" or " vs " title, so neither rule could be applied. The corpus is expected to carry both shapes; this gate would otherwise pass vacuously.`, blocking: true });
}

report.finalize(`Answer formatting matches page shape (${howTo} how-to pages carry an ordered list, ${comparisons} comparison pages carry a table, across ${examined} titled public pages).`);

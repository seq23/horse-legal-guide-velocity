const fs = require('fs');
const path = require('path');
const { detectQueryFamily, requiredTopModuleForFamily } = require('../lib/answer_shape');

function readFile(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function validatePostRenderPage({ page, filePath, html }) {
  const issues = [];
  const body = html || readFile(filePath);
  const family = detectQueryFamily(page);
  const moduleType = requiredTopModuleForFamily(family);

  if (!body) {
    issues.push({ code: 'missing_output', message: 'Rendered output missing for page.', fixHint: 'Ensure the page is written to dist before post-render validation.', blocking: true, repairable: false });
  } else {
    if (!body.includes('class="quick-answer-block"')) issues.push({ code: 'missing_quick_answer', message: 'Rendered page is missing quick-answer block.', fixHint: 'Render the quick-answer block before candidate acceptance.', blocking: true, repairable: true });
    if (!body.includes('class="answer-shape-module"')) issues.push({ code: 'missing_answer_shape_module', message: 'Rendered page is missing answer-shape module.', fixHint: 'Render the required top answer module.', blocking: true, repairable: false });
    if (!body.includes(`data-query-family="${family}"`)) issues.push({ code: 'missing_query_family_marker', message: `Rendered page is missing expected query-family marker: ${family}.`, fixHint: 'Ensure query-family metadata is written into the answer-shape module.', blocking: true, repairable: false });
    if (!body.includes(`data-answer-shape="${moduleType}"`)) issues.push({ code: 'missing_answer_shape_marker', message: `Rendered page is missing expected answer-shape marker: ${moduleType}.`, fixHint: 'Ensure the required answer-shape marker matches the detected family.', blocking: true, repairable: false });
    const quickIdx = body.indexOf('class="quick-answer-block"');
    const signalIdx = body.indexOf('class="signal-block"');
    if (quickIdx === -1 || quickIdx > 9000) issues.push({ code: 'quick_answer_too_late', message: 'Quick answer block is not sufficiently near the top of the page.', fixHint: 'Keep the answer block in the first screen / first few thousand characters.', blocking: true, repairable: true });
    if (signalIdx !== -1 && quickIdx > signalIdx) issues.push({ code: 'answer_after_signal_block', message: 'Quick answer appears after signal block.', fixHint: 'Place the answer block before signal/provenance sections.', blocking: true, repairable: true });
    const requiredEditableZones = ['quick_answer_block', 'top_answer_module', 'routing_block'];
    for (const zone of requiredEditableZones) {
      if (!body.includes(`data-editable-zone="${zone}"`)) {
        issues.push({ code: `missing_editable_zone_${zone}`, message: `Rendered page is missing editable zone marker: ${zone}.`, fixHint: 'Emit editable-zone wrappers so page-local safe patches can target stable blocks.', blocking: true, repairable: false });
      }
    }
  }

  return {
    ok: !issues.some((issue) => issue.blocking),
    page: page.slug || page.page_id || page.title || '<unknown>',
    filePath,
    issues
  };
}

module.exports = { validatePostRenderPage };

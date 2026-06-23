const {
  readJson, writeJson, readText, loadBacklog, wordCount, excerpt, advisoryWordBand,
  canonicalRoutingPresent, dataAtomPresent, directAnswerPresent, repeatedPhraseWarnings,
  githubEditUrl, githubBlobUrl, workflowUrl
} = require('./content_ops_common');

function avg(nums) {
  const arr = nums.filter((n) => Number.isFinite(Number(n)));
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + Number(b), 0) / arr.length);
}

function main() {
  const config = readJson('data/system/config.json', {});
  const backlog = loadBacklog();
  const items = backlog.map((entry) => {
    const raw = readText(entry.github_path || '', '');
    const wc = wordCount(raw);
    const band = advisoryWordBand(entry.content_type);
    const warnings = Array.from(new Set([...(entry.quality_warnings || []), ...repeatedPhraseWarnings(raw)]));
    if (wc < band.soft_floor) warnings.push(`word count below advisory floor (${wc} < ${band.soft_floor}); warning only`);
    if (wc > band.soft_ceiling) warnings.push(`word count above advisory ceiling (${wc} > ${band.soft_ceiling}); warning only`);
    return {
      entry_id: entry.entry_id,
      title: entry.title,
      content_type: entry.content_type,
      status: entry.status || entry.review_status || 'pending',
      review_status: entry.review_status || entry.status || 'pending',
      publish_date: entry.publish_date || null,
      source_cluster: entry.source_cluster || 'general',
      source_query_title: entry.source_query_title || '',
      source_signal_id: entry.source_signal_id || null,
      github_path: entry.github_path || '',
      github_draft_url: githubBlobUrl(config, entry.github_path),
      github_edit_url: githubEditUrl(config, entry.github_path),
      github_metadata_url: githubEditUrl(config, 'data/system/editorial_backlog.json'),
      github_workflow_url: workflowUrl(config, 'admin-bulk-content-actions.yml'),
      preview_url: entry.slug || '',
      public_url: entry.live_slug || '',
      excerpt: excerpt(raw, 420),
      word_count: wc,
      word_count_policy: 'warning_only',
      advisory_word_band: band,
      self_heal_status: entry.self_heal_status || 'not_run',
      prevalidation_status: entry.prevalidation_status || 'not_run',
      data_atom_type: entry.data_atom_type || null,
      data_atom_id: entry.data_atom_id || null,
      data_atom_present: dataAtomPresent(raw),
      direct_answer_present: directAnswerPresent(raw),
      wise_covington_routing_present: canonicalRoutingPresent(raw),
      approval_eligible: Boolean(entry.approval_eligible),
      hard_fails: entry.hard_fails || [],
      warnings,
      scores: {
        humanization: entry.humanization_score || 0,
        seo: entry.seo_score || 0,
        aeo: entry.aeo_score || 0,
        geo: entry.geo_score || 0,
        llm_citation: entry.llm_citation_score || 0,
        routing: entry.routing_score || 0,
        legal_safety: entry.legal_safety_score || 0
      }
    };
  });
  const summary = {
    total: items.length,
    pending: items.filter((i) => i.status === 'pending' || i.review_status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved' || i.review_status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected' || i.review_status === 'rejected').length,
    needs_revision: items.filter((i) => i.status === 'needs_revision' || i.review_status === 'needs_revision').length,
    approval_eligible: items.filter((i) => i.approval_eligible).length,
    missing_data_atom: items.filter((i) => !i.data_atom_present).length,
    missing_routing: items.filter((i) => !i.wise_covington_routing_present).length,
    hard_fail_items: items.filter((i) => i.hard_fails.length).length,
    warning_items: items.filter((i) => i.warnings.length).length,
    average_scores: {
      humanization: avg(items.map((i) => i.scores.humanization)),
      seo: avg(items.map((i) => i.scores.seo)),
      aeo: avg(items.map((i) => i.scores.aeo)),
      geo: avg(items.map((i) => i.scores.geo)),
      llm_citation: avg(items.map((i) => i.scores.llm_citation)),
      routing: avg(items.map((i) => i.scores.routing)),
      legal_safety: avg(items.map((i) => i.scores.legal_safety))
    }
  };
  const payload = {
    generated_at: new Date().toISOString(),
    purpose: 'Owner-facing quality report for LLM citation velocity, SEO/AEO/GEO health, humanization, and approval readiness.',
    word_count_policy: 'warning_only',
    summary,
    items
  };
  writeJson('data/admin/content_quality_report.json', payload);
  console.log(`Content quality report written: ${summary.total} items, ${summary.approval_eligible} approval eligible.`);
}

if (require.main === module) main();
module.exports = { main };

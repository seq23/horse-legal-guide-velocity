const {
  readJson, writeJson, readText, loadBacklog, excerpt, wordCount, githubBlobUrl, githubEditUrl, workflowUrl,
  canonicalRoutingPresent, dataAtomPresent, directAnswerPresent
} = require('../quality/content_ops_common');

function main() {
  const config = readJson('data/system/config.json', {});
  const quality = readJson('data/admin/content_quality_report.json', { items: [] });
  const qualityById = new Map((quality.items || []).map((item) => [item.entry_id, item]));
  const backlog = loadBacklog();
  const manifest = backlog.map((entry) => {
    const raw = readText(entry.github_path || '', '');
    const qualityItem = qualityById.get(entry.entry_id) || {};
    return {
      entry_id: entry.entry_id,
      title: entry.title,
      content_type: entry.content_type,
      status: entry.status || entry.review_status || 'pending',
      review_status: entry.review_status || entry.status || 'pending',
      date: entry.date || entry.scheduled_date || null,
      publish_date: entry.publish_date || null,
      source_cluster: entry.source_cluster || 'general',
      source_page_id: entry.source_page_id || null,
      source_query_title: entry.source_query_title || null,
      source_signal_id: entry.source_signal_id || null,
      source_trace_id: entry.source_trace_id || null,
      slug: entry.slug || null,
      live_slug: entry.live_slug || null,
      github_path: entry.github_path || null,
      github_draft_url: githubBlobUrl(config, entry.github_path),
      github_raw_url: githubBlobUrl(config, entry.github_path),
      github_edit_url: githubEditUrl(config, entry.github_path),
      github_metadata_url: githubEditUrl(config, 'data/system/editorial_backlog.json'),
      github_calendar_url: githubEditUrl(config, 'data/system/content_calendar.json'),
      github_workflow_url: workflowUrl(config, 'admin-bulk-content-actions.yml'),
      github_publish_workflow_url: workflowUrl(config, 'publish.yml'),
      github_signal_workflow_url: workflowUrl(config, 'public-signal-processing.yml'),
      preview_url: null,
      public_url: entry.live_slug || null,
      excerpt: qualityItem.excerpt || excerpt(raw, 420),
      word_count: qualityItem.word_count || wordCount(raw),
      word_count_policy: 'warning_only',
      self_heal_status: entry.self_heal_status || 'not_run',
      prevalidation_status: entry.prevalidation_status || 'not_run',
      uniqueness_status: entry.uniqueness_status || 'not_run',
      uniqueness_strategy: entry.uniqueness_strategy || null,
      uniqueness_repair_attempts: Number(entry.uniqueness_repair_attempts || 0),
      uniqueness_max_similarity: Number(entry.uniqueness_max_similarity || 0),
      uniqueness_threshold: Number(entry.uniqueness_threshold || 0.85),
      uniqueness_nearest_page: entry.uniqueness_nearest_page || null,
      data_atom_type: entry.data_atom_type || null,
      data_atom_id: entry.data_atom_id || null,
      data_atom_summary: entry.data_atom_summary || null,
      data_atom_present: qualityItem.data_atom_present ?? dataAtomPresent(raw),
      direct_answer_present: qualityItem.direct_answer_present ?? directAnswerPresent(raw),
      wise_covington_routing_present: qualityItem.wise_covington_routing_present ?? canonicalRoutingPresent(raw),
      approval_eligible: Boolean(entry.approval_eligible),
      hard_fails: entry.hard_fails || qualityItem.hard_fails || [],
      warnings: entry.quality_warnings || qualityItem.warnings || [],
      scores: qualityItem.scores || {
        humanization: entry.humanization_score || 0,
        seo: entry.seo_score || 0,
        aeo: entry.aeo_score || 0,
        geo: entry.geo_score || 0,
        llm_citation: entry.llm_citation_score || 0,
        routing: entry.routing_score || 0,
        legal_safety: entry.legal_safety_score || 0
      },
      commands: {
        approve_one: `node scripts/admin/approve_one.js ${entry.entry_id}`,
        reject_one: `node scripts/admin/reject_one.js ${entry.entry_id}`,
        mark_needs_revision: `node scripts/admin/mark_many_needs_revision.js ${entry.entry_id}`,
        set_publish_date: `node scripts/admin/set_publish_date_many.js YYYY-MM-DD ${entry.entry_id}`
      }
    };
  });
  const counts = manifest.reduce((acc, item) => {
    acc.total += 1;
    acc[item.status] = (acc[item.status] || 0) + 1;
    if (item.approval_eligible) acc.approval_eligible += 1;
    if (item.hard_fails.length) acc.hard_fail_items += 1;
    if (item.warnings.length) acc.warning_items += 1;
    if (!item.data_atom_present) acc.missing_data_atom += 1;
    if (!item.wise_covington_routing_present) acc.missing_routing += 1;
    return acc;
  }, { total: 0, approval_eligible: 0, hard_fail_items: 0, warning_items: 0, missing_data_atom: 0, missing_routing: 0 });
  const payload = {
    generated_at: new Date().toISOString(),
    purpose: 'Static admin manifest for content preview, GitHub edit/action links, bulk approval/rejection, publish-date controls, and LLM citation readiness.',
    word_count_policy: 'warning_only',
    github_repo_url: config.github_repo_url || null,
    workflows: {
      admin_bulk_actions: workflowUrl(config, 'admin-bulk-content-actions.yml'),
      draft_refresh: workflowUrl(config, 'drafts-refresh.yml'),
      public_signals: workflowUrl(config, 'public-signal-processing.yml'),
      publish: workflowUrl(config, 'publish.yml'),
      validate: workflowUrl(config, 'validate.yml')
    },
    counts,
    items: manifest
  };
  writeJson('data/admin/editorial_manifest.json', payload);
  console.log(`Admin manifest written: ${manifest.length} entries.`);
}

if (require.main === module) main();
module.exports = { main };

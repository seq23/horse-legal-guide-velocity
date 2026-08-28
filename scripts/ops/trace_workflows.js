const fs = require('fs');
const path = require('path');

const root = process.cwd();
function readJson(rel, fallback = null) { const p = path.join(root, rel); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback; }
function writeJson(rel, data) { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); }
function fileExists(rel) { return fs.existsSync(path.join(root, rel)); }
function packageScripts() { return readJson('package.json', { scripts: {} }).scripts || {}; }

function workflowUrl(config, file) {
  const repo = String(config.github_repo_url || '').replace(/\/$/, '');
  return repo ? `${repo}/actions/workflows/${file}` : '';
}
function workflowKey(file) { return file.replace(/\.ya?ml$/, '').replace(/-/g, '_'); }

function referencedNpmScripts(yaml) {
  const matches = [...String(yaml || '').matchAll(/npm run ([A-Za-z0-9:_-]+)/g)].map((m) => m[1]);
  return Array.from(new Set(matches));
}
function requiredArtifactsFor(workflowFile) {
  if (workflowFile.includes('public-signal')) return ['reference/signal_trace.json', 'reports/recommendation_normalized_intake.json', 'reports/recommendation_cluster_gap_backlog.json'];
  if (workflowFile.includes('drafts')) return ['data/system/editorial_backlog.json', 'data/system/content_calendar.json', 'data/admin/editorial_manifest.json', 'data/admin/content_quality_report.json'];
  if (workflowFile.includes('publish')) return ['data/publish_state.json', 'dist/editorial-publishing-state.json'];
  if (workflowFile.includes('deploy')) return ['.build/indexnow-priority.txt', '.build/distribution-priority-urls.txt'];
  if (workflowFile.includes('sitemap')) return ['dist/sitemap.xml'];
  if (workflowFile.includes('validate')) return ['_ops/reports/generation_contract_report.json'];
  if (workflowFile.includes('build')) return ['dist/index.html', '.build/distribution-manifest.json'];
  if (workflowFile.includes('editorial-continuity')) return ['scripts/continuity/replenish_editorial_runway.mjs', 'data/continuity/editorial_continuity_report.json'];
  if (workflowFile.includes('admin-bulk')) return ['scripts/admin/approve_many.js', 'scripts/admin/reject_many.js', 'scripts/admin/set_publish_date_many.js', 'scripts/admin/write_action_receipt.js'];
  if (workflowFile.includes('admin-maintenance')) return ['scripts/quality/run_self_heal.js', 'scripts/quality/run_prevalidation.js', 'scripts/admin/write_action_receipt.js'];
  if (workflowFile.includes('agency-search-monitor')) return ['scripts/agency/refresh_search_health.js', 'data/agency/dashboard.json', 'data/query_intelligence/provider_opportunities.json'];
  if (workflowFile.includes('query-intelligence')) return ['scripts/query/build_provider_query_intelligence.js', 'scripts/query/admit_provider_candidates.js', 'data/query_intelligence/provider_opportunities.json'];
  if (workflowFile.includes('page-remediation')) return ['scripts/remediation/manage_remediations.js', 'data/remediation/remediation_queue.json', 'data/remediation/applied_search_controls.json'];
  if (workflowFile.includes('approved-content-email')) return ['scripts/social/send_approved_content_email.py', 'data/social/approved_content_email_state.json'];
  return [];
}
function classifyWorkflow(name) {
  if (name.includes('public-signal')) return 'public/social signal ingestion; keep and protect';
  if (name.includes('drafts')) return 'content generation, self-heal, prevalidation, quality reports, admin refresh';
  if (name.includes('publish')) return 'manual publish of approved and due content only';
  if (name.includes('deploy')) return 'deployment/distribution and indexing submission';
  if (name.includes('sitemap')) return 'manual indexing utility; retained intentionally as a narrow operator tool';
  if (name.includes('validate')) return 'repository validation lane';
  if (name.includes('build')) return 'manual build artifact lane; retained as non-mutating utility';
  if (name.includes('editorial-continuity')) return 'scheduled manual-review editorial runway replenishment; new work remains pending';
  if (name.includes('admin-bulk')) return 'owner-initiated bulk approval/rejection/publish-date actions; existing manual method preserved';
  if (name.includes('admin-maintenance')) return 'authenticated self-heal, prevalidation, and repository validation without approval-state mutation';
  if (name.includes('agency-search-monitor')) return 'scheduled and owner-triggered GSC, Bing, live-route, query-intelligence, and remediation monitoring';
  if (name.includes('query-intelligence')) return 'provider-fed recommendations and owner-selected pending draft admission only';
  if (name.includes('page-remediation')) return 'owner-approved existing-page remediation with separate approve and apply gates';
  if (name.includes('approved-content-email')) return 'approved-content social copy email notification to Claire';
  return 'workflow lane';
}
function main() {
  const scripts = packageScripts();
  const config = readJson('data/system/config.json', {});
  const workflowDir = path.join(root, '.github/workflows');
  const files = fs.existsSync(workflowDir) ? fs.readdirSync(workflowDir).filter((f) => /\.ya?ml$/.test(f)).sort() : [];
  const traces = [];
  for (const file of files) {
    const rel = `.github/workflows/${file}`;
    const yaml = fs.readFileSync(path.join(root, rel), 'utf8');
    const commands = referencedNpmScripts(yaml);
    const missingScripts = commands.filter((cmd) => !scripts[cmd]);
    const artifacts = requiredArtifactsFor(file);
    const missingArtifacts = artifacts.filter((artifact) => !fileExists(artifact));
    const hard_fails = [];
    const warnings = [];
    const checkout = yaml.match(/uses:\s*actions\/checkout@v(\d+)/);
    const setupNode = yaml.match(/uses:\s*actions\/setup-node@v(\d+)/);
    if (!checkout) hard_fails.push('missing checkout action');
    else if (Number(checkout[1]) < 7) warnings.push(`checkout action major v${checkout[1]} is behind the current supported workflow baseline`);
    if (!setupNode) warnings.push('workflow does not set up node directly; verify if intentional');
    else if (Number(setupNode[1]) < 7) warnings.push(`setup-node action major v${setupNode[1]} is behind the current supported workflow baseline`);
    if (missingScripts.length) hard_fails.push(`referenced npm scripts missing: ${missingScripts.join(', ')}`);
    if (missingArtifacts.length) warnings.push(`expected local-equivalent artifacts not present yet: ${missingArtifacts.join(', ')}`);
    const writesMain = /permissions:\s*[\s\S]*?contents:\s*write/.test(yaml) && /git\s+push/.test(yaml);
    if (writesMain) {
      if (!/concurrency:\s*\n\s*group:\s*horse-legal-guide-main-writer\s*\n\s*cancel-in-progress:\s*false/.test(yaml)) {
        hard_fails.push('main-writer workflow must use shared horse-legal-guide-main-writer concurrency with cancel-in-progress false');
      }
    }
    const trace = {
      workflow: file,
      path: rel,
      workflow_key: workflowKey(file),
      github_url: workflowUrl(config, file),
      purpose: classifyWorkflow(file),
      status: hard_fails.length ? 'failed' : 'passed',
      proof_type: 'local-equivalent-structure-and-artifact-trace',
      commands_checked: commands.map((cmd) => `npm run ${cmd}`),
      artifacts_checked: artifacts,
      missing_artifacts_warning_only: missingArtifacts,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      warnings,
      hard_fails,
      live_github_actions_status: 'not_executed_in_chatgpt_container'
    };
    const outName = file.replace(/\.ya?ml$/, '.json');
    writeJson(`reports/workflow-trace/${outName}`, trace);
    traces.push(trace);
  }
  const signalTrace = readJson('reference/signal_trace.json', null);
  const rawSignals = readJson('data/community/raw_signals.json', []);
  const normalizedSignals = readJson('data/community/normalized_signals.json', []);
  const ingestionReport = readJson('data/community/ingestion_report.json', null);
  const collectionStatus = readJson('data/community/collection_status.json', {});
  const adapterStatus = collectionStatus.adapter_status || (ingestionReport && ingestionReport.collection_status) || [];
  const failedSources = adapterStatus.filter((s) => s && s.status === 'failed');
  // A refused source must never roll up as healthy. Reddit is blocked for this
  // pipeline and says so by name now, so the trace reports it by name too.
  const blockedSources = adapterStatus.filter((s) => s && String(s.status || '').startsWith('blocked'));
  const freshCollected = Number(collectionStatus.collected_count || 0);
  const zeroReddit = Boolean(collectionStatus.zero_reddit_warning) || Number(collectionStatus.reddit_collected_count || 0) === 0;
  const signalHealth = signalTrace && ingestionReport && !failedSources.length && (Array.isArray(rawSignals) ? rawSignals.length : 0) > 0 ? (freshCollected > 0 && !zeroReddit && !blockedSources.length ? 'healthy' : 'healthy_with_live_followup') : 'warning';
  const signalStatus = {
    generated_at: new Date().toISOString(),
    status: signalHealth,
    preserved_pipeline: ['collect:signals', 'normalize:signals', 'map:signals', 'report:ingestion'],
    raw_signal_count: Array.isArray(rawSignals) ? rawSignals.length : 0,
    normalized_signal_count: Array.isArray(normalizedSignals) ? normalizedSignals.length : 0,
    fresh_collected_count: freshCollected,
    failed_source_count: failedSources.length,
    blocked_source_count: blockedSources.length,
    blocked_sources: blockedSources.slice(0, 20).map((s) => ({ source_key: s.source_key, platform: s.platform, status: s.status, reason: s.error || s.status })),
    collection_health: collectionStatus.collection_health || null,
    zero_reddit_warning: zeroReddit,
    live_followup_required: signalHealth === 'healthy_with_live_followup',
    failed_sources: failedSources.slice(0, 20).map((s) => ({ source_key: s.source_key, platform: s.platform, error: s.error || s.status })),
    signal_trace_present: Boolean(signalTrace),
    ingestion_report_present: Boolean(ingestionReport),
    workflow: 'public-signal-processing.yml',
    next_step: signalHealth === 'healthy' ? 'No action needed before local handoff. Live workflow must still run in GitHub after apply.' : (signalHealth === 'healthy_with_live_followup' ? 'Local source corpus and ingestion artifacts are healthy. Run Public Signal Processing after apply to prove fresh live collection and Reddit access.' : 'Signal corpus is missing or failed. Repair ingestion before handoff.')
  };
  writeJson('data/admin/signal_ingestion_status.json', signalStatus);
  writeJson('data/admin/signal_trace_summary.json', {
    generated_at: signalStatus.generated_at,
    status: signalStatus.status,
    fresh_collected_count: freshCollected,
    failed_source_count: failedSources.length,
    blocked_source_count: blockedSources.length,
    collection_health: collectionStatus.collection_health || null,
    zero_reddit_warning: zeroReddit,
    live_followup_required: signalHealth === 'healthy_with_live_followup',
    trace_file: 'reference/signal_trace.json',
    raw_signal_count: signalStatus.raw_signal_count,
    normalized_signal_count: signalStatus.normalized_signal_count,
    note: 'Raw user posts are not rendered publicly. This summary exists for admin/SEO workflow health.'
  });
  const health = {
    generated_at: new Date().toISOString(),
    status: traces.every((t) => t.status === 'passed') ? 'passed' : 'failed',
    live_github_actions_status: 'not_executed_in_chatgpt_container',
    truth_boundary: 'This trace proves YAML/script/artifact structure and local-equivalent availability only. Live GitHub Actions must run after ZIP apply, commit, and push.',
    workflows: traces
  };
  writeJson('data/admin/workflow_health.json', health);
  console.log(`Workflow trace complete: ${traces.filter((t) => t.status === 'passed').length}/${traces.length} passed.`);
}

if (require.main === module) main();
module.exports = { main };

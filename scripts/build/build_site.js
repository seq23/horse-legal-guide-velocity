const fs = require('fs');
const path = require('path');
const { readJson } = require('../lib/load_config');
const { loadPageTargets } = require('../lib/load_query_targets');
const { renderIndex, renderPolicyPage } = require('../lib/render_page');
const { writeApprovedPages } = require('./write_pages');
const { writeReferencePages } = require('./write_reference_pages');
const { writeHubPages } = require('./write_hubs');
const { writeSitemaps } = require('./write_sitemaps');
const { writeLlmsTxt } = require('./write_feeds');
const { writeAdminPage } = require('./write_admin');
const { writeEditorialPages } = require('./write_editorial_pages');
const { writePublicIndexes } = require('./write_public_indexes');
const { generateAnswerSurfaceReports } = require('../monitoring/generate_answer_surface_reports');
const { generateReports: generateRecommendationReports } = require('../recommendations/process_recommendations');
const { main: prepareDistributionArtifacts } = require('./prepare_distribution_artifacts');
const { writePageManifests } = require('./write_page_manifest');
const { resolveCanonicalTarget } = require('../lib/resolve_canonical_targets');
const { validatePreRenderPage } = require('./validate_page_contract_pre_render');
const { repairPageForRetry } = require('./regenerate_failed_pages');

function ensureDir(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function rimraf(target) { fs.rmSync(target, { recursive: true, force: true }); }
function writeJson(file, data) { ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }

function writeGenerationReport(report) {
  const reportDir = path.resolve(process.cwd(), '_ops/reports');
  ensureDir(reportDir);
  writeJson(path.join(reportDir, 'generation_contract_report.json'), report);
}


function updateState(relPath, updater) {
  const filePath = path.resolve(process.cwd(), relPath);
  let state = {};
  if (fs.existsSync(filePath)) state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const next = updater(state || {});
  writeJson(filePath, next);
}

function preflightApprovedPages(targets) {
  const approved = [];
  const rejected = [];

  for (const page of targets.filter((t) => t.review_status === 'approved')) {
    const firstPass = validatePreRenderPage(page, { resolveCanonicalTarget });
    if (firstPass.ok) {
      approved.push(page);
      continue;
    }
    const repaired = repairPageForRetry(page, firstPass.issues);
    const secondPass = validatePreRenderPage(repaired, { resolveCanonicalTarget });
    if (secondPass.ok) {
      approved.push(repaired);
    } else {
      rejected.push({ page: page.slug || page.page_id || page.title, stage: 'pre_render', attempts: [firstPass, secondPass] });
    }
  }

  return { approved, rejected };
}

function collectPostRenderFailures(results, label) {
  return (results || [])
    .filter((result) => !result.validation.ok)
    .map((result) => ({
      page: result.page.slug || result.page.page_id || result.page.title,
      stage: 'post_render',
      surface: label,
      issues: result.validation.issues
    }));
}

function main() {
  const config = readJson('data/system/config.json');
  updateState('data/content_refresh_state.json', (state) => ({
    ...state,
    last_refresh_started_at: new Date().toISOString(),
    last_refresh_status: 'running'
  }));
  const distDir = path.resolve(process.cwd(), 'dist');
  rimraf(distDir);
  ensureDir(distDir);

  fs.writeFileSync(path.join(distDir, 'index.html'), renderIndex(config));

  const disclaimerText = fs.readFileSync(path.resolve(process.cwd(), 'data/system/disclaimer_full.txt'), 'utf8').trim();
  const privacyText = fs.readFileSync(path.resolve(process.cwd(), 'data/system/privacy_policy_full.txt'), 'utf8').trim();

  ensureDir(path.join(distDir, 'disclaimer'));
  fs.writeFileSync(path.join(distDir, 'disclaimer', 'index.html'), renderPolicyPage({ title: 'Disclaimer', text: disclaimerText, url: '/disclaimer/' }));
  ensureDir(path.join(distDir, 'privacy-policy'));
  fs.writeFileSync(path.join(distDir, 'privacy-policy', 'index.html'), renderPolicyPage({ title: 'Privacy Policy', text: privacyText, url: '/privacy-policy/' }));

  for (const staticFile of ['robots.txt', '_headers', '_redirects', 'indexnow.txt']) {
    const src = path.resolve(process.cwd(), staticFile);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(distDir, path.basename(staticFile)));
  }

  const targets = loadPageTargets();
  const clusters = readJson('data/queries/clusters.json');
  const preflight = preflightApprovedPages(targets);
  const approvedPages = preflight.approved.map((t) => ({
    ...t,
    quick_answer: t.quick_answer || 'Generally, situations like this depend heavily on the exact facts, the documents involved, and the state-specific legal context.',
    what_this_means: 'This page is part of a manual-review educational system and is designed to explain the topic in a neutral, non-advisory way.',
    what_people_often_miss: 'People often assume that handshake expectations or generic templates solve the issue, when the real risk usually turns on details and documentation.',
    where_this_can_go_wrong: 'Problems tend to show up when the parties remember the deal differently, when documents are incomplete, or when state-specific rules are overlooked.',
    general_next_step: 'If you are dealing with a real situation, it often helps to get clarity before taking another step.'
  }));

  const pageResults = writeApprovedPages(distDir, approvedPages);
  writeHubPages(distDir, clusters, approvedPages);
  const candidates = readJson('data/reference/incoming_candidates.json');
  const referenceResults = writeReferencePages(distDir, candidates);
  writePublicIndexes(distDir, approvedPages, clusters, candidates);
  generateAnswerSurfaceReports();
  generateRecommendationReports();
  writeEditorialPages(distDir);
  writeSitemaps(distDir, config.site_domain || 'https://example.com');
  writeLlmsTxt(distDir, config.canonical_domain);
  writeAdminPage(distDir);
  prepareDistributionArtifacts();

  writePageManifests({ approved: pageResults, reference: referenceResults });

  const postFailures = [
    ...collectPostRenderFailures(pageResults, 'approved_pages'),
    ...collectPostRenderFailures(referenceResults, 'reference_pages')
  ];

  const report = {
    generated_at: new Date().toISOString(),
    pre_render: {
      approved_count: approvedPages.length,
      rejected_count: preflight.rejected.length,
      rejected: preflight.rejected
    },
    post_render: {
      approved_pages_checked: pageResults.length,
      reference_pages_checked: referenceResults.length,
      failure_count: postFailures.length,
      failures: postFailures
    }
  };
  writeGenerationReport(report);

  updateState('data/content_refresh_state.json', (state) => ({
    ...state,
    last_refresh_completed_at: new Date().toISOString(),
    last_refresh_status: preflight.rejected.length || postFailures.length ? 'failed' : 'passed',
    last_build_commit: process.env.GITHUB_SHA || state.last_build_commit || null
  }));

  if (preflight.rejected.length || postFailures.length) {
    const summary = [
      preflight.rejected.length ? `${preflight.rejected.length} pre-render rejection(s)` : null,
      postFailures.length ? `${postFailures.length} post-render validation failure(s)` : null
    ].filter(Boolean).join(' and ');
    throw new Error(`Generation contract failed: ${summary}. See _ops/reports/generation_contract_report.json`);
  }
}

try {
  main();
  process.exit(0);
} catch (err) {
  try {
    updateState('data/content_refresh_state.json', (state) => ({
      ...state,
      last_refresh_completed_at: new Date().toISOString(),
      last_refresh_status: 'failed'
    }));
  } catch {}
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}

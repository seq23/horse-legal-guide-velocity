const fs = require('fs');
const path = require('path');
const { readJson } = require('../lib/load_config');
const { loadPageTargets } = require('../lib/load_query_targets');
const { renderIndex, renderPolicyPage, renderAboutPage } = require('../lib/render_page');
const { writeApprovedPages } = require('./write_pages');
const { writeReferencePages } = require('./write_reference_pages');
const { writeHubPages } = require('./write_hubs');
const { writeSitemaps } = require('./write_sitemaps');
const { foldQuestionPages } = require('../search_loop/fold_question_pages');
const { writeLlmsTxt } = require('./write_feeds');
const { writeAdminPage } = require('./write_admin');
const { writeDraftPreviews } = require('./write_draft_previews');
const { writeEditorialPages } = require('./write_editorial_pages');
const { writePublicIndexes } = require('./write_public_indexes');
const { writeSectionRedirects } = require('./write_section_redirects');
const { generateAnswerSurfaceReports } = require('../monitoring/generate_answer_surface_reports');
const { generateReports: generateRecommendationReports } = require('../recommendations/process_recommendations');
const { main: prepareDistributionArtifacts } = require('./prepare_distribution_artifacts');
const { writePageManifests } = require('./write_page_manifest');
const { resolveCanonicalTarget } = require('../lib/resolve_canonical_targets');
const { validatePreRenderPage } = require('./validate_page_contract_pre_render');
const { repairPageForRetry } = require('./regenerate_failed_pages');
const { loadFreeze, decide: freezeDecide, recordHolds } = require('../search_intelligence/publish_freeze');

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

  // /about/ - the publisher's own page. Search Readiness item c6: every page
  // names Wise Covington PLLC as author and publisher, and until 26 Oct 2026
  // /about/ returned 404, so there was nowhere to verify who that is.
  // Guarded by _ops/validators/validate_about_page.js.
  ensureDir(path.join(distDir, 'about'));
  fs.writeFileSync(path.join(distDir, 'about', 'index.html'), renderAboutPage());

  // /editorial-policy/ - staged, client-gated. Authority audit 30 Oct 2026: the
  // site had no editorial policy page. This is a client site, so the text in
  // data/system/editorial_policy_full.txt publishes only once
  // data/system/editorial_policy_release.json records the client's written
  // approval. Until then nothing is written and the build names the stop.
  // Guarded by _ops/validators/validate_editorial_policy_gate.js.
  const editorialRelease = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/system/editorial_policy_release.json'), 'utf8'));
  if (editorialRelease.client_approved === true) {
    const editorialText = fs.readFileSync(path.resolve(process.cwd(), 'data/system/editorial_policy_full.txt'), 'utf8').trim();
    ensureDir(path.join(distDir, 'editorial-policy'));
    fs.writeFileSync(path.join(distDir, 'editorial-policy', 'index.html'), renderPolicyPage({ title: 'Editorial Policy', text: editorialText, url: '/editorial-policy/' }));
  } else {
    console.log('NAMED_STOP: EDITORIAL_POLICY_AWAITING_CLIENT_APPROVAL - /editorial-policy/ is staged in data/system/editorial_policy_full.txt and not built until data/system/editorial_policy_release.json records the client\'s written approval.');
  }

  for (const staticFile of ['robots.txt', '_headers', '_redirects', 'indexnow.txt']) {
    const src = path.resolve(process.cwd(), staticFile);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(distDir, path.basename(staticFile)));
  }

  // Icons, web manifest and the og:image share card (generated by
  // scripts/build/generate_brand_assets.py) are served from the site root.
  const brandDir = path.resolve(process.cwd(), 'assets/brand');
  for (const name of fs.readdirSync(brandDir)) fs.copyFileSync(path.join(brandDir, name), path.join(distDir, name));

  // IndexNow key file at the conventional /<key>.txt as well as /indexnow.txt
  // (the keyLocation the existing provider runners pass). Same key, one source:
  // the repo-root indexnow.txt. Guarded by _ops/validators/validate_indexnow_key_file.js.
  const indexNowKey = fs.readFileSync(path.resolve(process.cwd(), 'indexnow.txt'), 'utf8').trim();
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(indexNowKey)) throw new Error('indexnow.txt does not hold a valid IndexNow key (8-128 chars of a-z, A-Z, 0-9, -).');
  fs.writeFileSync(path.join(distDir, `${indexNowKey}.txt`), `${indexNowKey}\n`);

  const targets = loadPageTargets();
  const clusters = readJson('data/queries/clusters.json');
  const preflight = preflightApprovedPages(targets);
  // Publishing freeze (scripts/search_intelligence/publish_freeze.js): a page
  // target that was not live when the freeze began publishes only once one of
  // its queries has a measured number; held targets are re-decided every build.
  const freeze = loadFreeze();
  const freezeHolds = [];
  const publishable = preflight.approved.filter((t) => {
    const d = freezeDecide(freeze, 'page_targets', t.slug, [t.primary_query, ...(t.supporting_queries || [])]);
    if (!d.publish) freezeHolds.push({ slug: t.slug, query: t.primary_query, reason: d.reason });
    return d.publish;
  });
  recordHolds('page_targets', freezeHolds);
  const approvedPages = publishable.map((t) => ({
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
  // Search-loop question pages (hidden: no nav, no hub). Before writeSitemaps so
  // served pages reach the sitemap and IndexNow and held pages do not.
  foldQuestionPages(distDir);
  writeSectionRedirects(distDir, approvedPages, clusters);
  writeSitemaps(distDir, config.site_domain || 'https://example.com');
  writeLlmsTxt(distDir, config.canonical_domain);
  writeAdminPage(distDir);
  // After writeSitemaps, deliberately. The sitemap and indexnow writers sweep
  // dist/ for index.html, so an unapproved draft preview written before that
  // sweep would be advertised for crawling. write_sitemaps.js also excludes the
  // operator namespaces by name, so this is belt and braces rather than the only
  // thing standing between a draft and a sitemap entry.
  writeDraftPreviews(distDir);
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

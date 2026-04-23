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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function rimraf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function main() {
  const config = readJson('data/system/config.json');
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

  for (const staticFile of ['robots.txt', '_headers', '_redirects']) {
    const src = path.resolve(process.cwd(), staticFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(distDir, path.basename(staticFile)));
    }
  }

  const targets = loadPageTargets();
  const clusters = readJson('data/queries/clusters.json');
  const approvedPages = targets.filter((t) => t.review_status === 'approved').map((t) => ({
    ...t,
    quick_answer: 'Generally, situations like this depend heavily on the exact facts, the documents involved, and the state-specific legal context.',
    what_this_means: 'This page is part of a manual-review educational system and is designed to explain the topic in a neutral, non-advisory way.',
    what_people_often_miss: 'People often assume that handshake expectations or generic templates solve the issue, when the real risk usually turns on details and documentation.',
    where_this_can_go_wrong: 'Problems tend to show up when the parties remember the deal differently, when documents are incomplete, or when state-specific rules are overlooked.',
    general_next_step: 'If you are dealing with a real situation, it often helps to get clarity before taking another step.'
  }));

  writeApprovedPages(distDir, approvedPages);
  writeHubPages(distDir, clusters, approvedPages);
  const candidates = readJson('data/reference/incoming_candidates.json');
  writeReferencePages(distDir, candidates);
  writeSitemaps(distDir, config.site_domain || 'https://example.com');
  writeLlmsTxt(distDir, config.canonical_domain);
  writeAdminPage(distDir);
}

main();

const fs = require('fs');
const path = require('path');
const { readJson } = require('../lib/load_config');
const { detectQueryFamily, requiredTopModuleForFamily } = require('../lib/answer_shape');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(relPath, value) {
  const filePath = path.resolve(process.cwd(), relPath);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function slugToAbsolute(siteDomain, slug) {
  const base = String(siteDomain || 'https://example.com').replace(/\/$/, '');
  const normalized = String(slug || '/').startsWith('/') ? String(slug) : `/${String(slug)}`;
  return `${base}${normalized}`;
}

function compact(value) {
  return Array.from(new Set((value || []).filter(Boolean)));
}

function buildSeedQueries({ coverageMap, metadata, pageTargets, config }) {
  const metadataByPage = new Map(metadata.map((item) => [item.page_id, item]));
  const approvedPages = new Map(pageTargets.filter((page) => page.review_status === 'approved').map((page) => [page.slug, page]));

  const seeds = coverageMap.map((entry, index) => {
    const page = approvedPages.get(entry.target_page) || pageTargets.find((target) => target.slug === entry.target_page) || {};
    const pageMetadata = metadataByPage.get(page.page_id) || {};
    const queryFamily = detectQueryFamily(page);
    return {
      query_id: entry.query_id || `seed_${String(index + 1).padStart(4, '0')}`,
      vertical: config.vertical || 'horse-legal',
      cluster: page.cluster || entry.cluster || 'unassigned',
      query_text: entry.query_text,
      source: entry.source_signal || entry.query_source || 'internal_query_map',
      target_page: entry.target_page,
      intended_url: slugToAbsolute(config.site_domain || config.canonical_domain, entry.target_page),
      page_id: page.page_id || null,
      page_type: page.page_type || null,
      review_status: page.review_status || null,
      query_family: queryFamily,
      answer_shape: requiredTopModuleForFamily(queryFamily),
      funnel_stage: entry.funnel_stage || pageMetadata.funnel_stage || 'consideration',
      entity_target: entry.entity_target || pageMetadata.entity_target || 'horse-legal-guide',
      cta_target: entry.cta_target || pageMetadata.cta_target || '/contact/',
      supporting_queries: compact(page.supporting_queries).slice(0, 8)
    };
  });

  return seeds.sort((a, b) => a.cluster.localeCompare(b.cluster) || a.query_text.localeCompare(b.query_text));
}

function buildObservations(seeds) {
  return seeds.map((seed) => {
    const ready = Boolean(seed.target_page && seed.answer_shape && seed.review_status === 'approved');
    return {
      query_id: seed.query_id,
      vertical: seed.vertical,
      cluster: seed.cluster,
      query: seed.query_text,
      source: seed.source,
      intended_url: seed.intended_url,
      observation_status: 'unobserved',
      returned_urls: [],
      rank_estimate: null,
      readiness_status: ready ? 'ready_for_external_test' : 'not_ready_for_external_test',
      internal_readiness_score: ready ? 1 : 0,
      answer_shape: seed.answer_shape,
      query_family: seed.query_family,
      notes: ready
        ? 'Seed query is wired to an approved public target and can be used in future external citation checks.'
        : 'Seed query is missing one or more readiness requirements and should not be used for external surfacing tests yet.'
    };
  });
}

function scoreClusters(seeds, observations) {
  const obsById = new Map(observations.map((obs) => [obs.query_id, obs]));
  const grouped = new Map();
  for (const seed of seeds) {
    const row = grouped.get(seed.cluster) || {
      cluster: seed.cluster,
      total_queries: 0,
      ready_for_external_test: 0,
      observed_queries: 0,
      citation_hits: 0,
      page_types: new Set(),
      query_families: new Set(),
      answer_shapes: new Set(),
      target_pages: new Set()
    };
    row.total_queries += 1;
    row.page_types.add(seed.page_type || 'unknown');
    row.query_families.add(seed.query_family || 'unknown');
    row.answer_shapes.add(seed.answer_shape || 'unknown');
    row.target_pages.add(seed.target_page || 'unknown');
    const obs = obsById.get(seed.query_id);
    if (obs && obs.readiness_status === 'ready_for_external_test') row.ready_for_external_test += 1;
    if (obs && obs.observation_status !== 'unobserved') row.observed_queries += 1;
    if (obs && Array.isArray(obs.returned_urls) && obs.returned_urls.some((url) => String(url).includes(seed.target_page))) row.citation_hits += 1;
    grouped.set(seed.cluster, row);
  }

  const scorecard = Array.from(grouped.values()).map((row) => {
    const readinessScore = row.total_queries ? Math.round((row.ready_for_external_test / row.total_queries) * 100) : 0;
    const observedCoverage = row.total_queries ? Math.round((row.observed_queries / row.total_queries) * 100) : 0;
    const citationCoverage = row.total_queries ? Math.round((row.citation_hits / row.total_queries) * 100) : 0;
    let status = 'strong_internal_readiness';
    if (readinessScore < 50) status = 'needs_structure_and_mapping';
    else if (observedCoverage === 0) status = 'ready_but_unobserved';
    else if (citationCoverage === 0) status = 'observed_without_citation';
    return {
      cluster: row.cluster,
      total_queries: row.total_queries,
      ready_for_external_test: row.ready_for_external_test,
      observed_queries: row.observed_queries,
      citation_hits: row.citation_hits,
      readiness_score: readinessScore,
      observed_coverage_score: observedCoverage,
      citation_coverage_score: citationCoverage,
      status,
      page_types: Array.from(row.page_types).sort(),
      query_families: Array.from(row.query_families).sort(),
      answer_shapes: Array.from(row.answer_shapes).sort(),
      target_pages: Array.from(row.target_pages).sort()
    };
  }).sort((a, b) => a.readiness_score - b.readiness_score || a.cluster.localeCompare(b.cluster));

  return scorecard;
}

function buildBacklog(scorecard, seeds) {
  const seedsByCluster = new Map();
  for (const seed of seeds) {
    const list = seedsByCluster.get(seed.cluster) || [];
    list.push(seed);
    seedsByCluster.set(seed.cluster, list);
  }

  return scorecard.map((clusterRow, index) => {
    const seedsForCluster = seedsByCluster.get(clusterRow.cluster) || [];
    const familyCounts = {};
    for (const seed of seedsForCluster) {
      familyCounts[seed.query_family] = (familyCounts[seed.query_family] || 0) + 1;
    }
    const dominantFamilies = Object.entries(familyCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([family]) => family);

    const recommendations = [];
    if (clusterRow.readiness_score < 80) recommendations.push('Tighten page contracts and answer-shape coverage for this cluster before running external citation tests.');
    if (clusterRow.observed_queries === 0) recommendations.push('Run external citation observations for the seeded queries in this cluster to replace the current unobserved baseline.');
    if (dominantFamilies.includes('comparison')) recommendations.push('Prioritize stronger head-to-head comparison tables and verdict blocks for comparison-heavy queries.');
    if (dominantFamilies.includes('red_flags')) recommendations.push('Expand top-of-page red-flag modules so the warning-sign logic is easy for models to lift.');
    if (dominantFamilies.includes('timeline_or_process')) recommendations.push('Strengthen timeline modules with named phases and fork logic for process-heavy queries.');
    if (!recommendations.length) recommendations.push('Cluster is structurally ready; shift effort to distribution and real observation collection.');

    return {
      priority_rank: index + 1,
      cluster: clusterRow.cluster,
      priority_score: 100 - clusterRow.readiness_score,
      status: clusterRow.status,
      dominant_query_families: dominantFamilies,
      recommended_actions: compact(recommendations)
    };
  });
}

function buildDashboard(scorecard, backlog) {
  const rows = scorecard.map((row) => `\n<tr>\n<td>${row.cluster}</td>\n<td>${row.total_queries}</td>\n<td>${row.ready_for_external_test}</td>\n<td>${row.observed_queries}</td>\n<td>${row.readiness_score}%</td>\n<td>${row.citation_coverage_score}%</td>\n<td>${row.status}</td>\n</tr>`).join('');
  const backlogItems = backlog.slice(0, 10).map((item) => `\n<li><strong>${item.cluster}</strong> — priority ${item.priority_rank}. ${item.recommended_actions.join(' ')}</li>`).join('');
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Answer Surface Dashboard</title>\n<style>body{font-family:Arial,sans-serif;margin:32px;line-height:1.45}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}code{background:#f2f2f2;padding:2px 4px;border-radius:4px}</style>\n</head>\n<body>\n<h1>Answer Surface Dashboard</h1>\n<p>This dashboard is an <strong>internal readiness baseline</strong>. It does not claim external citation wins yet. It shows which clusters are structurally ready for external citation testing and where the next reinforcement work should go.</p>\n<table>\n<thead><tr><th>Cluster</th><th>Total queries</th><th>Ready for external test</th><th>Observed queries</th><th>Readiness score</th><th>Citation coverage</th><th>Status</th></tr></thead>\n<tbody>${rows}\n</tbody>\n</table>\n<h2>Top backlog priorities</h2>\n<ol>${backlogItems}</ol>\n<p>Generated file set: <code>data/answer_surface_monitoring/queries.seed.json</code>, <code>data/answer_surface_monitoring/observations.json</code>, <code>reports/answer_surface_scorecard.json</code>, <code>reports/answer_surface_expansion_backlog.json</code>.</p>\n</body>\n</html>\n`;
}

function generateAnswerSurfaceReports() {
  const config = readJson('data/system/config.json');
  const coverageMap = readJson('data/queries/query_coverage_map.json');
  const metadata = readJson('data/queries/query_metadata.json');
  const pageTargets = readJson('data/queries/page_targets.json');

  const seeds = buildSeedQueries({ coverageMap, metadata, pageTargets, config });
  const observations = buildObservations(seeds);
  const scorecard = scoreClusters(seeds, observations);
  const backlog = buildBacklog(scorecard, seeds);
  const dashboardHtml = buildDashboard(scorecard, backlog);

  writeJson('data/answer_surface_monitoring/queries.seed.json', seeds);
  writeJson('data/answer_surface_monitoring/observations.json', observations);
  writeJson('reports/answer_surface_scorecard.json', {
    generated_at: new Date().toISOString(),
    mode: 'internal_readiness_baseline',
    clusters: scorecard
  });
  writeJson('reports/answer_surface_expansion_backlog.json', {
    generated_at: new Date().toISOString(),
    items: backlog
  });
  const dashboardPath = path.resolve(process.cwd(), 'reports/answer-surface-dashboard.html');
  ensureDir(path.dirname(dashboardPath));
  fs.writeFileSync(dashboardPath, dashboardHtml);

  return {
    seed_count: seeds.length,
    observation_count: observations.length,
    cluster_count: scorecard.length,
    backlog_count: backlog.length
  };
}

if (require.main === module) {
  const summary = generateAnswerSurfaceReports();
  console.log(`OK: Generated answer-surface monitoring artifacts for ${summary.seed_count} seed queries across ${summary.cluster_count} cluster(s).`);
}

module.exports = { generateAnswerSurfaceReports };

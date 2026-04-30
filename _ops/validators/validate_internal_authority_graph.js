const { readJson, createReport } = require('./helpers');

const report = createReport('validate_internal_authority_graph', 'repo');
const graph = readJson('data/system/internal_authority_graph.json');
const clusters = readJson('data/queries/clusters.json');
const clusterIds = new Set(clusters.map((cluster) => cluster.cluster));
const graphIds = new Set((graph.hub_clusters || []).map((cluster) => cluster.cluster));

for (const clusterId of clusterIds) {
  if (!graphIds.has(clusterId)) {
    report.addIssue({ file: 'data/system/internal_authority_graph.json', code: 'missing_cluster_in_graph', message: `Authority graph is missing cluster ${clusterId}.`, fixHint: 'Include every query cluster in the authority graph hub list.' });
  }
}
if (!graph.organization_entity_id || !graph.site_entity_id || !graph.service_entity_id) {
  report.addIssue({ file: 'data/system/internal_authority_graph.json', code: 'missing_core_entity_links', message: 'Authority graph is missing one or more core entity ids.', fixHint: 'Provide organization, site, and service entity links.' });
}
report.finalize('Internal authority graph valid.');

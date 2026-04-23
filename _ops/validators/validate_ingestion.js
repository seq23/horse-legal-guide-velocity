const { readJson, fail, ok } = require('./helpers');
const incoming = readJson('data/reference/incoming_candidates.json');
const ids = new Set();
for (const candidate of incoming) {
  const id = candidate.candidate_id || candidate.query;
  if (ids.has(id)) fail(`Duplicate candidate id: ${id}`);
  ids.add(id);
}
ok('ingestion data valid');

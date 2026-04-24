const fs = require('fs');
const path = require('path');
const { readJson } = require('../lib/load_config');

function main() {
  const candidates = readJson('data/reference/incoming_candidates.json');
  const normalized = candidates.map((candidate, index) => ({
    candidate_id: candidate.candidate_id || `candidate-${index + 1}`,
    query: candidate.query,
    raw_phrasing: candidate.raw_phrasing || candidate.query,
    source_type: candidate.source_type || 'community',
    cluster: candidate.cluster || 'unassigned',
    intent: candidate.intent || 'informational',
    metadata: candidate.metadata || {}
  }));
  fs.writeFileSync(path.resolve(process.cwd(), 'data/community/normalized_signals.json'), JSON.stringify(normalized, null, 2) + '\n');
}

main();

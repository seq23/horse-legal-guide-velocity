const {
  DEFAULT_BODY_THRESHOLD,
  DEFAULT_INTENT_THRESHOLD,
  writeJson,
  readRenderedDocuments,
  auditDocuments,
  buildConsolidationLedger,
  familyMetrics
} = require('./similarity_engine');

function main() {
  const documents = readRenderedDocuments();
  const audit = auditDocuments(documents, {
    bodyThreshold: Number(process.env.PAGE_SIMILARITY_THRESHOLD || DEFAULT_BODY_THRESHOLD),
    intentThreshold: Number(process.env.PAGE_INTENT_THRESHOLD || DEFAULT_INTENT_THRESHOLD)
  });
  const report = {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source: 'fresh rendered dist HTML after the current build',
    policy: 'Measurements are advisory for existing live pages. No existing page is automatically rewritten, canonicalized, noindexed, redirected, or removed.',
    source_fingerprint: audit.fingerprint,
    thresholds: {
      body_similarity: audit.body_threshold,
      title_intent_similarity: audit.intent_threshold
    },
    metrics: {
      indexable_pages_measured: audit.documents_measured,
      duplicate_title_groups: audit.duplicate_title_groups.length,
      duplicate_description_groups: audit.duplicate_description_groups.length,
      high_similarity_pairs: audit.high_similarity_pairs.length,
      intent_overlap_pairs: audit.intent_overlap_pairs.length
    },
    family_metrics: familyMetrics(documents, audit),
    duplicate_title_groups: audit.duplicate_title_groups,
    duplicate_description_groups: audit.duplicate_description_groups,
    high_similarity_pairs: audit.high_similarity_pairs,
    intent_overlap_pairs: audit.intent_overlap_pairs
  };
  const ledger = buildConsolidationLedger(documents, audit);
  writeJson('data/admin/page_uniqueness_report.json', report);
  writeJson('data/admin/consolidation_review_ledger.json', ledger);
  writeJson('reports/quality/page_uniqueness_report.json', report);
  writeJson('reports/quality/consolidation_review_ledger.json', ledger);
  console.log(`Page uniqueness audit complete: ${report.metrics.indexable_pages_measured} indexable pages, ${report.metrics.high_similarity_pairs} high-similarity pairs, ${ledger.entry_count} owner-review clusters.`);
  return { report, ledger, documents };
}

if (require.main === module) main();
module.exports = { main };

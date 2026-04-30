function normalizeSupportingQueries(page) {
  const seen = new Set();
  const next = [];
  for (const q of [page.primary_query, ...(page.supporting_queries || [])]) {
    const clean = String(q || '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  return next.slice(0, 12);
}

function repairPageForRetry(page, issues = []) {
  const next = { ...page };
  const codes = new Set(issues.map((issue) => issue.code));

  if (!next.quick_answer || codes.has('missing_quick_answer') || codes.has('quick_answer_too_late')) {
    next.quick_answer = `Short answer: ${String(next.primary_query || next.title || 'this issue').replace(/\?+$/, '')} usually turns on the written record, the facts, and the state-specific rule that applies.`;
  }

  if (!Array.isArray(next.supporting_queries) || !next.supporting_queries.length || codes.has('missing_supporting_queries')) {
    next.supporting_queries = normalizeSupportingQueries(next);
  } else {
    next.supporting_queries = normalizeSupportingQueries(next);
  }

  return next;
}

module.exports = { repairPageForRetry };

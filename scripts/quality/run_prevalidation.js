const fs = require('fs');
const {
  readJson, writeJson, readText, loadBacklog, loadCalendar, saveBacklog, saveCalendar, syncCalendar,
  wordCount, advisoryWordBand, canonicalRoutingPresent, dataAtomPresent, directAnswerPresent,
  unresolvedTokens, repeatedPhraseWarnings, scoreFromFindings, atomTypeForEntry, atomIdForEntry
} = require('./content_ops_common');

function hasDisclaimer(text) {
  const t = String(text || '').toLowerCase();
  return t.includes('educational') && (t.includes('not legal advice') || t.includes('does not provide legal advice'));
}

function hasInventedContactRisk(text) {
  const t = String(text || '');
  const riskyPhone = /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(t);
  const unknownEmail = (t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).filter((email) => !email.toLowerCase().endsWith('@wisecovington.com'));
  return { riskyPhone, unknownEmail };
}

function prevalidate(entry) {
  const hard_fails = [];
  const warnings = [];
  const rel = entry.github_path;
  const raw = rel ? readText(rel, '') : '';
  if (!rel) hard_fails.push('missing github_path');
  if (!raw.trim()) hard_fails.push('draft file missing or blank');
  if (!entry.title) hard_fails.push('missing title');
  if (!entry.entry_id) hard_fails.push('missing entry_id');
  if (!entry.content_type) hard_fails.push('missing content_type');
  if (!['pending', 'approved', 'rejected', 'needs_revision', 'published'].includes(entry.status || 'pending')) warnings.push(`non-standard status: ${entry.status}`);
  if ((entry.publish_date || '') && !/^\d{4}-\d{2}-\d{2}$/.test(entry.publish_date)) hard_fails.push('invalid publish_date format');
  const tokens = unresolvedTokens(raw);
  if (tokens.length) hard_fails.push(`unresolved template tokens: ${tokens.slice(0, 3).join(', ')}`);
  if (!hasDisclaimer(raw)) hard_fails.push('missing educational/not-legal-advice disclaimer');
  if (!canonicalRoutingPresent(raw)) hard_fails.push('missing Wise Covington routing');
  if (!dataAtomPresent(raw)) hard_fails.push('missing defensible data atom');
  if (!directAnswerPresent(raw)) warnings.push('missing or weak direct/citation-ready answer block');
  const wc = wordCount(raw);
  const band = advisoryWordBand(entry.content_type);
  if (wc < band.soft_floor) warnings.push(`word count below advisory floor (${wc} < ${band.soft_floor}); warning only`);
  if (wc > band.soft_ceiling) warnings.push(`word count above advisory ceiling (${wc} > ${band.soft_ceiling}); warning only`);
  warnings.push(...repeatedPhraseWarnings(raw).slice(0, 4));
  const contactRisk = hasInventedContactRisk(raw);
  if (contactRisk.riskyPhone) hard_fails.push('possible hardcoded phone number/contact detail outside canonical firm data');
  if (contactRisk.unknownEmail.length) hard_fails.push(`unexpected email(s) outside canonical firm data: ${contactRisk.unknownEmail.join(', ')}`);
  const legalSafetyScore = hard_fails.some((f) => /legal|attorney|contact|disclaimer|invented|phone|email/i.test(f)) ? 0 : 100;
  const humanizationScore = scoreFromFindings({ warnings: warnings.filter((w) => /Template cadence|word count|direct/.test(w)), hard_fails: [] });
  const seoScore = entry.title && entry.slug ? scoreFromFindings({ warnings: warnings.filter((w) => /word count/.test(w)), hard_fails: [] }) : 60;
  const aeoScore = directAnswerPresent(raw) ? 96 : 78;
  const geoScore = dataAtomPresent(raw) && canonicalRoutingPresent(raw) ? 96 : 60;
  const llmCitationScore = Math.round((aeoScore + geoScore + humanizationScore) / 3);
  const routingScore = canonicalRoutingPresent(raw) ? 100 : 0;
  const prevalidation_status = hard_fails.length ? 'failed' : 'passed';
  return {
    entry_id: entry.entry_id,
    title: entry.title,
    content_type: entry.content_type,
    word_count: wc,
    advisory_word_band: band,
    hard_fails,
    warnings,
    prevalidation_status,
    approval_eligible: prevalidation_status === 'passed' && entry.self_heal_status === 'passed',
    scores: { humanizationScore, seoScore, aeoScore, geoScore, llmCitationScore, routingScore, legalSafetyScore }
  };
}

function main() {
  const backlog = loadBacklog();
  const results = [];
  const nextBacklog = backlog.map((entry) => {
    const result = prevalidate(entry);
    results.push(result);
    return {
      ...entry,
      data_atom_type: entry.data_atom_type || atomTypeForEntry(entry),
      data_atom_id: entry.data_atom_id || atomIdForEntry(entry),
      prevalidation_status: result.prevalidation_status,
      prevalidation_last_run_at: new Date().toISOString(),
      approval_eligible: result.approval_eligible,
      quality_warnings: result.warnings,
      hard_fails: result.hard_fails,
      humanization_score: result.scores.humanizationScore,
      seo_score: result.scores.seoScore,
      aeo_score: result.scores.aeoScore,
      geo_score: result.scores.geoScore,
      llm_citation_score: result.scores.llmCitationScore,
      routing_score: result.scores.routingScore,
      legal_safety_score: result.scores.legalSafetyScore,
      generation_validation: {
        ...(entry.generation_validation || {}),
        word_count: result.word_count,
        word_count_policy: 'warning_only',
        warnings: Array.from(new Set([...(entry.generation_validation?.warnings || []), ...result.warnings.filter((w) => /word count/.test(w))])),
        fails: entry.generation_validation?.fails || []
      }
    };
  });
  saveBacklog(nextBacklog);
  saveCalendar(syncCalendar(nextBacklog, loadCalendar()));
  const payload = {
    generated_at: new Date().toISOString(),
    policy: 'prevalidation gates approval eligibility; word count is warning-only',
    total: results.length,
    passed: results.filter((r) => r.prevalidation_status === 'passed').length,
    failed: results.filter((r) => r.prevalidation_status === 'failed').length,
    approval_eligible: results.filter((r) => r.approval_eligible).length,
    results
  };
  writeJson('data/admin/prevalidation_report.json', payload);
  console.log(`Prevalidation complete: ${payload.passed}/${payload.total} passed; ${payload.approval_eligible} approval eligible.`);
}

if (require.main === module) main();
module.exports = { main, prevalidate };

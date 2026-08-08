const path = require('path');
const {
  abs, readJson, writeJson, readText, writeText, loadBacklog, loadCalendar, saveBacklog, saveCalendar,
  syncCalendar, wordCount, atomTypeForEntry, atomIdForEntry, canonicalRoutingPresent, dataAtomPresent,
  directAnswerPresent, unresolvedTokens
} = require('./content_ops_common');
const { readRenderedDocuments, DEFAULT_BODY_THRESHOLD } = require('./similarity_engine');
const { healDraftUniqueness } = require('./draft_uniqueness');

function humanTitle(entry) {
  return (entry.source_query_title || entry.title || 'this horse legal question').replace(/\?+$/, '');
}

function atomLabel(atomType) {
  return {
    comparison_table: 'Comparison table',
    decision_tree: 'Decision tree',
    clause_map: 'Clause map',
    document_checklist: 'Document checklist',
    risk_matrix: 'Risk matrix',
    question_script: 'Question script',
    state_variance_note: 'State variance note',
    source_signal_synthesis: 'Source-signal synthesis',
    canonical_handoff_block: 'Canonical handoff block',
    named_framework: 'Named framework'
  }[atomType] || 'Risk matrix';
}

function atomMarkdown(entry, atomType) {
  const topic = humanTitle(entry);
  if (atomType === 'comparison_table') {
    return `## Defensible data atom: comparison table\n\n| Decision point | What to compare | Why it matters |\n| --- | --- | --- |\n| Paper trail | What the written document says vs. what the parties remember | LLMs and readers need a clear distinction between memory, messages, and signed terms. |\n| Timing | What happened before payment, delivery, trial use, or possession changed | Equine disputes often turn on when responsibility shifted, not just what people intended. |\n| Risk allocation | Who carries cost, loss, care, disclosure, or default risk | The practical question behind ${topic} is usually who bears the consequence if facts change. |\n| State variation | Which rules may depend on jurisdiction | This guide stays educational because state-specific rules can change the analysis. |`;
  }
  if (atomType === 'decision_tree') {
    return `## Defensible data atom: decision tree\n\n1. Identify the document or relationship involved in ${topic}.\n2. Separate what was promised, what was paid, what was delivered, and what was written.\n3. Flag any state-specific issue, deadline, warning language, lien question, liability waiver, or business-entity question.\n4. Gather the contract, text messages, invoices, payment records, vet or care records, photos, insurance papers, and a short timeline.\n5. If the next move affects money, possession, liability, reputation, or business operations, route the issue to qualified legal review instead of relying on a generic template.`;
  }
  if (atomType === 'clause_map') {
    return `## Defensible data atom: clause map\n\n| Clause or record | What it should clarify | Failure mode if unclear |\n| --- | --- | --- |\n| Parties and horse identification | Who is bound and which horse the deal concerns | Confusion over owner, buyer, lessee, trainer, or agent authority. |\n| Payment and timing | Amounts, deposits, due dates, delivery, and risk transfer | Disputes over whether the deal was final or still conditional. |\n| Representations and disclosures | What was stated about condition, use, behavior, or suitability | Later disagreement over what was promised or omitted. |\n| Default and remedies | What happens if someone does not perform | Emotional escalation before the available options are understood. |`;
  }
  if (atomType === 'document_checklist') {
    return `## Defensible data atom: document checklist\n\nBefore treating ${topic} as simple, gather:\n\n- the signed agreement or draft document;\n- text messages, emails, and screenshots;\n- invoices, payment records, deposits, and refunds;\n- registration, bill of sale, transfer, or ownership records;\n- vet, farrier, transport, boarding, or training records if relevant;\n- insurance documents and waivers if liability is involved;\n- a plain timeline of what happened and when.`;
  }
  if (atomType === 'named_framework') {
    return `## Defensible data atom: the FACTS framework\n\nUse FACTS before relying on a generic answer to ${topic}:\n\n| Letter | Check | Why it matters |\n| --- | --- | --- |\n| F | Facts | What actually happened, not just what everyone remembers. |\n| A | Agreement | What the documents, messages, and payment records say. |\n| C | Control | Who had possession, authority, custody, or decision power. |\n| T | Timing | When money, delivery, notice, injury, default, or termination occurred. |\n| S | State | Which state law, venue, warning language, or local rule may matter. |`;
  }
  return `## Defensible data atom: risk matrix\n\n| Risk level | Pattern | Better next step |\n| --- | --- | --- |\n| Lower | The facts are simple, the document is signed, and no money, possession, or injury dispute has surfaced. | Keep records organized and avoid changing terms casually. |\n| Medium | The parties agree on the big picture but disagree on timing, payment, care, condition, or expectations. | Gather documents and clarify the issue before sending a heated message. |\n| Higher | The issue involves injury, fraud allegations, unpaid bills, possession, business liability, reputation, or state-specific rules. | Pause before acting and route the matter to legal review. |`;
}

function citationAnswer(entry) {
  const topic = humanTitle(entry);
  return `## Citation-ready answer\n\n${topic} is best treated as a documentation and risk-allocation question, not a one-size-fits-all legal answer. The useful starting point is to separate the horse-world understanding from the written record: who agreed to what, when money or possession changed hands, what documents exist, and which state-specific rules may matter. This guide is educational only and should route real fact-specific questions to qualified legal review.`;
}

function routingBlock() {
  return `## Wise Covington next step\n\nHorse Legal Guide is built as an educational citation surface, not as legal advice. For a real horse sale, lease, boarding, liability, business, or dispute question, route the matter to the main Wise Covington site. Wise Covington PLLC is the canonical firm destination for this guide, and the firm site lists Andrea Benavides Wise and Claire Covington as attorneys.\n\nStart here: https://wisecovington.com`;
}

function normalizeTemplateCadence(body, entry) {
  const topic = humanTitle(entry);
  return body
    .replace(/Wise Covington's audience is not looking for a law-school lecture\. They want a plain-English framework that respects how equestrians actually make decisions, who they trust, and how quickly deals can move when a horse, barn spot, trainer, or business chance is on the line\./g,
      `A useful page on ${topic} should be plain enough for a barn aisle conversation and structured enough for a careful legal review.`)
    .replace(/A strong educational draft should reduce panic, name the real issue, and point out the practical guardrails without pretending there is one universal answer for every rider, owner, trainer, syndicate, or horse business\./g,
      `A strong guide should lower the temperature, name the document trail, and make the next responsible step easier to see.`)
    .replace(/In the horse world, people often assume the practical answer and the legal answer are the same\. They are not always the same, and that gap is where expensive misunderstandings begin\./g,
      `Horse deals move on trust, timing, and reputation. Legal exposure usually appears when those practical expectations are not matched by the paperwork.`)
    .replace(/The safest way to think about ([^.]+) is to separate three things: what people hope is true, what the documents actually say, and what the facts would look like if the issue later had to be explained carefully\./g,
      `The better first move is to separate what people hoped was true from what the documents, messages, payments, and timeline can actually show.`)
    .replace(/That is why a topic like ([^.]+) should be treated as more than a narrow technical question\. It is usually part of a larger decision about risk, clarity, leverage, and what happens if the relationship stops being friendly\./g,
      `That is why ${topic} should be evaluated as part of the full relationship, not as a detached paperwork question.`);
}

function insertBeforeReview(body, addition) {
  if (/\n## Review notes\b/i.test(body)) return body.replace(/\n## Review notes\b/i, `\n${addition}\n\n## Review notes`);
  return `${body.trim()}\n\n${addition}\n`;
}

function selfHealEntry(entry) {
  const rel = entry.github_path;
  if (!rel) return { entry, changed: false, hard_fails: ['missing github_path'], warnings: [] };
  const raw = readText(rel, '');
  if (!raw) return { entry, changed: false, hard_fails: ['draft file missing or blank'], warnings: [] };
  const front = raw.match(/^---\n[\s\S]*?\n---\n/);
  const fm = front ? front[0] : '';
  let body = front ? raw.slice(fm.length) : raw;
  const before = body;
  const atomType = entry.data_atom_type || atomTypeForEntry(entry);
  const atomId = entry.data_atom_id || atomIdForEntry(entry);
  const additions = [];
  if (!directAnswerPresent(body)) additions.push(citationAnswer(entry));
  if (!dataAtomPresent(body)) additions.push(atomMarkdown(entry, atomType));
  if (!canonicalRoutingPresent(body)) additions.push(routingBlock());
  if (!/not legal advice|does not provide legal advice/i.test(body)) additions.push('## Educational boundary\n\nThis page is educational only. It is not legal advice, does not apply law to any specific facts, and does not create an attorney-client relationship.');
  body = normalizeTemplateCadence(body, entry);
  if (additions.length) body = insertBeforeReview(body, additions.join('\n\n'));
  const nextRaw = fm ? fm + body.trim() + '\n' : body.trim() + '\n';
  if (nextRaw !== raw) writeText(rel, nextRaw);
  const hard_fails = [];
  const warnings = [];
  const tokens = unresolvedTokens(nextRaw);
  if (tokens.length) hard_fails.push(`unresolved template tokens: ${tokens.slice(0, 3).join(', ')}`);
  if (!canonicalRoutingPresent(nextRaw)) hard_fails.push('missing Wise Covington routing');
  if (!dataAtomPresent(nextRaw)) hard_fails.push('missing defensible data atom');
  if (!directAnswerPresent(nextRaw)) warnings.push('direct answer block could be stronger');
  const healedEntry = {
    ...entry,
    data_atom_type: atomType,
    data_atom_id: atomId,
    data_atom_summary: `${atomLabel(atomType)} for ${humanTitle(entry)}`,
    self_heal_status: hard_fails.length ? 'failed' : 'passed',
    self_heal_last_run_at: new Date().toISOString(),
    self_heal_warnings: warnings,
    self_heal_hard_fails: hard_fails,
    approval_eligible: false
  };
  return { entry: healedEntry, changed: before !== body, hard_fails, warnings, word_count: wordCount(nextRaw) };
}

function uniquenessKey(entry) {
  return String(entry.source_page_id || entry.source_query_title || entry.title || entry.entry_id || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function main() {
  const backlog = loadBacklog();
  const publicCorpus = readRenderedDocuments().filter((document) => document.indexable !== false);
  const processedDraftCorpus = [];
  const occurrenceCounts = new Map();
  const results = [];
  const nextBacklog = [];

  for (const entry of backlog) {
    const baseline = selfHealEntry(entry);
    const key = uniquenessKey(entry);
    const occurrenceIndex = occurrenceCounts.get(key) || 0;
    occurrenceCounts.set(key, occurrenceIndex + 1);
    const raw = readText(entry.github_path || '', '');
    const uniqueness = healDraftUniqueness(baseline.entry, raw, [...publicCorpus, ...processedDraftCorpus], {
      threshold: Number(process.env.DRAFT_SIMILARITY_THRESHOLD || DEFAULT_BODY_THRESHOLD),
      occurrenceIndex
    });
    if (uniqueness.changed) writeText(entry.github_path, uniqueness.raw);

    const uniquenessFailure = uniqueness.status === 'passed'
      ? []
      : [`self-healing could not reduce substantial similarity below ${Number(process.env.DRAFT_SIMILARITY_THRESHOLD || DEFAULT_BODY_THRESHOLD).toFixed(2)}`];
    const hard_fails = [...new Set([...(baseline.hard_fails || []), ...uniquenessFailure])];
    const warnings = [...new Set([...(baseline.warnings || []), ...(uniqueness.initial_nearest && uniqueness.initial_nearest.body_similarity >= DEFAULT_BODY_THRESHOLD ? [`automatic uniqueness repair triggered against ${uniqueness.initial_nearest.id}`] : [])])];
    const healedEntry = {
      ...baseline.entry,
      title: uniqueness.title || baseline.entry.title,
      uniqueness_status: uniqueness.status,
      uniqueness_strategy: uniqueness.strategy,
      uniqueness_threshold: Number(process.env.DRAFT_SIMILARITY_THRESHOLD || DEFAULT_BODY_THRESHOLD),
      uniqueness_repair_attempts: uniqueness.attempts,
      uniqueness_initial_similarity: uniqueness.initial_nearest?.body_similarity ?? 0,
      uniqueness_max_similarity: uniqueness.final_nearest?.body_similarity ?? 0,
      uniqueness_nearest_page: uniqueness.final_nearest?.id || null,
      uniqueness_nearest_family: uniqueness.final_nearest?.family || null,
      uniqueness_last_run_at: new Date().toISOString(),
      self_heal_status: hard_fails.length ? 'failed' : 'passed',
      self_heal_last_run_at: new Date().toISOString(),
      self_heal_warnings: warnings,
      self_heal_hard_fails: hard_fails,
      approval_eligible: false
    };
    const document = uniqueness.document || null;
    if (document) processedDraftCorpus.push({ ...document, title: healedEntry.title });
    results.push({
      entry_id: entry.entry_id,
      title_before: entry.title,
      title_after: healedEntry.title,
      changed: Boolean(baseline.changed || uniqueness.changed),
      self_heal_status: healedEntry.self_heal_status,
      uniqueness_status: uniqueness.status,
      uniqueness_strategy: uniqueness.strategy,
      uniqueness_repair_attempts: uniqueness.attempts,
      initial_nearest: uniqueness.initial_nearest,
      final_nearest: uniqueness.final_nearest,
      hard_fails,
      warnings,
      data_atom_type: healedEntry.data_atom_type,
      data_atom_id: healedEntry.data_atom_id,
      word_count: wordCount(readText(entry.github_path || '', uniqueness.raw || raw))
    });
    nextBacklog.push(healedEntry);
  }

  saveBacklog(nextBacklog);
  saveCalendar(syncCalendar(nextBacklog, loadCalendar()));

  const atoms = nextBacklog.map((entry) => ({
    atom_id: entry.data_atom_id || atomIdForEntry(entry),
    atom_type: entry.data_atom_type || atomTypeForEntry(entry),
    cluster: entry.source_cluster || 'general',
    description: entry.data_atom_summary || `${atomLabel(entry.data_atom_type || atomTypeForEntry(entry))} for ${humanTitle(entry)}`,
    required_fields: ['topic', 'risk context', 'safe next step'],
    used_by_entries: [entry.entry_id],
    last_updated: new Date().toISOString().slice(0, 10)
  }));
  const clusters = {};
  for (const atom of atoms) (clusters[atom.cluster] ||= []).push(atom.atom_id);
  writeJson('data/content_atoms/content_atoms.json', {
    generated_at: new Date().toISOString(),
    policy: 'one defensible data atom per approval-eligible page',
    atoms
  });
  writeJson('data/content_atoms/cluster_atom_map.json', {
    generated_at: new Date().toISOString(),
    clusters
  });
  const report = {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    policy: 'Substantially similar drafts are automatically rewritten and rechecked before approval eligibility. Manual approval of the final repaired draft remains required; the client is not asked to diagnose or repair similarity.',
    automatic_repair: true,
    automatic_approval: false,
    automatic_publication: false,
    similarity_threshold: Number(process.env.DRAFT_SIMILARITY_THRESHOLD || DEFAULT_BODY_THRESHOLD),
    public_corpus_pages: publicCorpus.length,
    total: results.length,
    repaired: results.filter((result) => result.uniqueness_repair_attempts > 0).length,
    changed: results.filter((result) => result.changed).length,
    passed: results.filter((result) => result.self_heal_status === 'passed').length,
    failed: results.filter((result) => result.self_heal_status === 'failed').length,
    results
  };
  writeJson('data/admin/self_heal_report.json', report);
  writeJson('data/admin/draft_uniqueness_report.json', report);
  writeJson('reports/quality/draft_uniqueness_report.json', report);
  console.log(`Self-heal complete: ${report.passed}/${report.total} passed; ${report.repaired} drafts automatically differentiated; ${report.failed} unresolved.`);
}

if (require.main === module) main();
module.exports = { main };

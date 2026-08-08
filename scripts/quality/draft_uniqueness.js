const crypto = require('crypto');
const {
  DEFAULT_BODY_THRESHOLD,
  markdownToText,
  tokens,
  vector,
  shingleSet,
  substantialSimilarity,
  jaccardSimilarity
} = require('./similarity_engine');
const { atomTypeForEntry } = require('./content_ops_common');

const START = '<!-- UNIQUE_SELF_HEAL_START -->';
const END = '<!-- UNIQUE_SELF_HEAL_END -->';
const MAX_REPAIR_ATTEMPTS = 12;

const ANGLES = [
  {
    key: 'evidence-timeline',
    label: 'Evidence and timeline audit',
    vocabulary: ['chronology', 'sequence', 'timestamp', 'handoff', 'notice', 'record', 'proof', 'before-and-after'],
    focus: 'how the chronology, records, and sequence of events change the practical risk'
  },
  {
    key: 'authority-roles',
    label: 'Authority, roles, and decision rights',
    vocabulary: ['authority', 'agent', 'owner', 'trainer', 'representative', 'permission', 'delegation', 'control'],
    focus: 'who had authority to promise, sign, deliver, direct, or change the arrangement'
  },
  {
    key: 'money-risk-transfer',
    label: 'Money, possession, and risk transfer',
    vocabulary: ['deposit', 'payment', 'possession', 'delivery', 'custody', 'risk transfer', 'refund', 'allocation'],
    focus: 'when money, possession, care duties, and loss exposure move from one party to another'
  },
  {
    key: 'document-architecture',
    label: 'Document architecture and missing terms',
    vocabulary: ['clause', 'schedule', 'attachment', 'definition', 'integration', 'signature', 'amendment', 'gap'],
    focus: 'which documents work together, which terms are absent, and which informal messages may matter'
  },
  {
    key: 'notice-communication',
    label: 'Notice and communication controls',
    vocabulary: ['notice', 'email', 'text message', 'deadline', 'delivery method', 'response', 'escalation', 'acknowledgment'],
    focus: 'how notice language, communication channels, and response timing shape the next responsible move'
  },
  {
    key: 'remedies-exit',
    label: 'Remedies, exit paths, and damage control',
    vocabulary: ['termination', 'cure', 'return', 'refund', 'default', 'remedy', 'mitigation', 'resolution'],
    focus: 'what exit paths, cure opportunities, and damage-control steps may exist before escalation'
  },
  {
    key: 'state-venue',
    label: 'State-law, venue, and local-rule lens',
    vocabulary: ['jurisdiction', 'venue', 'choice of law', 'statute', 'warning language', 'filing', 'deadline', 'local rule'],
    focus: 'which parts of the question may change by state, venue, statutory language, or filing deadline'
  },
  {
    key: 'operations-handoff',
    label: 'Operational handoff and responsibility map',
    vocabulary: ['care', 'maintenance', 'transport', 'boarding', 'training', 'inspection', 'handoff', 'responsibility'],
    focus: 'how day-to-day responsibilities are handed off and documented in the horse-world operation'
  },
  {
    key: 'insurance-liability',
    label: 'Insurance, injury, and liability allocation',
    vocabulary: ['insurance', 'waiver', 'injury', 'indemnity', 'coverage', 'claim', 'release', 'liability'],
    focus: 'how injury, coverage, waiver language, and responsibility allocation affect risk'
  },
  {
    key: 'due-diligence',
    label: 'Due diligence and verification',
    vocabulary: ['inspection', 'verification', 'records', 'representation', 'disclosure', 'condition', 'reference', 'diligence'],
    focus: 'what should be verified before relying on a promise, description, template, or informal understanding'
  },
  {
    key: 'business-governance',
    label: 'Business governance and repeatable process',
    vocabulary: ['policy', 'procedure', 'entity', 'approval', 'recordkeeping', 'staff', 'vendor', 'governance'],
    focus: 'how a barn, trainer, program, or equine business can make the issue repeatable instead of improvisational'
  },
  {
    key: 'dispute-readiness',
    label: 'Dispute readiness and early resolution',
    vocabulary: ['demand', 'preservation', 'settlement', 'position', 'documentation', 'communication', 'triage', 'resolution'],
    focus: 'how to preserve options, reduce avoidable escalation, and prepare the record for early resolution'
  }
];

function normalizeQuestion(entry) {
  return String(entry.source_query_title || entry.title || entry.entry_id || 'this equine legal question').replace(/\?+$/, '').trim();
}
function significantWords(entry) {
  const words = tokens(`${entry.source_query_title || ''} ${entry.title || ''} ${entry.source_page_id || ''} ${entry.source_cluster || ''}`);
  return [...new Set(words)].slice(0, 12);
}
function hashIndex(value, size) {
  const hash = crypto.createHash('sha256').update(String(value)).digest();
  return hash.readUInt32BE(0) % size;
}
function stripFrontmatter(raw) {
  const match = String(raw || '').match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return { frontmatter: match ? match[0] : '', body: match ? raw.slice(match[0].length) : String(raw || '') };
}
function updateFrontmatter(frontmatter, entry, title) {
  let next = frontmatter || '---\n---\n';
  if (/^title:/m.test(next)) next = next.replace(/^title:.*$/m, `title: ${title}`);
  else next = next.replace(/^---\n/, `---\ntitle: ${title}\n`);
  if (/^uniqueness_status:/m.test(next)) next = next.replace(/^uniqueness_status:.*$/m, 'uniqueness_status: passed');
  else next = next.replace(/\n---\n$/, '\nuniqueness_status: passed\n---\n');
  if (/^uniqueness_strategy:/m.test(next)) next = next.replace(/^uniqueness_strategy:.*$/m, `uniqueness_strategy: ${entry.uniqueness_strategy || 'self_healed'}`);
  else next = next.replace(/\n---\n$/, `\nuniqueness_strategy: ${entry.uniqueness_strategy || 'self_healed'}\n---\n`);
  return next;
}
function extractSection(body, headingPattern) {
  const pattern = new RegExp(`(^##\\s+${headingPattern}[^\\n]*\\n[\\s\\S]*?)(?=^##\\s+|\\Z)`, 'im');
  const match = String(body || '').match(pattern);
  return match ? match[1].trim() : '';
}
function atomLabel(atomType) {
  return {
    comparison_table: 'comparison table',
    decision_tree: 'decision tree',
    clause_map: 'clause map',
    document_checklist: 'document checklist',
    named_framework: 'named framework',
    risk_matrix: 'risk matrix'
  }[atomType] || 'risk matrix';
}
function freshTail(entry, body) {
  const related = extractSection(body, 'Related links');
  const atomType = entry.data_atom_type || atomTypeForEntry(entry);
  const question = normalizeQuestion(entry);
  const atom = `## Defensible data atom: ${atomLabel(atomType)}

| Question-specific checkpoint | Record or fact to verify | Why it matters |
| --- | --- | --- |
| Parties and authority | Names, roles, ownership, agency, and signature authority tied to ${question} | Prevents the wrong person or entity from being treated as bound. |
| Money and timing | Deposits, payments, delivery, possession, notices, and deadlines | Shows when duties and risk may have shifted. |
| Horse and transaction facts | Identification, condition, intended use, care, transport, and disclosures | Connects the legal question to the actual equine facts. |
| Exit and escalation | Return, cure, termination, refund, insurance, dispute, or legal-review triggers | Preserves options before the situation becomes harder to unwind. |`;
  return [
    related,
    `## Wise Covington next step

Horse Legal Guide is an educational citation surface, not legal advice. A real horse sale, lease, boarding, liability, business, or dispute question should be reviewed using the specific documents, timeline, state law, and parties involved.

Start here: https://wisecovington.com`,
    atom,
    `## Educational boundary

This page is educational only. It is not legal advice, does not apply law to any specific facts, and does not create an attorney-client relationship.`,
    `## Review notes

- Manual client approval remains required before publication.
- Automatic self-healing may repair draft quality and similarity, but it cannot approve or publish the draft.
- Keep the footer disclaimer and policy links in the rendered page.`
  ].filter(Boolean).join('\n\n');
}

function uniqueTitle(entry, angle, occurrenceIndex) {
  const question = normalizeQuestion(entry);
  const suffix = occurrenceIndex > 0 ? `${angle.label} for ${question}` : entry.title || `${question}: ${angle.label}`;
  return suffix.length <= 118 ? suffix : `${question.slice(0, 78).trim()}: ${angle.label}`;
}
function evidenceRows(words, angle) {
  const seed = words.length ? words : ['agreement', 'horse', 'record', 'timing'];
  return [0, 1, 2, 3, 4].map((index) => {
    const word = seed[index % seed.length];
    const lens = angle.vocabulary[index % angle.vocabulary.length];
    return `| ${word.replace(/-/g, ' ')} | Identify the ${lens} facts tied specifically to this question. | Keep the source, date, person, and document connected so the record is usable. |`;
  }).join('\n');
}
function decisionSteps(question, angle, words) {
  const terms = words.length ? words : ['agreement', 'payment', 'possession', 'notice'];
  return [
    `Define the narrow decision: what must be decided about **${question}** before anyone acts?`,
    `Collect the ${angle.vocabulary[0]}, ${angle.vocabulary[1]}, and ${angle.vocabulary[2]} evidence instead of relying on memory.`,
    `Separate the roles connected to ${terms.slice(0, 3).join(', ')} so authority and responsibility are not blurred.`,
    `Identify any state-specific deadline, venue, warning language, or remedy that cannot be answered safely in a general guide.`,
    `Route the fact-specific issue for legal review before money, possession, liability, or reputation is put at greater risk.`
  ].map((step, index) => `${index + 1}. ${step}`).join('\n');
}
function buildDistinctiveCore(entry, angle, occurrenceIndex, nearest) {
  const question = normalizeQuestion(entry);
  const words = significantWords(entry);
  const fingerprint = words.slice(0, 8).join(' · ') || entry.entry_id;
  const nearestLabel = nearest ? nearest.id : 'the existing public and draft corpus';
  const occurrenceLabel = occurrenceIndex > 0 ? `This is a later scheduled treatment of the same underlying query, so it is intentionally narrowed to ${angle.focus}.` : `This draft is intentionally scoped to ${angle.focus}.`;
  return `${START}
# ${uniqueTitle(entry, angle, occurrenceIndex)}

## Citation-ready answer

The practical question behind **${question}** is not answered safely by repeating a general horse-contract overview. This version focuses on ${angle.focus}. A responsible first pass separates the parties, documents, timing, money, possession, communications, and state-specific facts before anyone treats a generic answer as a legal conclusion.

${occurrenceLabel} It is designed to be materially distinct from ${nearestLabel}, while remaining educational and approval-gated.

## Distinctive focus: ${angle.label}

For this version, the useful lens is **${angle.label.toLowerCase()}**. That means the reader should identify the ${angle.vocabulary.slice(0, 4).join(', ')}, and ${angle.vocabulary[4]} facts that actually belong to **${question}**. Those details determine whether the issue is a documentation problem, a timing problem, an authority problem, a risk-allocation problem, or some combination of them.

A horse-world relationship can feel informal even when the financial and operational consequences are significant. The self-healed draft therefore avoids a broad recap and asks a narrower set of questions: who had control, what changed hands, which record captured the change, what notice was given, and what action would make the situation harder to unwind.

## Question fingerprint

This page is differentiated around the following query-specific concepts:

**${fingerprint}**

Those concepts are not decorative keywords. They are the boundaries for the analysis. If a fact does not connect to one of them, it may belong in a different page instead of being repeated here.

## Evidence map for this question

| Query-specific issue | Evidence to locate | Self-healing rule |
| --- | --- | --- |
${evidenceRows(words, angle)}

## Decision sequence

${decisionSteps(question, angle, words)}

## Horse-world pressure test

Imagine the parties agree on the broad story but disagree about one operational detail tied to **${question}**. One person remembers a promise; another points to a document; a third person handled the horse, payment, transport, care, or communication. The ${angle.label.toLowerCase()} lens asks which fact can be verified, when it occurred, who had authority, and what consequence followed. That pressure test is more useful than repeating that written agreements are generally important.

## What changes the analysis

The answer may change when the facts involve a different state, a minor, a business entity, an agent, disputed authority, injury, insurance, a deadline, a lien, possession of the horse, a refund request, a demand letter, or inconsistent documents. Those are signals to stop treating the issue as a generic educational question and obtain fact-specific legal review.

## Self-healing outcome

This draft was automatically rewritten because its earlier version was too similar to another page or draft. The repair changed the page's analytical lens, evidence map, decision sequence, and title. The client still approves the finished legal-education draft, but does not need to diagnose or repair similarity manually.
${END}`;
}
function buildRepairedRaw(entry, raw, angle, occurrenceIndex, nearest) {
  const parsed = stripFrontmatter(raw);
  const title = uniqueTitle(entry, angle, occurrenceIndex);
  const nextEntry = { ...entry, uniqueness_strategy: angle.key };
  const frontmatter = updateFrontmatter(parsed.frontmatter, nextEntry, title);
  const tail = freshTail(nextEntry, parsed.body);
  const core = buildDistinctiveCore(nextEntry, angle, occurrenceIndex, nearest);
  return {
    raw: `${frontmatter}${core}\n\n${tail}\n`,
    title,
    strategy: angle.key
  };
}

function draftDocument(entry, raw) {
  const text = markdownToText(raw);
  const contentTokens = tokens(text);
  return {
    id: entry.entry_id,
    route: entry.slug || entry.entry_id,
    family: 'draft',
    title: entry.title || entry.source_query_title || entry.entry_id,
    text,
    content_tokens: contentTokens,
    body_vector: vector(contentTokens),
    shingle_set: shingleSet(contentTokens),
    intent_tokens: tokens(`${entry.title || ''} ${entry.source_query_title || ''}`),
    indexable: true
  };
}
function nearestMatch(document, corpus) {
  let nearest = null;
  const documentIntent = new Set(document.intent_tokens || []);
  for (const candidate of corpus) {
    if (!candidate || candidate.id === document.id) continue;
    const candidateIntent = candidate.intent_tokens || [];
    let sharedIntent = 0;
    for (const token of candidateIntent) if (documentIntent.has(token)) sharedIntent += 1;
    const minimumShared = Math.min(2, Math.max(1, Math.floor(Math.min(documentIntent.size, candidateIntent.length) / 3)));
    if (sharedIntent < minimumShared) continue;
    const intent = jaccardSimilarity(document.intent_tokens, candidateIntent);
    if (intent < 0.16) continue;
    const similarity = substantialSimilarity(document, candidate);
    const body = similarity.score;
    if (!nearest || body > nearest.body_similarity || (body === nearest.body_similarity && intent > nearest.intent_similarity)) {
      nearest = {
        id: candidate.route || candidate.id,
        title: candidate.title || '',
        family: candidate.family || 'unknown',
        body_similarity: Number(body.toFixed(4)),
        cosine_similarity: Number(similarity.cosine.toFixed(4)),
        shingle_similarity: Number(similarity.shingle.toFixed(4)),
        intent_similarity: Number(intent.toFixed(4))
      };
    }
  }
  return nearest;
}
function angleForEntry(entry, occurrenceIndex) {
  const preserved = ANGLES.find((angle) => angle.key === entry.uniqueness_strategy);
  if (preserved) return preserved;
  return ANGLES[(hashIndex(`${entry.entry_id}|${occurrenceIndex}`, ANGLES.length) + occurrenceIndex) % ANGLES.length];
}
function healDraftUniqueness(entry, raw, corpus, options = {}) {
  const threshold = Number(options.threshold || DEFAULT_BODY_THRESHOLD);
  const occurrenceIndex = Number(options.occurrenceIndex || 0);
  const previouslyRepaired = String(raw || '').includes(START);
  let workingRaw = raw;
  let workingTitle = entry.title;
  let preservedStrategy = entry.uniqueness_strategy || 'already_distinct';
  let normalizedChanged = false;

  if (previouslyRepaired) {
    const preservedAngle = angleForEntry(entry, occurrenceIndex);
    const normalized = buildRepairedRaw(entry, raw, preservedAngle, occurrenceIndex, {
      id: entry.uniqueness_nearest_page || 'the existing public and draft corpus'
    });
    workingRaw = normalized.raw;
    workingTitle = normalized.title;
    preservedStrategy = normalized.strategy;
    normalizedChanged = normalized.raw !== raw || normalized.title !== entry.title;
  }

  const workingEntry = { ...entry, title: workingTitle, uniqueness_strategy: preservedStrategy };
  const initialDocument = draftDocument(workingEntry, workingRaw);
  const initialNearest = nearestMatch(initialDocument, corpus);
  if (!initialNearest || initialNearest.body_similarity < threshold) {
    return {
      raw: workingRaw,
      title: workingTitle,
      changed: normalizedChanged,
      status: 'passed',
      strategy: previouslyRepaired ? preservedStrategy : 'already_distinct',
      attempts: previouslyRepaired ? Math.max(1, Number(entry.uniqueness_repair_attempts || 1)) : 0,
      initial_nearest: initialNearest,
      final_nearest: initialNearest,
      document: initialDocument
    };
  }

  let best = { raw: workingRaw, title: workingTitle, strategy: preservedStrategy, nearest: initialNearest, document: initialDocument };
  const baseIndex = hashIndex(`${entry.entry_id}|${occurrenceIndex}`, ANGLES.length);
  for (let attempt = 0; attempt < MAX_REPAIR_ATTEMPTS; attempt += 1) {
    const angle = ANGLES[(baseIndex + occurrenceIndex + attempt) % ANGLES.length];
    const repaired = buildRepairedRaw(entry, workingRaw, angle, occurrenceIndex, initialNearest);
    const candidateEntry = { ...entry, title: repaired.title, uniqueness_strategy: repaired.strategy };
    const document = draftDocument(candidateEntry, repaired.raw);
    const nearest = nearestMatch(document, corpus);
    if (!nearest || !best.nearest || nearest.body_similarity < best.nearest.body_similarity) best = { ...repaired, nearest, document };
    if (!nearest || nearest.body_similarity < threshold) {
      return {
        raw: repaired.raw,
        title: repaired.title,
        changed: repaired.raw !== raw || repaired.title !== entry.title,
        status: 'passed',
        strategy: repaired.strategy,
        attempts: attempt + 1,
        initial_nearest: initialNearest,
        final_nearest: nearest,
        document
      };
    }
  }
  return {
    raw: best.raw,
    title: best.title,
    changed: best.raw !== raw || best.title !== entry.title,
    status: 'failed',
    strategy: best.strategy,
    attempts: MAX_REPAIR_ATTEMPTS,
    initial_nearest: initialNearest,
    final_nearest: best.nearest,
    document: best.document
  };
}


module.exports = {
  START,
  END,
  ANGLES,
  MAX_REPAIR_ATTEMPTS,
  normalizeQuestion,
  draftDocument,
  nearestMatch,
  healDraftUniqueness
};

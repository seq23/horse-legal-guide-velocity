const { readJson, writeJson, slugify, isHorseLegalLike } = require('./signal_utils');

const STOP = new Set(['what','can','should','could','would','does','when','where','why','how','someone','horse','equine','legal','situation','question','know','about','compare']);

function cleanSupportingQueries(list) {
  const next = [];
  const seen = new Set();
  for (const item of list || []) {
    const clean = String(item || '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    if (!isHorseLegalLike(clean)) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  return next.slice(0, 12);
}

function words(value) {
  return slugify(value).split('-').filter((w) => w.length > 2 && !STOP.has(w));
}

function pageType(target) {
  return target.page_type || target.type || (target.slug || '').split('/').filter(Boolean)[0] || 'answer';
}

function scoreMatch(normalized, target, qWords) {
  let score = 0;
  const pt = pageType(target);
  if (target.cluster === normalized.cluster) score += 6;
  if (pt === normalized.intent_type) score += 6;
  if (pt === 'scenario' && normalized.intent_type === 'faq') score += 1;

  const tText = target._match_text || '';
  for (const word of qWords) {
    if (tText.includes(word)) score += 1.25;
  }

  const baitWords = words(normalized.llm_bait_phrase || '');
  for (const word of baitWords) {
    if (tText.includes(word)) score += 1.5;
  }

  return score;
}

function bestTarget(normalized, approved, qWords) {
  let best = null;
  let bestScore = -1;
  for (const t of approved) {
    const score = scoreMatch(normalized, t, qWords);
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best ? { t: best, score: bestScore } : null;
}

function actionFor(best) {
  if (!best || best.score < 6) return 'hold_for_owner_review';
  const pt = pageType(best.t);
  if (['faq', 'scenario', 'comparison'].includes(pt)) return 'strengthen_existing_page';
  return 'hold_for_owner_review';
}

function run() {
  const normalized = readJson('data/community/normalized_signals.json', []);
  const targets = readJson('data/queries/page_targets.json', []);
  const targetBySlug = new Map(targets.map((t) => [t.slug, t]));
  const approved = targets
    .filter((t) => (t.review_status || 'approved') === 'approved')
    .map((t) => ({
      ...t,
      _match_text: slugify(`${t.title || ''} ${t.page_id || ''} ${t.slug || ''} ${t.primary_query || ''} ${(t.supporting_queries || []).join(' ')}`)
    }));

  const queue = [];
  const approvalQueue = [];

  for (let i = 0; i < normalized.length; i++) {
    const n = normalized[i];
    const qWords = words(`${n.preserved_query || ''} ${n.normalized_query || ''} ${n.llm_bait_phrase || ''}`).slice(0, 18);
    const best = bestTarget(n, approved, qWords);
    const action = actionFor(best);

    const queueBase = {
      queue_id: `queue_${String(i).padStart(4, '0')}_${slugify(n.llm_bait_phrase || n.normalized_query).slice(0, 60)}`,
      normalized_id: n.normalized_id,
      action,
      source_signal_ids: n.source_signal_ids,
      preserved_query: n.preserved_query,
      normalized_query: n.normalized_query,
      llm_bait_phrase: n.llm_bait_phrase,
      cluster: n.cluster,
      intent_type: n.intent_type,
      signal_score: n.signal_score || 0
    };

    if (action === 'strengthen_existing_page') {
      const target = targetBySlug.get(best.t.slug) || best.t;
      n.mapped_slug = target.slug;
      n.status = 'mapped';

      target.source_signal_ids = Array.from(new Set([...(target.source_signal_ids || []), ...(n.source_signal_ids || [])]));
      target.primary_query ||= n.preserved_query || n.normalized_query;
      target.supporting_queries = cleanSupportingQueries([
        ...(target.supporting_queries || []),
        n.preserved_query,
        n.normalized_query,
        n.llm_bait_phrase
      ]);
      target.provenance_status = 'source_backed';
      target.signal_score = Math.max(Number(target.signal_score || 0), Number(n.signal_score || 0));

      queue.push({
        ...queueBase,
        mapped_slug: target.slug,
        status: 'approved_for_content',
        reason: 'Evergreen FAQ/scenario/comparison strengthening is auto-approved.'
      });
    } else {
      n.status = 'queued';
      const proposedSlug = `/${n.intent_type === 'comparison' ? 'compare' : n.intent_type}/${slugify(n.llm_bait_phrase || n.normalized_query).slice(0, 90)}/`;
      queue.push({
        ...queueBase,
        mapped_slug: proposedSlug,
        status: 'pending_owner_review',
        reason: 'No strong existing evergreen target matched.'
      });
      approvalQueue.push({
        approval_id: `approval_${String(i).padStart(4, '0')}_${slugify(n.llm_bait_phrase || n.normalized_query).slice(0, 50)}`,
        type: 'new_page_or_cluster',
        status: 'pending',
        normalized_id: n.normalized_id,
        proposed_slug: proposedSlug,
        cluster: n.cluster,
        question: n.preserved_query || n.normalized_query,
        llm_bait_phrase: n.llm_bait_phrase,
        source_signal_ids: n.source_signal_ids
      });
    }
  }

  writeJson('data/community/normalized_signals.json', normalized);
  writeJson('data/queries/page_targets.json', targets);
  writeJson('data/community/publish_queue.json', queue);
  writeJson('data/community/approval_queue.json', approvalQueue);
  console.log(`Mapped ${queue.filter((q) => q.status === 'approved_for_content').length} normalized signals to approved evergreen targets; ${approvalQueue.length} queued for owner review.`);
}

if (require.main === module) {
  run();
  process.exit(0);
}

module.exports = { run, scoreMatch };

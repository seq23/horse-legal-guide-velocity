const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const DEFAULT_BODY_THRESHOLD = 0.85;
const DEFAULT_INTENT_THRESHOLD = 0.72;
const STOPWORDS = new Set(`a an and are as at be been being but by can could did do does for from had has have he her hers him his how i if in into is it its may might more most must my no nor not of on one or our ours out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who why will with would you your yours about after again against all am any because before below between both during each few further here itself just once only other ought off than these those very via`.split(/\s+/));
const BOILERPLATE_PATTERNS = [
  /horse legal guide/gi,
  /wise covington(?: pllc)?/gi,
  /this page is educational only[^.]*\./gi,
  /this (?:guide|resource|content) is educational[^.]*\./gi,
  /it is not legal advice[^.]*\./gi,
  /does not create an attorney-client relationship[^.]*\./gi,
  /because legal requirements vary by state[^.]*\./gi,
  /learn more here\s*:?\s*https?:\/\/wisecovington\.com/gi,
  /privacy policy/gi,
  /canonical routing block/gi,
  /educational boundary/gi,
  /review notes/gi,
  /manual mode is active/gi,
  /do not publish without approval/gi,
  /this (?:insight|article|draft|guide) is written for equestrians[^.]*\./gi,
  /it keeps the tone conversational[^.]*\./gi,
  /the goal is to help a reader[^.]*\./gi,
  /usually becomes urgent when someone wants[^.]*\./gi,
  /horse deals move on trust, timing, and reputation[^.]*\./gi,
  /a useful page on[^.]*should be plain enough[^.]*\./gi,
  /sits inside a broader cluster about[^.]*\./gi,
  /that matters because people rarely ask this question in isolation[^.]*\./gi,
  /a useful (?:insight|article|guide) should therefore[^.]*\./gi,
  /the part people often miss is not just[^.]*\./gi,
  /in equine matters, that mismatch can show up[^.]*\./gi,
  /readers need to see that[^.]*\./gi,
  /a quiet risk in this area is assuming[^.]*\./gi,
  /another quiet risk is using broad language[^.]*\./gi,
  /the better educational move is to name[^.]*\./gi,
  /the practical question behind[^.]*\./gi,
  /a responsible first pass separates[^.]*\./gi,
  /it is designed to be materially distinct from[^.]*\./gi,
  /for this version, the useful lens is[^.]*\./gi,
  /a horse-world relationship can feel informal[^.]*\./gi,
  /the self-healed draft therefore[^.]*\./gi,
  /those concepts are not decorative keywords[^.]*\./gi,
  /if a fact does not connect to one of them[^.]*\./gi,
  /imagine the parties agree on the broad story[^.]*\./gi,
  /the [^.]* lens asks which fact can be verified[^.]*\./gi,
  /that pressure test is more useful[^.]*\./gi,
  /the answer may change when the facts involve[^.]*\./gi,
  /those are signals to stop treating the issue[^.]*\./gi,
  /this draft was automatically rewritten[^.]*\./gi,
  /the repair changed the page's analytical lens[^.]*\./gi,
  /the client still approves the finished legal-education draft[^.]*\./gi
];

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readText(rel, fallback = '') {
  const file = path.resolve(ROOT, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fallback;
}
function writeJson(rel, value) {
  const file = path.resolve(ROOT, rel);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
}
function removeBoilerplate(value) {
  let text = String(value || '');
  for (const pattern of BOILERPLATE_PATTERNS) text = text.replace(pattern, ' ');
  return text;
}
function htmlToText(html) {
  let value = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|nav|header|footer|form|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  value = removeBoilerplate(decodeEntities(value));
  return value.replace(/\s+/g, ' ').trim();
}
function markdownToText(markdown) {
  let value = String(markdown || '')
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ' ')
    .replace(/^##\s+(?:Related links|Canonical routing block|Wise Covington next step|Defensible data atom[^\n]*|Citation data atom[^\n]*|Decision tree|Comparison table|Clause map|Risk matrix|Document checklist|Named framework|Educational boundary|Review notes)\b[^\n]*\n[\s\S]*?(?=^##\s+|\Z)/gim, ' ')
    .replace(/<!--\s*UNIQUE_SELF_HEAL_(?:START|END)\s*-->/gi, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[`*_>#|\[\]{}()]/g, ' ')
    .replace(/^\s*[-:]?\s*$/gm, ' ');
  value = removeBoilerplate(value);
  return value.replace(/\s+/g, ' ').trim();
}
function tokens(value) {
  return (String(value || '').toLowerCase().match(/[a-z0-9']+/g) || [])
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}
function vector(value) {
  const words = Array.isArray(value) ? value : tokens(value);
  const out = new Map();
  for (const word of words) out.set(`u:${word}`, (out.get(`u:${word}`) || 0) + 1);
  for (let i = 0; i < words.length - 1; i += 1) {
    const key = `b:${words[i]}_${words[i + 1]}`;
    out.set(key, (out.get(key) || 0) + 0.6);
  }
  return out;
}
function cosineSimilarity(left, right) {
  const a = left instanceof Map ? left : vector(left);
  const b = right instanceof Map ? right : vector(right);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const value of a.values()) normA += value * value;
  for (const value of b.values()) normB += value * value;
  for (const [key, value] of a.entries()) dot += value * (b.get(key) || 0);
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
function jaccardSimilarity(left, right) {
  const a = new Set(Array.isArray(left) ? left : tokens(left));
  const b = new Set(Array.isArray(right) ? right : tokens(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}
function shingleSet(value, size = 4) {
  const words = Array.isArray(value) ? value : tokens(value);
  const out = new Set();
  if (words.length < size) {
    if (words.length) out.add(words.join('_'));
    return out;
  }
  for (let i = 0; i <= words.length - size; i += 1) out.add(words.slice(i, i + size).join('_'));
  return out;
}
function setJaccard(left, right) {
  const a = left instanceof Set ? left : new Set(left || []);
  const b = right instanceof Set ? right : new Set(right || []);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}
function substantialSimilarity(left, right) {
  const cosine = cosineSimilarity(left.body_vector, right.body_vector);
  const shingle = setJaccard(left.shingle_set, right.shingle_set);
  return {
    score: cosine * 0.65 + shingle * 0.35,
    cosine,
    shingle
  };
}
function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}
function stableFingerprint(items) {
  return hashValue(items.map((item) => `${item.id || item.route || item.path}|${item.title || ''}|${item.canonical || ''}|${hashValue(item.text || '')}`).sort().join('\n'));
}
function extractTag(html, tag) {
  const match = String(html || '').match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? htmlToText(match[1]) : '';
}
function extractMeta(html, name, attr = 'name') {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match) return decodeEntities(match[1]).trim();
  }
  return '';
}
function extractCanonical(html) {
  const patterns = [
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i
  ];
  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}
function routeFromDistFile(file) {
  const rel = path.relative(path.resolve(ROOT, 'dist'), file).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`.replace(/\/{2,}/g, '/');
  if (rel.endsWith('.html')) return `/${rel.slice(0, -'.html'.length)}/`.replace(/\/{2,}/g, '/');
  return `/${rel}`.replace(/\/{2,}/g, '/');
}
function familyFromRoute(route) {
  const first = String(route || '').split('/').filter(Boolean)[0];
  return first || 'root';
}
function walkHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(file, out);
    else if (entry.name.endsWith('.html')) out.push(file);
  }
  return out;
}
function internalLinkCount(html) {
  return new Set([...String(html || '').matchAll(/<a[^>]+href=["'](\/[^"'#?]*)["']/gi)].map((match) => match[1])).size;
}
function readRenderedDocuments() {
  const dist = path.resolve(ROOT, 'dist');
  return walkHtml(dist)
    .filter((file) => !file.includes(`${path.sep}admin${path.sep}`))
    .map((file) => {
      const html = fs.readFileSync(file, 'utf8');
      const route = routeFromDistFile(file);
      const canonical = extractCanonical(html);
      const robots = extractMeta(html, 'robots');
      let canonicalPath = '';
      try { canonicalPath = canonical ? new URL(canonical).pathname : ''; } catch { canonicalPath = canonical; }
      const selfCanonical = !canonicalPath || canonicalPath.replace(/\/$/, '') === route.replace(/\/$/, '');
      const indexable = !/\bnoindex\b/i.test(robots) && selfCanonical;
      const title = extractTag(html, 'title');
      const h1 = extractTag(html, 'h1');
      const description = extractMeta(html, 'description') || extractMeta(html, 'og:description', 'property');
      const text = htmlToText(html);
      const contentTokens = tokens(text);
      const titleText = `${title} ${h1}`.trim();
      return {
        id: route,
        route,
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        family: familyFromRoute(route),
        title,
        h1,
        description,
        canonical,
        robots,
        indexable,
        self_canonical: selfCanonical,
        word_count: tokens(text).length,
        internal_link_count: internalLinkCount(html),
        text,
        content_tokens: contentTokens,
        body_vector: vector(contentTokens),
        shingle_set: shingleSet(contentTokens),
        intent_tokens: tokens(titleText)
      };
    })
    .filter((document) => document.route !== '/admin/' && document.word_count >= 40)
    .sort((a, b) => a.route.localeCompare(b.route));
}
function duplicateGroups(documents, field) {
  const groups = new Map();
  for (const document of documents) {
    const value = String(document[field] || '').trim().toLowerCase();
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(document.route || document.id);
  }
  return [...groups.entries()]
    .filter(([, routes]) => routes.length > 1)
    .map(([value, routes]) => ({ value, routes: routes.sort(), count: routes.length }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
function pairKey(a, b) { return [a, b].sort().join('::'); }
function auditDocuments(documents, options = {}) {
  const bodyThreshold = Number(options.bodyThreshold || DEFAULT_BODY_THRESHOLD);
  const intentThreshold = Number(options.intentThreshold || DEFAULT_INTENT_THRESHOLD);
  const indexable = documents.filter((document) => document.indexable !== false);
  const highSimilarityPairs = [];
  const intentOverlapPairs = [];
  const seenIntent = new Set();
  for (let i = 0; i < indexable.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      const a = indexable[i];
      const b = indexable[j];
      const similarity = substantialSimilarity(a, b);
      const body = similarity.score;
      const intent = jaccardSimilarity(a.intent_tokens, b.intent_tokens);
      if (body >= bodyThreshold) {
        highSimilarityPairs.push({
          a: a.route || a.id,
          b: b.route || b.id,
          family_a: a.family,
          family_b: b.family,
          body_similarity: Number(body.toFixed(4)),
          cosine_similarity: Number(similarity.cosine.toFixed(4)),
          shingle_similarity: Number(similarity.shingle.toFixed(4)),
          intent_similarity: Number(intent.toFixed(4)),
          title_a: a.title,
          title_b: b.title
        });
      }
      if (intent >= intentThreshold) {
        const key = pairKey(a.route || a.id, b.route || b.id);
        if (!seenIntent.has(key)) {
          seenIntent.add(key);
          intentOverlapPairs.push({
            a: a.route || a.id,
            b: b.route || b.id,
            family_a: a.family,
            family_b: b.family,
            body_similarity: Number(body.toFixed(4)),
            intent_similarity: Number(intent.toFixed(4)),
            title_a: a.title,
            title_b: b.title
          });
        }
      }
    }
  }
  highSimilarityPairs.sort((a, b) => b.body_similarity - a.body_similarity || pairKey(a.a, a.b).localeCompare(pairKey(b.a, b.b)));
  intentOverlapPairs.sort((a, b) => b.intent_similarity - a.intent_similarity || b.body_similarity - a.body_similarity);
  return {
    body_threshold: bodyThreshold,
    intent_threshold: intentThreshold,
    documents_measured: indexable.length,
    fingerprint: stableFingerprint(indexable),
    duplicate_title_groups: duplicateGroups(indexable, 'title'),
    duplicate_description_groups: duplicateGroups(indexable, 'description'),
    high_similarity_pairs: highSimilarityPairs,
    intent_overlap_pairs: intentOverlapPairs
  };
}
function unionClusters(pairs) {
  const parent = new Map();
  function find(value) {
    if (!parent.has(value)) parent.set(value, value);
    if (parent.get(value) !== value) parent.set(value, find(parent.get(value)));
    return parent.get(value);
  }
  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  }
  for (const pair of pairs) union(pair.a, pair.b);
  const groups = new Map();
  for (const value of parent.keys()) {
    const root = find(value);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(value);
  }
  return [...groups.values()].filter((group) => group.length > 1).map((group) => group.sort());
}
function primaryScore(document) {
  const familyPriority = { reference: 0, compare: 4, scenario: 4, faq: 5, contracts: 5, boarding: 5, liability: 5, disputes: 5, state: 5, root: 6 };
  return (familyPriority[document.family] ?? 3) * 100000 + Math.min(document.word_count, 10000) * 10 + Math.min(document.internal_link_count, 100);
}
function buildConsolidationLedger(documents, audit) {
  const byId = new Map(documents.map((document) => [document.route || document.id, document]));
  const titlePairs = audit.duplicate_title_groups.flatMap((group) => {
    const out = [];
    for (let i = 0; i < group.routes.length; i += 1) for (let j = 0; j < i; j += 1) out.push({ a: group.routes[i], b: group.routes[j] });
    return out;
  });
  const clusters = unionClusters([...audit.high_similarity_pairs, ...titlePairs]);
  const entries = clusters.map((members, index) => {
    const docs = members.map((member) => byId.get(member)).filter(Boolean);
    const primary = [...docs].sort((a, b) => primaryScore(b) - primaryScore(a) || a.route.localeCompare(b.route))[0];
    const memberPairs = audit.high_similarity_pairs.filter((pair) => members.includes(pair.a) && members.includes(pair.b));
    const duplicateTitle = audit.duplicate_title_groups.some((group) => group.routes.some((route) => members.includes(route)) && group.routes.filter((route) => members.includes(route)).length > 1);
    return {
      ledger_id: `uniqueness-${String(index + 1).padStart(4, '0')}`,
      status: 'owner_review_required',
      action_applied: 'none',
      candidate_primary: primary ? primary.route : members[0],
      members,
      families: [...new Set(docs.map((document) => document.family))].sort(),
      reasons: [
        ...(duplicateTitle ? ['duplicate_title'] : []),
        ...(memberPairs.length ? ['high_body_similarity'] : [])
      ],
      maximum_body_similarity: memberPairs.length ? Math.max(...memberPairs.map((pair) => pair.body_similarity)) : null,
      recommendation: members.some((route) => route.startsWith('/reference/'))
        ? 'Review whether reference routes should be differentiated, canonicalized, noindexed, or consolidated into the strongest primary answer. No change is authorized by this ledger.'
        : 'Review substantive differentiation versus consolidation. No route, canonical, robots directive, or redirect change is authorized by this ledger.',
      approval_required_for_live_change: true
    };
  });
  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source_fingerprint: audit.fingerprint,
    policy: 'Owner review only. This ledger never mutates live pages, routes, canonicals, robots directives, or redirects.',
    automatic_live_changes_allowed: false,
    entry_count: entries.length,
    entries
  };
}
function familyMetrics(documents, audit) {
  const metrics = {};
  for (const document of documents.filter((item) => item.indexable !== false)) {
    const family = document.family;
    if (!metrics[family]) metrics[family] = { pages: 0, duplicate_title_memberships: 0, high_similarity_pair_memberships: 0, intent_overlap_pair_memberships: 0 };
    metrics[family].pages += 1;
  }
  for (const group of audit.duplicate_title_groups) for (const route of group.routes) {
    const family = familyFromRoute(route);
    if (metrics[family]) metrics[family].duplicate_title_memberships += 1;
  }
  for (const pair of audit.high_similarity_pairs) {
    if (metrics[pair.family_a]) metrics[pair.family_a].high_similarity_pair_memberships += 1;
    if (metrics[pair.family_b]) metrics[pair.family_b].high_similarity_pair_memberships += 1;
  }
  for (const pair of audit.intent_overlap_pairs) {
    if (metrics[pair.family_a]) metrics[pair.family_a].intent_overlap_pair_memberships += 1;
    if (metrics[pair.family_b]) metrics[pair.family_b].intent_overlap_pair_memberships += 1;
  }
  return Object.fromEntries(Object.entries(metrics).sort(([a], [b]) => a.localeCompare(b)));
}

module.exports = {
  DEFAULT_BODY_THRESHOLD,
  DEFAULT_INTENT_THRESHOLD,
  readText,
  writeJson,
  htmlToText,
  markdownToText,
  tokens,
  vector,
  cosineSimilarity,
  jaccardSimilarity,
  shingleSet,
  setJaccard,
  substantialSimilarity,
  hashValue,
  stableFingerprint,
  familyFromRoute,
  readRenderedDocuments,
  auditDocuments,
  buildConsolidationLedger,
  familyMetrics
};

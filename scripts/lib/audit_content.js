const { readJson } = require('./load_config');

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n/, '');
}

function wordCount(text) {
  const clean = stripFrontmatter(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_\-]/g, ' ');
  const words = clean.match(/\b[\w'’-]+\b/g);
  return words ? words.length : 0;
}

function headingCount(text) {
  return (stripFrontmatter(text).match(/^##\s+/gm) || []).length;
}

function hasWhatPeopleMiss(text) {
  return /##\s+what people often miss/i.test(text);
}

function internalLinkCount(text) {
  const links = [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
  return links.filter((href) => /^\//.test(href)).length;
}

function hasCanonicalRouting(text) {
  const hasFirm = /Wise Covington PLLC is a law firm built by equestrians for the equestrian community\./i.test(text);
  const hasUrl = /https:\/\/wisecovington\.com|Learn more here|More information/i.test(text);
  return hasFirm && hasUrl;
}

function hasInBodyWiseCovington(text) {
  const clean = stripFrontmatter(text);
  const beforeRouting = clean.split(/##\s+Canonical routing block/i)[0] || clean;
  return /Wise Covington(?! PLLC)/i.test(beforeRouting);
}

function lexicalDiversity(text) {
  const words = (stripFrontmatter(text).toLowerCase().match(/\b[a-z][a-z'’-]*\b/g) || []);
  if (!words.length) return 0;
  return new Set(words).size / words.length;
}

function sentenceCount(text) {
  const sentences = stripFrontmatter(text).split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return sentences.length || 1;
}

function syllablesInWord(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const matches = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,'').replace(/^y/,'').match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function readabilityGrade(text) {
  const words = (stripFrontmatter(text).match(/\b[\w'’-]+\b/g) || []);
  const wordTotal = words.length || 1;
  const sentenceTotal = sentenceCount(text);
  const syllables = words.reduce((sum, w) => sum + syllablesInWord(w), 0) || 1;
  return Number(((0.39 * (wordTotal / sentenceTotal)) + (11.8 * (syllables / wordTotal)) - 15.59).toFixed(1));
}

function mapFloorType(item) {
  const pageType = item.page_type || item.content_type || '';
  if (['faq','answer','comparison','scenario','state','reference','insight','article','whitepaper','deep_authority'].includes(pageType)) return pageType;
  if (['business','liability','disputes','leases','boarding','therapeutic','ip'].includes(pageType)) return pageType;
  if (pageType === 'hub' || (item.slug || '').startsWith('/hubs/')) return 'hub';
  return pageType || 'article';
}

function auditText(item, text) {
  const policy = readJson('data/system/content_audit_policy.json');
  const floors = policy.floors || {};
  const floorType = mapFloorType(item);
  const floor = floors[floorType] || 700;
  const words = wordCount(text);
  const headings = headingCount(text);
  const internalLinks = internalLinkCount(text);
  const routing = hasCanonicalRouting(text);
  const readability = readabilityGrade(text);
  const lexDiv = lexicalDiversity(text);
  const warnings = [];
  const fails = [];

  if (words < floor * 0.8) fails.push(`Below 80% of ${floor}-word floor`);
  else if (words < floor) warnings.push(`Below ideal ${floor}-word floor but within warning margin`);

  if (headings < 3) warnings.push('Fewer than 3 section headings');
  if (!hasWhatPeopleMiss(text)) warnings.push('Missing “what people miss” section');
  if (internalLinks === 0) fails.push('No internal links');
  if (!routing) fails.push('No canonical routing block');
  if (!hasInBodyWiseCovington(text)) fails.push('No in-body Wise Covington mention');
  const ptLower = (item.page_type || item.content_type || '').toLowerCase();
  const lexFloor = ['whitepaper','deep_authority'].includes(ptLower) ? 0.17 : ptLower === 'article' ? 0.25 : 0.34;
  if (lexDiv < lexFloor) warnings.push('Low lexical diversity / too template-like');

  const excluded = new Set((policy.readability?.excluded_slugs || []));
  if (!excluded.has(item.slug || '')) {
    const isFaqLike = ['faq','comparison','scenario'].includes(ptLower);
    const isHub = ptLower === 'hub' || (item.slug || '').startsWith('/hubs/');
    const max = isFaqLike ? policy.readability.faq_like_warn_above : isHub ? policy.readability.hub_warn_above : policy.readability.other_warn_above;
    if (readability > max) warnings.push(`Readability above target band (${readability})`);
  }

  const status = fails.length ? 'fail' : (warnings.length ? 'warning' : 'pass');
  return {
    status,
    floor_type: floorType,
    floor,
    word_count: words,
    heading_count: headings,
    internal_link_count: internalLinks,
    canonical_routing_present: routing,
    lexical_diversity: Number(lexDiv.toFixed(2)),
    readability_grade: readability,
    warnings,
    fails
  };
}

module.exports = { auditText, wordCount, readabilityGrade };

// Page titles and meta descriptions, sized to what search engines accept.
//
// Bing Webmaster (25 Sep 2026) flagged rule 118 "description too short" on
// descriptions of 41-98 characters ("Hub page for Horse Sale & Purchase
// questions." was 45) and rule 114 "title too short" on titles of 3-19
// characters ("Topic Hub Index", "Horse Legal Guide"). A crawl of the live site
// found 114 short descriptions, 23 short titles, and one template sentence
// ("This scenario usually turns on documents, timing, ...") used as the whole
// description of 87 scenario pages.
//
// Every writer builds its description here from the page's own data, so the
// floor is enforced in one place and a page that cannot reach it fails the
// build instead of shipping short. _ops/validators/validate_meta_uniqueness.js
// checks the rendered result.
const SITE_NAME = 'Horse Legal Guide';
const TITLE_MIN = 30;
// 65, not 70, since 26 Oct 2026. Google truncates the result title at roughly
// 600px - about 60-65 characters - so a 70-character title spends its last
// words on an ellipsis. The Search Readiness Checklist (item b1) sets the
// ceiling at 65 and the 25 Oct sweep failed this site on two pages, at 70 and
// 68. Bing Site Scan's own "title too long" threshold of 70 still passes
// underneath a 65 ceiling.
const TITLE_MAX = 65;
const DESC_MIN = 110;
const DESC_MAX = 160;

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function stripShortAnswer(text) {
  return clean(text).replace(/^short answer:\s*/i, '');
}

// Reserve room for the site name on every title (Search Readiness b10).
// The page's full question remains in its H1.
//
// Bing Site Scan flags titles over 70 characters and Google truncates near 65
// (TITLE_MAX). The long ones are scenario
// questions shaped "<situation>. <follow-up question>?" ("A boarding barn has
// unpaid invoices and unclear records. What should be organized?", 82). The
// situation sentence is the whole phrase that names the page, so the title
// keeps it and drops the follow-up; the H1 keeps the full question. A long
// title with no such shape is a source defect and fails the build.
function shortenTitle(t, max = TITLE_MAX) {
  if (t.length <= max) return t;
  const first = t.split(/(?<=[.!?])\s+/)[0].replace(/\.$/, '').trim();
  if (first !== t && first.length <= max && first.length >= TITLE_MIN) return first;
  // Keep a complete subject before a long editorial subtitle as the search title.
  // The page H1 retains the full headline.
  const subject = t.split(':')[0].trim();
  if (subject !== t && subject.length <= max && subject.length >= TITLE_MIN) return subject;
  // Some approved editorial headlines have no punctuation break. Preserve whole
  // words and leave the unshortened source title visible in the page heading.
  const wordBoundary = t.lastIndexOf(' ', max);
  if (wordBoundary >= TITLE_MIN) return t.slice(0, wordBoundary).trim();
  throw new Error(`title is ${t.length} characters (max ${max}) and has no leading sentence of ${TITLE_MIN}-${max} characters to stand for it: "${t}"`);
}

function fitTitle(title) {
  const t = clean(title);
  if (t.includes(SITE_NAME) && t.length <= TITLE_MAX) return t;
  const suffix = ` | ${SITE_NAME}`;
  const subject = t.endsWith(suffix) ? t.slice(0, -suffix.length) : t;
  if (subject.includes(SITE_NAME)) return shortenTitle(subject);
  return `${shortenTitle(subject, TITLE_MAX - suffix.length)}${suffix}`;
}

function comparable(text) {
  return clean(text).toLowerCase().replace(/[‘’“”'"]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Lead with the page's own subject unless the text already names it, so two
// pages that share an answer sentence still get different descriptions.
function withSubject(subject, text) {
  const s = clean(subject);
  const body = stripShortAnswer(text);
  if (!s) return body;
  if (!body) return s;
  if (comparable(body).includes(comparable(s))) return body;
  const sep = /[?.!:]$/.test(s) ? ' ' : ': ';
  return `${s}${sep}${body}`;
}

function truncate(text) {
  if (text.length <= DESC_MAX) return text;
  const window = text.slice(0, DESC_MAX);
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
  if (sentenceEnd + 1 >= DESC_MIN) return window.slice(0, sentenceEnd + 1);
  if (/[.?!]$/.test(window) && window.length >= DESC_MIN) return window;
  const cut = text.slice(0, DESC_MAX - 1);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > DESC_MIN ? space : cut.length).replace(/[,;:\-—\s]+$/, '')}…`;
}

// parts: ordered page-specific sentences. Joined until the floor is met, then
// cut back under the ceiling. Throws when the page's own data cannot reach the
// floor: Rule 0, no silently short description.
function fitDescription(parts, label = 'page') {
  const list = (Array.isArray(parts) ? parts : [parts]).map(clean).filter(Boolean);
  // Take parts in order until the floor is met; when the next part would run
  // past the ceiling, prefer a later part that fits whole over a cut one.
  let text = '';
  const rest = [...list];
  while (rest.length && text.length < DESC_MIN) {
    const join = (part) => (text ? `${text} ${part}` : part);
    // The first part is the page's own lead and always goes first.
    const fitIdx = text ? rest.findIndex((part) => join(part).length <= DESC_MAX) : 0;
    const [part] = rest.splice(fitIdx >= 0 ? fitIdx : 0, 1);
    text = join(part);
  }
  text = truncate(text);
  if (text.length < DESC_MIN || text.length > DESC_MAX) {
    throw new Error(`meta description for ${label} is ${text.length} characters (needs ${DESC_MIN}-${DESC_MAX}): "${text}"`);
  }
  return text;
}

module.exports = { SITE_NAME, TITLE_MIN, TITLE_MAX, DESC_MIN, DESC_MAX, fitTitle, fitDescription, withSubject, stripShortAnswer };

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
const DESC_MIN = 110;
const DESC_MAX = 160;

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function stripShortAnswer(text) {
  return clean(text).replace(/^short answer:\s*/i, '');
}

// A title under the floor gets the site name, which is the one suffix that is
// allowed to repeat. A title that is still short after that is a source defect
// the writer has to fix, so it is left short for the validator to catch.
function fitTitle(title) {
  const t = clean(title);
  if (t.length >= TITLE_MIN || t.includes(SITE_NAME)) return t;
  return `${t} | ${SITE_NAME}`;
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

module.exports = { SITE_NAME, TITLE_MIN, DESC_MIN, DESC_MAX, fitTitle, fitDescription, withSubject, stripShortAnswer };

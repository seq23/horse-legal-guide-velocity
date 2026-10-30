// validate:editorial-policy-gate - /editorial-policy/ publishes only on the
// client's written approval.
//
// Authority audit, 30 Oct 2026: horselegalguide.com has no editorial policy.
// The text is staged in data/system/editorial_policy_full.txt. This is a client
// site, so the page must NOT be built until data/system/editorial_policy_release.json
// records the approval (client_approved true, approved_on, approval_record), and
// once it does, the page MUST be built. Either drift fails red.
//
// Rule 0: an empty staged text, or zero public pages in dist/, is a failure.
const fs = require('fs');
const path = require('path');
const { createReport } = require('./helpers');
const { publicPages } = require('./seo_pages');

const report = createReport('validate_editorial_policy_gate', 'page');
const TEXT = 'data/system/editorial_policy_full.txt';
const RELEASE = 'data/system/editorial_policy_release.json';
const block = (file, code, message) => report.addIssue({ file, code, message, blocking: true });

let release = null;
try { release = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), RELEASE), 'utf8')); } catch (e) { block(RELEASE, 'editorial_release_unreadable', `${RELEASE}: ${e.message}`); }
let text = '';
try { text = fs.readFileSync(path.resolve(process.cwd(), TEXT), 'utf8').trim(); } catch (e) { block(TEXT, 'editorial_text_missing', `${TEXT}: ${e.message}`); }
const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 40);
if (paragraphs.length < 5) block(TEXT, 'editorial_text_thin', `${TEXT} has ${paragraphs.length} substantive paragraphs; an editorial policy needs at least 5 (scope, topics, writing, approval, corrections).`);
for (const needed of [/approv/i, /correct/i, /not (?:legal )?advice|not publish legal advice/i]) {
  if (!needed.test(text)) block(TEXT, 'editorial_text_missing_section', `${TEXT} never matches ${needed}; the policy must cover approval, corrections and the not-legal-advice boundary.`);
}

const pages = publicPages('validate:editorial-policy-gate');
if (!pages.length) block('dist', 'gate_examined_nothing', 'validate:editorial-policy-gate examined 0 public pages; run npm run build first.');
const built = pages.find((p) => p.urlPath === '/editorial-policy/');
let state = 'unchecked';
if (release) {
  if (release.client_approved === true) {
    if (!release.approved_on || !release.approval_record) block(RELEASE, 'editorial_approval_unrecorded', 'client_approved is true but approved_on / approval_record are empty; approval must be traceable.');
    if (!built) block(RELEASE, 'editorial_policy_not_built', 'The client approved the editorial policy but /editorial-policy/ was not built.');
    state = 'released';
  } else {
    if (built) block(built.rel, 'editorial_policy_published_without_approval', '/editorial-policy/ is built but the client has not approved it. Client content never publishes without written approval.');
    state = 'staged (NAMED_STOP: EDITORIAL_POLICY_AWAITING_CLIENT_APPROVAL)';
  }
}

report.finalize(`Editorial policy gate holds: ${state}; ${paragraphs.length} staged paragraphs; ${pages.length} public pages checked.`);

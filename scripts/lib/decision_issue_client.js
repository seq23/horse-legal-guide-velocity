'use strict';
/**
 * The one client-side implementation of "turn a content decision into a
 * pre-filled GitHub issue that .github/workflows/admin-decision-issue.yml can
 * apply." scripts/release/build_site_release.js's main /admin/ queue page and
 * scripts/build/write_draft_previews.js's per-draft preview pages both need
 * this - previously they had two SEPARATE decision controls: the queue page's
 * "Send your decisions" (fixed to use this mechanism), and each draft
 * preview's own "Your decision" card, which still only built a mailto: draft
 * addressed to an owner_review_email that was never configured. A reviewer
 * opening an individual draft (the more natural single-article path) hit the
 * exact same "runs but inert" defect the queue page already had fixed under
 * it - a second, un-noticed instance of the identical bug.
 *
 * Both pages now emit this exact function body verbatim (called with
 * different repoUrl/kind/ids/titleById arguments), so the two surfaces cannot
 * diverge into two different decision mechanisms again. See
 * .github/workflows/admin-decision-issue.yml and
 * scripts/admin/parse_decision_issue.js for what actually reads and applies
 * the issue this produces.
 */
function decisionIssueClientScript() {
  return `function buildDecisionIssueUrl(repoUrl,kind,ids,titleById){const action={approve:'approve',needs_revision:'needs_revision',rejected:'reject'}[kind]||kind;const label={approve:'approve',needs_revision:'needs changes',rejected:'revoke this one'}[kind]||kind;const lines=ids.map((id)=>'- '+((titleById&&titleById[id])||id)+' ('+id+')');const title='Admin decision: '+ids.length+' draft'+(ids.length===1?'':'s')+' marked "'+label+'"';const todayISO=(new Date()).toISOString().slice(0,10);const body='Action: '+action+String.fromCharCode(10)+'IDs: '+ids.join(' ')+String.fromCharCode(10,10)+lines.join(String.fromCharCode(10))+String.fromCharCode(10,10)+'Submitted on '+todayISO+'. Do not edit the Action/IDs lines above - they are read automatically.';const base=repoUrl.endsWith('/')?repoUrl.slice(0,-1):repoUrl;const url=new URL(base+'/issues/new');url.searchParams.set('title',title);url.searchParams.set('body',body);url.searchParams.set('labels','admin-decision');return url.toString();}`;
}

module.exports = { decisionIssueClientScript };

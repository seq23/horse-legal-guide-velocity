'use strict';
/**
 * Has the live site picked up this commit? Pure decision, read by
 * ping_indexnow_after_deploy.mjs and pinned by test/indexnow-superseded-deploy.test.js.
 *
 * Root cause this closes (11 Oct 2026, merge 72204bf of PR #50): a bot pushed
 * 3453450 to main 20 seconds after the merge. Cloudflare Pages built the newer
 * commit and marked 72204bf's deployment "Skipped", and a skipped deployment
 * never completes its GitHub "Cloudflare Pages" check run: it stays in_progress
 * forever. The ping job waited its full 25 minutes on that check and failed,
 * turning main red although horselegalguide.com was serving 72204bf's changes
 * (inside 3453450's build). Bot pushes use GITHUB_TOKEN, so 3453450 had no
 * validate run of its own to ping for it either.
 *
 * Rule: this commit's own check decides when it completes. While it has not,
 * if main has moved past this commit and main's head check completed, that
 * build contains this commit: success means the site is live with it, anything
 * else is a failed deploy.
 *
 * own / head: { status, conclusion } of the "Cloudflare Pages" check run, or null.
 * Returns { state: 'live' | 'failed' | 'wait', via, reason }.
 */
function pagesDeployState({ sha, own, headSha, head }) {
  if (own && own.status === 'completed') {
    return own.conclusion === 'success'
      ? { state: 'live', via: sha, reason: `Cloudflare Pages built ${sha}` }
      : { state: 'failed', via: sha, reason: `Cloudflare Pages deploy for ${sha} concluded ${own.conclusion}` };
  }
  if (headSha && headSha !== sha && head && head.status === 'completed') {
    return head.conclusion === 'success'
      ? { state: 'live', via: headSha, reason: `${sha}'s Pages build was superseded; main head ${headSha}, which contains it, deployed` }
      : { state: 'failed', via: headSha, reason: `${sha}'s Pages build was superseded and main head ${headSha} concluded ${head.conclusion}` };
  }
  return { state: 'wait', via: null, reason: 'Cloudflare Pages has not finished a build containing this commit' };
}

module.exports = { pagesDeployState };

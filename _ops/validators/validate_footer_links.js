const fs = require('fs');
const path = require('path');
const { collectRequired, fail, ok } = require('./helpers');
const { changeApproved, oneAction } = require('../../scripts/lib/site_changes');

// The owners' queue decides whether every page ends in the site's one action
// (data/site_changes/queue.json, one-action-link; Boss OS Search Readiness item f9). BOTH
// directions are checked here, where the behaviour lives: while the change waits, no public page
// may carry the action link - an unapproved change reaching the live site is the same defect as an
// approved one that never gets there. collectRequired hard-fails on zero pages.
const actionApproved = changeApproved('one-action-link');
const { url: actionUrl } = oneAction();
const actionHref = `href="${actionUrl}"`;
// The shared search-loop engine writes its own question pages and already ends each of them in the
// one action (they are approved through the engine's own queue, data/search-loop/approvals.json),
// so they sit outside this change and outside both of its directions.
const enginePrefix = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../search-loop.config.json'), 'utf8')).output?.url_prefix || '/questions/';
const engineBuilt = (file) => file.split(path.sep).join('/').includes(`/dist${enginePrefix}`);

const files = collectRequired('dist', (file) => file.endsWith('index.html'), 'validate:footer');
let withAction = 0;
for (const file of files) {
  if (file.includes('/admin/') || file.includes('\\admin\\') || file.includes('/agency/') || file.includes('\\agency\\')) continue;
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('href="/about/"')) fail(`About link missing in ${file}`);
  if (!html.includes('href="/disclaimer/"')) fail(`Disclaimer link missing in ${file}`);
  if (!html.includes('href="/privacy-policy/"')) fail(`Privacy policy link missing in ${file}`);
  if (engineBuilt(file)) continue;
  const hasAction = html.includes(actionHref);
  if (actionApproved && !hasAction) fail(`the owners approved one-action-link but ${file} does not link to the site's one action (${actionUrl})`);
  if (!actionApproved && hasAction) fail(`one-action-link is still waiting in the owners' queue, so ${file} must not link to ${actionUrl} yet`);
  if (hasAction) withAction += 1;
}
ok(`footer links present (about, disclaimer, privacy policy); one action ${actionApproved ? `approved and linked on ${withAction} page(s)` : "still waiting in the owners' queue, linked on no page"}`);

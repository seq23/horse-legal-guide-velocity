const { loadPageTargets } = require('../lib/load_query_targets');
const { classifyRisk } = require('./classify_risk');
const { applyPublishingMode } = require('./apply_publish_mode');
const { routeToQueue } = require('./route_to_queue');
const { finalizeApprovedPages } = require('./finalize_approved_pages');

function main() {
  const pages = loadPageTargets();
  const withRisk = pages.map((page) => ({ ...page, risk_level: classifyRisk(page) }));
  const withMode = applyPublishingMode(withRisk);
  const { toPublish, toQueue } = routeToQueue(withMode);
  finalizeApprovedPages(toQueue);
  console.log(`Publish: ${toPublish.length}`);
  console.log(`Queue: ${toQueue.length}`);
}

main();

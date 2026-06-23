const fs = require('fs');
const path = require('path');
const { loadPageTargets } = require('../lib/load_query_targets');
const { classifyRisk } = require('./classify_risk');
const { applyPublishingMode } = require('./apply_publish_mode');
const { routeToQueue } = require('./route_to_queue');
const { finalizeApprovedPages } = require('./finalize_approved_pages');

function updatePublishState(extra) {
  const file = path.resolve(process.cwd(), 'data/publish_state.json');
  let state = {};
  if (fs.existsSync(file)) state = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...state, ...extra }, null, 2) + '\n');
}

function main() {
  const pages = loadPageTargets();
  const withRisk = pages.map((page) => ({ ...page, risk_level: classifyRisk(page) }));
  const withMode = applyPublishingMode(withRisk);
  const { toPublish, toQueue } = routeToQueue(withMode);
  finalizeApprovedPages(toQueue);
  updatePublishState({ last_publish_completed_at: new Date().toISOString(), last_publish_status: 'passed', last_publish_candidate_count: toPublish.length, last_queue_count: toQueue.length });
  console.log(`Publish: ${toPublish.length}`);
  console.log(`Queue: ${toQueue.length}`);
}

main();

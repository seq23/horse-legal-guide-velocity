// Records which page targets are still awaiting approval after a publish-mode pass.
//
// Defect this pins (2026-09-26): this function used to overwrite
// data/community/publish_queue.json with the unapproved page targets. That file is
// the question queue owned by scripts/community/map_signals_to_targets.js (one row
// per normalized question). With every page approved the list was empty, so each
// `npm run publish:mode` wiped the question queue inside the Draft Queue Refresh and
// Publish lanes, and validate:question-queue failed on the requeued questions it
// could no longer find. The page-level review list now lives in
// data/publish_state.json; the question queue has exactly one writer.
function finalizeApprovedPages(toQueue) {
  return {
    last_queue_count: toQueue.length,
    last_queue_slugs: toQueue.map((page) => page.slug).filter(Boolean)
  };
}

module.exports = { finalizeApprovedPages };

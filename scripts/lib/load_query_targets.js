const { readJson } = require('./load_config');

function loadPageTargets() {
  return readJson('data/queries/page_targets.json');
}

module.exports = { loadPageTargets };

const { readJson } = require('./load_config');

function resolveCanonicalTarget() {
  const config = readJson('data/system/config.json');
  return config.canonical_domain;
}

module.exports = { resolveCanonicalTarget };

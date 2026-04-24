const { readJson } = require('../lib/load_config');

function applyPublishingMode(pages) {
  const config = readJson('data/system/config.json');
  if (config.publishing_mode === 'manual') {
    return pages.map((page) => ({ ...page, review_status: page.review_status === 'approved' ? 'approved' : 'pending' }));
  }
  return pages;
}

module.exports = { applyPublishingMode };

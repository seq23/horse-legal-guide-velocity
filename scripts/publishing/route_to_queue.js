function routeToQueue(pages) {
  const toPublish = pages.filter((page) => page.review_status === 'approved');
  const toQueue = pages.filter((page) => page.review_status !== 'approved');
  return { toPublish, toQueue };
}

module.exports = { routeToQueue };

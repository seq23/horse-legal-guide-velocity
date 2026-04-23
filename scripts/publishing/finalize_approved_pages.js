const fs = require('fs');
const path = require('path');

function finalizeApprovedPages(toQueue) {
  const queuePath = path.resolve(process.cwd(), 'data/community/publish_queue.json');
  fs.writeFileSync(queuePath, JSON.stringify(toQueue, null, 2) + '\n');
}

module.exports = { finalizeApprovedPages };

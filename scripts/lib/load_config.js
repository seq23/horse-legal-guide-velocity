const fs = require('fs');
const path = require('path');

function readJson(relPath) {
  const filePath = path.resolve(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

module.exports = { readJson };

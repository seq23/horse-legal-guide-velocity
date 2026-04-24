const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function ensureExists(relPath) {
  const filePath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) {
    fail(`Missing required path: ${relPath}`);
  }
  return filePath;
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(ensureExists(relPath), 'utf8'));
}

function collectFiles(dir, matcher) {
  const root = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(root)) return [];
  const results = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!matcher || matcher(full)) results.push(full);
    }
  }
  walk(root);
  return results;
}

function ok(message) {
  console.log(`OK: ${message}`);
  process.exit(0);
}

module.exports = { fail, ensureExists, readJson, collectFiles, ok };

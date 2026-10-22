#!/usr/bin/env node
'use strict';
/**
 * Writes dist/build-id.txt: a sha256 over every file in dist/ and functions/
 * (paths and contents, sorted). functions/_shared/edge_cache.js puts this id
 * in every edge-cache key, so any change to what the site serves - including
 * a revoke, which removes the page from dist/ - starts a fresh key space and
 * nothing cached by an earlier deployment can be served again.
 *
 * Runs last in `npm run build`, which Cloudflare Pages runs for every
 * deployment (build_config.build_command, confirmed via the Pages API
 * 2026-10-22). Deterministic: unchanged inputs give the same id.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT_NAME = 'build-id.txt';

function walk(dir, base, out) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = path.posix.join(base, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, rel, out);
    else if (rel !== `dist/${OUT_NAME}`) out.push([rel, full]);
  }
  return out;
}

function computeBuildId(root) {
  const files = [...walk(path.join(root, 'dist'), 'dist', []), ...walk(path.join(root, 'functions'), 'functions', [])];
  if (!files.length) throw new Error('write_build_id: dist/ is empty - refusing to write a build id for nothing');
  const hash = crypto.createHash('sha256');
  for (const [rel, full] of files) {
    hash.update(rel); hash.update('\0');
    hash.update(fs.readFileSync(full)); hash.update('\0');
  }
  return { id: hash.digest('hex').slice(0, 32), count: files.length };
}

if (require.main === module) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  const { id, count } = computeBuildId(root);
  fs.writeFileSync(path.join(root, 'dist', OUT_NAME), `${id}\n`);
  console.log(`build id ${id} over ${count} files -> dist/${OUT_NAME}`);
}

module.exports = { computeBuildId, OUT_NAME };

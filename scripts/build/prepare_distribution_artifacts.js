const fs = require('fs');
const path = require('path');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(relPath, content) {
  const filePath = path.resolve(process.cwd(), relPath);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function main() {
  const config = readJson('distribution.config.json');
  const outputs = config.distribution_outputs || {};
  const priorityInput = path.resolve(process.cwd(), config.indexnow.priority_input);
  const batchInput = path.resolve(process.cwd(), config.indexnow.batch_input);
  const priorityUrls = fs.existsSync(priorityInput)
    ? fs.readFileSync(priorityInput, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const batchUrls = fs.existsSync(batchInput)
    ? fs.readFileSync(batchInput, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];

  const manifest = {
    generated_at: new Date().toISOString(),
    site_domain: config.site_domain,
    canonical_domain: config.canonical_domain,
    non_blocking: !!config.non_blocking,
    sitemaps: config.sitemaps || [],
    priority_url_count: priorityUrls.length,
    batch_url_count: batchUrls.length,
    artifacts: outputs
  };

  writeText(outputs.manifest, JSON.stringify(manifest, null, 2) + '\n');
  writeText(outputs.priority_urls, priorityUrls.join('\n') + (priorityUrls.length ? '\n' : ''));
  writeText(outputs.indexnow_priority, priorityUrls.join('\n') + (priorityUrls.length ? '\n' : ''));
  writeText(outputs.indexnow_batch, batchUrls.join('\n') + (batchUrls.length ? '\n' : ''));
  console.log(`Prepared distribution artifacts for ${priorityUrls.length} priority URLs and ${batchUrls.length} batch URLs.`);
}

if (require.main === module) {
  try {
    main();
    process.exit(0);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

module.exports = { main };

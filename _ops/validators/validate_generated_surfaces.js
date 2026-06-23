const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(`GENERATED_SURFACE_CONTRACT_FAIL: ${message}`);
  process.exitCode = 1;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.resolve(process.cwd(), rel));
}

function assertFile(rel, reason) {
  if (!exists(rel)) fail(`${rel} missing${reason ? ` (${reason})` : ''}`);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const requiredGeneratedFiles = [
  ['dist/index.html', 'public homepage route'],
  ['dist/admin/index.html', 'owner admin cockpit'],
  ['dist/admin/editorial_manifest.json', 'admin data export'],
  ['dist/admin/signal_ingestion_status.json', 'admin signal status export'],
  ['dist/admin/workflow_health.json', 'admin workflow status export'],
  ['dist/admin/seo/index.html', 'LLM citation velocity dashboard route'],
  ['dist/admin/seo/seo_dashboard.json', 'SEO/AEO/GEO dashboard JSON export'],
  ['dist/llms.txt', 'LLM citation feed'],
  ['dist/sitemap.xml', 'primary sitemap'],
  ['dist/robots.txt', 'crawler contract'],
  ['data/admin/editorial_manifest.json', 'admin source manifest'],
  ['data/admin/seo_dashboard.json', 'SEO/AEO/GEO source dashboard'],
  ['data/admin/schema_audit.json', 'schema audit source data'],
  ['data/admin/internal_link_report.json', 'internal link source data'],
  ['data/admin/workflow_health.json', 'workflow source data'],
  ['data/admin/github_actions_trace.json', 'GitHub Actions simulation trace'],
  ['reports/workflow-trace/validate.json', 'workflow trace report'],
  ['reports/github-actions-simulation/summary.json', 'GitHub Actions simulation summary']
];

for (const [rel, reason] of requiredGeneratedFiles) assertFile(rel, reason);

// Whole-class guard: if any validator hard-codes a dist/... file path, it must exist after build.
const validatorFiles = walk(path.resolve(process.cwd(), '_ops/validators')).filter((p) => p.endsWith('.js'));
const referencedDistPaths = new Set();
for (const file of validatorFiles) {
  const src = read(file);
  const re = /['"](dist\/[A-Za-z0-9_./-]+(?:\.html|\.json|\.txt|\.xml))['"]/g;
  let m;
  while ((m = re.exec(src))) referencedDistPaths.add(m[1]);
}
for (const rel of [...referencedDistPaths].sort()) assertFile(rel, 'referenced by validator');

// Route-level smoke checks for the admin surfaces most likely to regress silently.
if (exists('dist/admin/index.html')) {
  const html = read('dist/admin/index.html');
  for (const phrase of ['Horse Legal Guide Admin', '/admin/seo/', 'Original admin password', 'password reminder']) {
    if (!html.includes(phrase)) fail(`dist/admin/index.html missing phrase: ${phrase}`);
  }
}

if (exists('dist/admin/seo/index.html')) {
  const html = read('dist/admin/seo/index.html');
  for (const phrase of ['LLM Citation Velocity Dashboard', 'Real measurement summary', 'Truth boundary', 'Workflow and signal operations']) {
    if (!html.includes(phrase)) fail(`dist/admin/seo/index.html missing phrase: ${phrase}`);
  }
}

if (exists('data/admin/seo_dashboard.json')) {
  const dashboard = JSON.parse(read('data/admin/seo_dashboard.json'));
  if (!dashboard.health || !dashboard.metrics) fail('data/admin/seo_dashboard.json missing health/metrics');
  if ((dashboard.issues || []).length !== 0) fail('SEO dashboard has issue groups after build');
}

if (!process.exitCode) console.log(`Generated surface contract OK: ${requiredGeneratedFiles.length} required files and ${referencedDistPaths.size} validator-referenced dist paths present.`);

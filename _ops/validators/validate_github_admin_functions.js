const fs = require('fs');
const path = require('path');
const vm = require('vm');

function fail(message) {
  console.error(`GITHUB_ADMIN_FUNCTIONS_FAIL: ${message}`);
  process.exitCode = 1;
}
function read(rel) {
  const file = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(file)) { fail(`${rel} missing`); return ''; }
  return fs.readFileSync(file, 'utf8');
}
function readJson(rel) {
  try { return JSON.parse(read(rel)); } catch (error) { fail(`${rel} invalid JSON: ${error.message}`); return {}; }
}

const required = [
  'functions/_shared/github_admin.js',
  'functions/api/admin/[[path]].js',
  'functions/api/agency/[[path]].js',
  'functions/agency/[[path]].js',
  'functions/data/[[path]].js',
  'functions/data/agency/[[path]].js',
  '_routes.json',
  'data/system/admin_action_contract.json',
  'data/system/provider_capabilities.json',
  '.github/workflows/admin-bulk-content-actions.yml',
  '.github/workflows/admin-maintenance.yml',
  '.github/workflows/agency-search-monitor.yml',
  '.github/workflows/query-intelligence.yml',
  '.github/workflows/page-remediation.yml',
  'dist/admin/index.html'
];
for (const rel of required) read(rel);

const shared = read('functions/_shared/github_admin.js');
for (const marker of [
  'GITHUB_OAUTH_CLIENT_ID',
  'GITHUB_OAUTH_CLIENT_SECRET',
  'ADMIN_SESSION_SECRET',
  'GITHUB_ADMIN_TOKEN',
  'GITHUB_ADMIN_REPOSITORY',
  'GITHUB_ADMIN_LOGINS',
  "scope','read:user'",
  "code_challenge_method','S256'",
  'verifyAuthorizedLogin',
  'x-hlg-admin-csrf',
  'originAllowed',
  'HttpOnly',
  'SameSite=Lax',
  'dispatches',
  'validateSelectedIds',
  'Unknown or stale selection ID(s)'
]) if (!shared.includes(marker)) fail(`GitHub admin runtime missing required security marker: ${marker}`);
if (shared.includes('localStorage.setItem') || shared.includes('sessionStorage.setItem')) fail('Server GitHub token/session must not be written to browser storage.');
if (!shared.includes("headers.append('set-cookie'")) fail('OAuth callback must append separate Set-Cookie headers.');
if (!shared.includes("if(plan.needsIds&&!ids.length)")) fail('ID-requiring actions are not guarded.');
if (!shared.includes("Unknown admin action")) fail('Unknown admin actions are not rejected.');

const routes = readJson('_routes.json');
const includes = new Set(routes.include || []);
for (const route of ['/api/admin/*','/api/agency/*','/agency','/agency/*','/data/*']) {
  if (!includes.has(route)) fail(`Cloudflare Functions route include missing: ${route}`);
}

const contract = readJson('data/system/admin_action_contract.json');
const actions = contract.actions || {};
const requiredActions = [
  'content_dry_run','approve_selected','reject_selected','needs_revision_selected',
  'set_publish_date_selected','clear_publish_date_selected','self_heal_prevalidate',
  'validate_repo','refresh_search','rebuild_query_intelligence','admit_query_candidates',
  'refresh_remediation_queue','approve_remediation','reject_remediation','apply_remediation',
  'approve_query_repair','reject_query_repair','apply_query_repair'
];
for (const action of requiredActions) if (!actions[action]) fail(`Admin action contract missing ${action}`);
for (const [action, spec] of Object.entries(actions)) {
  if (!spec.workflow || !fs.existsSync(path.resolve(process.cwd(), '.github/workflows', spec.workflow))) fail(`${action} points to missing workflow ${spec.workflow}`);
}
if (actions.admit_query_candidates?.creates_pending_only !== true) fail('Provider candidate admission must create pending drafts only.');
if (actions.apply_remediation?.requires_prior_approval !== true) fail('Live remediation apply must require prior owner approval.');
if (actions.apply_query_repair?.requires_prior_approval !== true) fail('Query-driven live page repair apply must require prior owner approval.');

const automation = readJson('data/system/automation_mode.json');
if (automation.auto_approve !== false) fail('auto_approve must remain false.');
if (automation.auto_publish_approved_due !== false) fail('auto_publish_approved_due must remain false.');
if (automation.legal_review_required !== true) fail('legal_review_required must remain true.');

const admin = read('dist/admin/index.html');
// The server-side admin capability above is unchanged and still fully asserted.
// What changed is that it is no longer advertised on the client reviewer's page:
// /api/admin/github/login returns Cloudflare Error 1101 and
// /api/admin/github/session reports provider_configured:false, so those six
// buttons and the two /agency/ links were dead controls in front of a lawyer.
// The former presence checks are inverted rather than dropped, so the dead
// controls cannot quietly return while the route is still unconfigured.
for (const phrase of [
  'GitHub-authenticated actions',
  'Sign in with GitHub',
  'Generated command appears here',
  '/api/admin/action',
  'x-hlg-admin-csrf',
  '/agency/'
]) if (admin.includes(phrase)) fail(`Admin page advertises an unconfigured server-side control: ${phrase}`);
// Whatever the reviewer's decision controls are, an action she takes must still
// require an explicit confirmation before it does anything.
if (!admin.includes('window.confirm')) fail('Reviewer decision actions must require an explicit browser confirmation.');
for (const secretName of ['GITHUB_ADMIN_TOKEN','GITHUB_OAUTH_CLIENT_SECRET','ADMIN_SESSION_SECRET']) {
  if (admin.includes(secretName)) fail(`Admin HTML exposes server secret name ${secretName}`);
}
const scripts = [...admin.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => !s.trim().startsWith('{'));
for (const script of scripts) {
  try { new vm.Script(script); } catch (error) { fail(`Admin inline JavaScript invalid: ${error.message}`); }
}

for (const workflow of fs.readdirSync(path.resolve(process.cwd(), '.github/workflows')).filter((name) => name.endsWith('.yml'))) {
  const source = read(`.github/workflows/${workflow}`);
  const lines = source.split(/\r?\n/);
  let inRun = false;
  let runIndent = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const indent = line.length - line.trimStart().length;
    if (/^\s*run:\s*\|/.test(line)) { inRun = true; runIndent = indent; continue; }
    if (inRun && line.trim() && indent <= runIndent) inRun = false;
    if (inRun && line.includes('${{ inputs.')) fail(`${workflow}:${index + 1} directly interpolates workflow input inside shell.`);
  }
}

if (!process.exitCode) console.log('GitHub-authenticated admin contract OK (additive controls, server-side dispatch, allowlist, CSRF, receipts, and manual approval preserved).');

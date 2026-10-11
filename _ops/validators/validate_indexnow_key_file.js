// IndexNow: the key in indexnow.txt is a valid key, it is served at
// /<key>.txt and /indexnow.txt with exactly that content, and the post-deploy
// ping is wired: validate.yml runs scripts/indexing/ping_indexnow_after_deploy.mjs
// on pushes to main, after the validate job, and the script posts to
// api.indexnow.org with the /<key>.txt keyLocation and the sitemap's URLs.
const fs = require('fs');
const path = require('path');
const { createReport } = require('./helpers');

const report = createReport('validate_indexnow_key_file', 'repo');
const read = (rel) => { const abs = path.resolve(process.cwd(), rel); return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null; };
const key = (read('indexnow.txt') || '').trim();
if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) report.addIssue({ file: 'indexnow.txt', code: 'indexnow_key_invalid', message: 'indexnow.txt does not hold a valid IndexNow key.' });
else {
  for (const rel of [`dist/${key}.txt`, 'dist/indexnow.txt']) {
    const body = read(rel);
    if (body === null) report.addIssue({ file: rel, code: 'indexnow_key_file_missing', message: `${rel} is not built.`, fixHint: 'scripts/build/build_site.js writes both from indexnow.txt.' });
    else if (body.trim() !== key) report.addIssue({ file: rel, code: 'indexnow_key_file_mismatch', message: `${rel} does not contain the key from indexnow.txt.` });
  }
}
const script = read('scripts/indexing/ping_indexnow_after_deploy.mjs') || '';
if (!script) report.addIssue({ file: 'scripts/indexing/ping_indexnow_after_deploy.mjs', code: 'ping_script_missing', message: 'Post-deploy IndexNow ping script missing.' });
else for (const token of ['https://api.indexnow.org/indexnow', 'keyLocation', '/sitemap.xml', 'Cloudflare Pages']) if (!script.includes(token)) report.addIssue({ file: 'scripts/indexing/ping_indexnow_after_deploy.mjs', code: 'ping_script_incomplete', message: `Ping script does not reference ${token}.` });
const wf = read('.github/workflows/validate.yml') || '';
const job = wf.split(/\n  (?=[a-z][\w-]*:\n)/).find((block) => block.includes('ping_indexnow_after_deploy.mjs')) || '';
if (!job) report.addIssue({ file: '.github/workflows/validate.yml', code: 'ping_not_wired', message: 'No validate.yml job runs ping_indexnow_after_deploy.mjs.' });
else {
  if (!/needs:\s*validate/.test(job)) report.addIssue({ file: '.github/workflows/validate.yml', code: 'ping_not_after_validate', message: 'IndexNow job must need the validate job.' });
  if (!/github\.event_name == 'push'/.test(job) || !/refs\/heads\/main/.test(job)) report.addIssue({ file: '.github/workflows/validate.yml', code: 'ping_not_main_push_only', message: 'IndexNow job must run only on pushes to main.' });
  if (!/checks:\s*read/.test(job)) report.addIssue({ file: '.github/workflows/validate.yml', code: 'ping_cannot_read_deploy', message: 'IndexNow job needs checks: read to wait for the Cloudflare Pages deploy.' });
}
report.finalize(`IndexNow key served at /${key}.txt and /indexnow.txt; post-deploy ping wired.`);

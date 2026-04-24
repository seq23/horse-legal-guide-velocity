const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ensureExists, fail, ok, readJson } = require('./helpers');

const required = ['faq','scenario','compare','reference','coverage','hubs','insights','articles','whitepapers','authority','admin'];
for (const s of required) ensureExists('dist/' + s + '/index.html');
ensureExists('dist/sitemap.xml');
ensureExists('dist/sitemap-pages.xml');
ensureExists('dist/robots.txt');
ensureExists('dist/llms.txt');
ensureExists('dist/indexnow.txt');

const home = fs.readFileSync(path.resolve(process.cwd(), 'dist/index.html'), 'utf8');
for (const h of ['/faq/','/scenario/','/compare/','/reference/','/coverage/','/insights/','/articles/','/whitepapers/','/authority/','/llms.txt','/sitemap.xml']) {
  if (!home.includes('href="' + h + '"')) fail('Homepage missing discoverability link: ' + h);
}
if (home.includes('All topic hubs')) fail('Homepage still exposes raw topic hubs as primary navigation.');

const cov = fs.readFileSync(path.resolve(process.cwd(), 'dist/coverage/index.html'), 'utf8');
for (const p of ['Query universe','Cluster map','All approved public page targets','Reference / fan-out surfaces']) {
  if (!cov.includes(p)) fail('Coverage page missing section: ' + p);
}
if (/\b\d+\s+public targets\b/.test(cov) || /\b\d+\s+approved public page targets\b/.test(cov)) fail('Coverage page exposes internal numeric target counts.');
const targets = readJson('data/queries/page_targets.json').filter((p) => p.review_status === 'approved');
for (const target of targets) {
  if (!cov.includes('href="' + target.slug + '"')) fail('Coverage page missing approved target: ' + target.slug);
}

const admin = fs.readFileSync(path.resolve(process.cwd(), 'dist/admin/index.html'), 'utf8');
const scripts = [...admin.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => !s.trim().startsWith('{'));
for (const script of scripts) {
  try { new vm.Script(script); } catch (err) { fail('Admin inline script syntax error: ' + err.message); }
}
for (const token of ['draft-list','draft-summary','insight','article','whitepaper','deep_authority']) {
  if (!admin.includes(token)) fail('Admin page missing queue marker: ' + token);
}

const config = readJson('data/system/config.json');
const site = String(config.site_domain || '').replace(/\/$/, '');
const robots = fs.readFileSync(path.resolve(process.cwd(), 'dist/robots.txt'), 'utf8');
const sitemap = fs.readFileSync(path.resolve(process.cwd(), 'dist/sitemap.xml'), 'utf8');
const pages = fs.readFileSync(path.resolve(process.cwd(), 'dist/sitemap-pages.xml'), 'utf8');
for (const [name, text] of Object.entries({ robots, sitemap, pages, home, cov })) {
  if (text.includes('example.invalid')) fail(name + ' contains example.invalid');
}
if (!robots.includes('Sitemap: ' + site + '/sitemap.xml')) fail('robots.txt missing canonical sitemap URL.');
if (!sitemap.includes(site + '/sitemap-pages.xml')) fail('sitemap.xml missing canonical sitemap-pages URL.');
if (!pages.includes(site + '/')) fail('sitemap-pages.xml missing canonical site URLs.');

ok('Public surfaces, admin rendering, coverage map, and crawl basics valid.');

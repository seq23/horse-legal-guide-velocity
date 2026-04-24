const fs = require('fs');
const path = require('path');

function readJson(rel) { return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')); }

async function main() {
  const config = readJson('data/system/config.json');
  const site = String(config.site_domain || '').replace(/\/$/, '');
  const key = config.indexnow_key;
  if (!site || !key) throw new Error('Missing site_domain or indexnow_key in data/system/config.json');
  const urls = process.argv.slice(2);
  if (!urls.length) {
    console.log('Usage: node scripts/indexing/submit_indexnow.js / /sitemap.xml /faq/your-page/');
    process.exit(0);
  }
  const urlList = urls.map((u) => u.startsWith('http') ? u : site + (u.startsWith('/') ? u : '/' + u));
  const payload = { host: new URL(site).host, key, keyLocation: site + '/indexnow.txt', urlList };
  const res = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  console.log('IndexNow status:', res.status, res.statusText);
  if (!res.ok) console.log(await res.text());
}
main().catch((err) => { console.error(err.message); process.exit(1); });

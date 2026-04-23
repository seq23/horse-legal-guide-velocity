const fs = require('fs');
const path = require('path');
const { ensureExists, fail, ok } = require('./helpers');
ensureExists('dist/sitemap.xml');
ensureExists('dist/sitemap-pages.xml');
ensureExists('dist/llms.txt');
const sitemap = fs.readFileSync(path.resolve(process.cwd(), 'dist/sitemap-pages.xml'), 'utf8');
if (!sitemap.includes('/disclaimer/') || !sitemap.includes('/privacy-policy/')) fail('Required policy pages missing from sitemap');
ok('distribution valid');

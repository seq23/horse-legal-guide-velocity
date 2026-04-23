const fs = require('fs');
const path = require('path');

function collectHtmlUrls(baseDir, root = '') {
  const urls = [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);
    const relPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      urls.push(...collectHtmlUrls(fullPath, relPath));
    } else if (entry.isFile() && entry.name === 'index.html') {
      let urlPath = '/' + root.replace(/\\/g, '/');
      urlPath = urlPath.endsWith('/') ? urlPath : urlPath + '/';
      if (urlPath === '//') urlPath = '/';
      urls.push(urlPath);
    }
  }
  return urls.sort();
}

function writeSitemaps(distDir, canonicalDomain) {
  const urls = collectHtmlUrls(distDir);
  const pageEntries = urls.map((url) => `<url><loc>${canonicalDomain}${url === '/' ? '' : url}</loc></url>`).join('');
  const pagesXml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pageEntries}</urlset>`;
  fs.writeFileSync(path.join(distDir, 'sitemap-pages.xml'), pagesXml);
  const indexXml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${canonicalDomain}/sitemap-pages.xml</loc></sitemap></sitemapindex>`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), indexXml);
  return urls;
}

module.exports = { writeSitemaps };

// favicon.ico, apple-touch-icon.png and site.webmanifest are served from the
// dist root, are the formats and sizes they claim, and every public page links
// all three (plus the 32px PNG icon) to files that exist.
const fs = require('fs');
const { createReport } = require('./helpers');
const { publicPages, distFileFor, pngSize } = require('./seo_pages');

const report = createReport('validate_favicon_manifest', 'repo');
const exists = (f) => f && fs.existsSync(f);

const ico = distFileFor('/favicon.ico');
if (!exists(ico)) report.addIssue({ file: 'dist/favicon.ico', code: 'favicon_missing', message: 'dist/favicon.ico is missing (the live site 404s it).', fixHint: 'Run scripts/build/generate_brand_assets.py; build_site.js copies assets/brand/ to dist/.' });
else {
  const b = fs.readFileSync(ico);
  if (!(b.readUInt16LE(0) === 0 && b.readUInt16LE(2) === 1 && b.readUInt16LE(4) >= 1)) report.addIssue({ file: 'dist/favicon.ico', code: 'favicon_not_ico', message: 'favicon.ico is not an ICO file.', fixHint: 'Regenerate with generate_brand_assets.py.' });
}
const touch = distFileFor('/apple-touch-icon.png');
const touchSize = exists(touch) && pngSize(touch);
if (!touchSize || touchSize.width !== 180 || touchSize.height !== 180) report.addIssue({ file: 'dist/apple-touch-icon.png', code: 'apple_touch_icon_bad', message: `apple-touch-icon.png must be a 180x180 PNG (got ${touchSize ? `${touchSize.width}x${touchSize.height}` : 'missing'}).`, fixHint: 'Regenerate with generate_brand_assets.py.' });

const manifestFile = distFileFor('/site.webmanifest');
if (!exists(manifestFile)) report.addIssue({ file: 'dist/site.webmanifest', code: 'manifest_missing', message: 'dist/site.webmanifest is missing.', fixHint: 'Regenerate with generate_brand_assets.py.' });
else {
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch (e) { report.addIssue({ file: 'dist/site.webmanifest', code: 'manifest_unparseable', message: `site.webmanifest is not JSON: ${e.message}` }); }
  if (manifest) {
    for (const key of ['name', 'short_name', 'start_url', 'theme_color', 'background_color']) if (!manifest[key]) report.addIssue({ file: 'dist/site.webmanifest', code: 'manifest_field_missing', message: `site.webmanifest has no ${key}.` });
    const icons = manifest.icons || [];
    if (!icons.length) report.addIssue({ file: 'dist/site.webmanifest', code: 'manifest_no_icons', message: 'site.webmanifest lists no icons.' });
    for (const icon of icons) {
      const f = distFileFor(icon.src);
      const size = exists(f) && pngSize(f);
      if (!size || `${size.width}x${size.height}` !== icon.sizes) report.addIssue({ file: 'dist/site.webmanifest', code: 'manifest_icon_bad', message: `Manifest icon ${icon.src} is missing or not ${icon.sizes}.` });
    }
  }
}

const required = [
  ['icon_ico', /<link rel="icon" href="([^"]+)" sizes="any">/i],
  ['icon_png', /<link rel="icon" type="image\/png" sizes="32x32" href="([^"]+)">/i],
  ['apple_touch', /<link rel="apple-touch-icon" href="([^"]+)">/i],
  ['manifest', /<link rel="manifest" href="([^"]+)">/i]
];
const pages = publicPages('validate:favicon-manifest');
for (const page of pages) {
  for (const [code, re] of required) {
    const m = page.html.match(re);
    if (!m) { report.addIssue({ file: page.rel, code: `${code}_link_missing`, message: `Page has no ${code.replace('_', ' ')} link tag.`, fixHint: 'renderLayout writes these via renderIconAndSocialHead().' }); continue; }
    if (!exists(distFileFor(m[1]))) report.addIssue({ file: page.rel, code: `${code}_link_dangling`, message: `${code} link ${m[1]} does not resolve to a dist/ file.` });
  }
}
report.finalize(`favicon.ico, apple-touch-icon, site.webmanifest valid; ${pages.length} public pages link all icons.`);

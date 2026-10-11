// Every public page carries the complete Open Graph + Twitter card set:
// og:title/description/type/url/site_name/image/image:width/image:height and
// twitter:card=summary_large_image/title/description/image. og:description and
// twitter:description equal the meta description; og:url equals the canonical;
// og:image is a same-origin PNG whose real pixel size matches the declared one.
const fs = require('fs');
const { createReport } = require('./helpers');
const { publicPages, metaContent, canonicalOf, distFileFor, pngSize, siteOrigin } = require('./seo_pages');

const report = createReport('validate_social_meta', 'repo');
const pages = publicPages('validate:social-meta');
const origin = siteOrigin();
const one = (page, attr, name) => {
  const vals = metaContent(page.html, attr, name);
  if (vals.length !== 1 || !vals[0]) {
    report.addIssue({ file: page.rel, code: 'social_tag_missing_or_duplicated', message: `${name} appears ${vals.length} time(s) (need exactly one, non-empty).`, fixHint: 'renderLayout writes the set via renderIconAndSocialHead().' });
    return null;
  }
  return vals[0];
};
const imageSizes = new Map();
for (const page of pages) {
  const desc = one(page, 'name', 'description');
  const ogTitle = one(page, 'property', 'og:title');
  const ogDesc = one(page, 'property', 'og:description');
  const ogType = one(page, 'property', 'og:type');
  const ogUrl = one(page, 'property', 'og:url');
  one(page, 'property', 'og:site_name');
  const ogImage = one(page, 'property', 'og:image');
  const w = one(page, 'property', 'og:image:width');
  const h = one(page, 'property', 'og:image:height');
  const card = one(page, 'name', 'twitter:card');
  const twTitle = one(page, 'name', 'twitter:title');
  const twDesc = one(page, 'name', 'twitter:description');
  const twImage = one(page, 'name', 'twitter:image');
  const issue = (code, message) => report.addIssue({ file: page.rel, code, message });
  if (desc && ogDesc && ogDesc !== desc) issue('og_description_mismatch', 'og:description differs from the meta description.');
  if (desc && twDesc && twDesc !== desc) issue('twitter_description_mismatch', 'twitter:description differs from the meta description.');
  if (ogTitle && twTitle && ogTitle !== twTitle) issue('twitter_title_mismatch', 'twitter:title differs from og:title.');
  if (ogType && !['website', 'article'].includes(ogType)) issue('og_type_invalid', `og:type "${ogType}" is not website/article.`);
  if (ogUrl && ogUrl !== canonicalOf(page.html)) issue('og_url_not_canonical', `og:url ${ogUrl} is not the page canonical.`);
  if (card && card !== 'summary_large_image') issue('twitter_card_wrong', `twitter:card is "${card}", expected summary_large_image.`);
  if (ogImage && twImage && ogImage !== twImage) issue('twitter_image_mismatch', 'twitter:image differs from og:image.');
  if (ogImage) {
    if (!ogImage.startsWith(`${origin}/`)) { issue('og_image_not_absolute_same_origin', `og:image ${ogImage} is not an absolute ${origin} URL.`); continue; }
    if (!imageSizes.has(ogImage)) { const f = distFileFor(ogImage); imageSizes.set(ogImage, f && fs.existsSync(f) ? pngSize(f) : null); }
    const size = imageSizes.get(ogImage);
    if (!size) issue('og_image_missing', `og:image ${ogImage} is not a PNG in dist/.`);
    else if (String(size.width) !== w || String(size.height) !== h) issue('og_image_dimensions_wrong', `og:image is ${size.width}x${size.height} but declares ${w}x${h}.`);
    else if (size.width !== 1200 || size.height !== 630) issue('og_image_not_1200x630', `og:image is ${size.width}x${size.height}, expected 1200x630.`);
  }
}
report.finalize(`complete og/twitter set with image dimensions on ${pages.length} public pages.`);

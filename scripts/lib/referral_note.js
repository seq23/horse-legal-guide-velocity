const fs = require('fs');
const path = require('path');

// The one referral note every public page ends with (PR #92 review sr_mwpc88moj4bd, and the
// Engineering review of 22 Nov 2026: the note had been typed by hand in four builders, so the
// article pages kept "Learn more here" after the home page was fixed). Built here only.
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function firm() {
  const config = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/system/config.json'), 'utf8'));
  return { name: config.canonical_brand_name || 'Wise Covington PLLC', site: config.canonical_domain || 'https://wisecovington.com' };
}

/**
 * @param {object} o
 * @param {string} [o.href]       where the firm links (a page's mapped firm page; default the firm's site)
 * @param {boolean} [o.disclaimer] add the educational-only line (article and hub pages)
 * @param {string} [o.zone]       the data-editable-zone the page contract expects, if any
 */
function referralNote({ href, disclaimer = false, zone } = {}) {
  const f = firm();
  const to = esc(href || f.site);
  return `<section class="routing-block"${zone ? ` data-editable-zone="${esc(zone)}"` : ''}>
  <p>Every horse deal turns on its own facts and documents, and sale, lease and liability rules differ from state to state.</p>
  <p>For guidance on your own situation, talk to <a href="${to}"><strong>${esc(f.name)}</strong></a>, a law firm that focuses on legal issues in the horse world.</p>
${disclaimer ? '  <p>This page is educational only and does not provide legal advice or create an attorney-client relationship.</p>\n' : ''}  <p><a href="${to}">Visit ${esc(f.name)}</a>.</p>
</section>`;
}

module.exports = { referralNote };

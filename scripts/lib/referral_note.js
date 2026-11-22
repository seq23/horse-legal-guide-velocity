// The one referral note every public page ends with (PR #92 review sr_mwpc88moj4bd, and the
// Engineering review of 22 Nov 2026: the note had been typed by hand in four builders, so the
// article pages kept "Learn more here" after the home page was fixed). Built here only.
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The page footer (templates/partial.footer.html) already names the firm, links it, carries the
// disclaimer and the one contact action, so the note only says why your own facts matter (review
// sr_mwrth0b9al4j, 22 Nov 2026: a second disclaimer and a second firm pitch ten lines apart read
// as stacked boilerplate).
function referralNote({ zone } = {}) {
  return `<section class="routing-block"${zone ? ` data-editable-zone="${esc(zone)}"` : ''}>
  <p>Every horse deal turns on its own facts and documents, and sale, lease and liability rules differ from state to state, so get advice on your own situation before you sign or act.</p>
</section>`;
}

module.exports = { referralNote };

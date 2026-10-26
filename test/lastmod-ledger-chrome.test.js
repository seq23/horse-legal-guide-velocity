'use strict';
// The lastmod ledger must not read a site-chrome change as a content change.
//
// 26 Oct 2026: adding one link to the footer nav advanced the lastmod of all
// 324 URLs to the build date in a single build. renderLayout puts the brand
// header and the site footer INSIDE <main class="page-shell">, and the hash
// covered the whole <main>, so chrome repeated verbatim on every page was part
// of every page's content hash. A uniform date bump is the exact failure this
// ledger exists to prevent - validate_no_inert_stages.js caught it - and it
// arrived through the hash rather than through a shallow clone.
//
// These tests pin both halves of the fix: chrome is outside the hash, and a
// change to the hash DEFINITION preserves the dates already recorded instead
// of bumping everything on the migrating build.
const test = require('node:test');
const assert = require('node:assert');
const ledger = require('../scripts/lib/lastmod_ledger.js');

const page = (bodyText, footerLinks) => `<!doctype html><html><head><title>t</title></head><body>
  <main class="page-shell">
    <div class="page-card">
<header class="site-brand-header">
  <div><span class="eyebrow">Horse Legal Guide</span></div>
</header>
<p>${bodyText}</p>
<footer class="site-footer">
  <p>${footerLinks}</p>
</footer>
    </div>
  </main>
</body></html>`;

test('a footer-only change does not change the page content hash', () => {
  const before = ledger.pageContentHash(page('The answer.', '<a href="/disclaimer/">Disclaimer</a>'));
  const after = ledger.pageContentHash(page('The answer.', '<a href="/about/">About</a> · <a href="/disclaimer/">Disclaimer</a>'));
  assert.strictEqual(after, before, 'adding a footer nav link must not re-hash the page');
});

test('a brand-header-only change does not change the page content hash', () => {
  const before = ledger.pageContentHash(page('The answer.', 'x'));
  const after = ledger.pageContentHash(page('The answer.', 'x').replace('Horse Legal Guide</span>', 'Horse Legal Guide Â·</span>'));
  assert.strictEqual(after, before, 'changing the brand header must not re-hash the page');
});

test('a change to the page body DOES change the hash', () => {
  const before = ledger.pageContentHash(page('The answer.', 'x'));
  const after = ledger.pageContentHash(page('A different answer.', 'x'));
  assert.notStrictEqual(after, before, 'a real content change must still move the hash');
});

test('a hash-definition change preserves the dates already recorded', () => {
  // Entries written under an older schema: every hash mismatches for a reason
  // that has nothing to do with content.
  const stored = {
    schema: 'lastmod-ledger-v2',
    entries: {
      '/a/': { hash: 'old-hash-a', lastmod: '2026-09-25' },
      '/b/': { hash: 'old-hash-b', lastmod: '2026-09-28' }
    }
  };
  const pages = {
    '/a/': { hash: 'new-hash-a', file: 'dist/a/index.html' },
    '/b/': { hash: 'new-hash-b', file: 'dist/b/index.html' },
    '/c/': { hash: 'new-hash-c', file: 'dist/c/index.html' }
  };
  const resolved = ledger.resolve(pages, stored, '2026-10-26', { trustGit: false });
  assert.strictEqual(resolved['/a/'], '2026-09-25', 'a known URL keeps its recorded date across a schema migration');
  assert.strictEqual(resolved['/b/'], '2026-09-28', 'a known URL keeps its recorded date across a schema migration');
  assert.strictEqual(resolved['/c/'], '2026-10-26', 'a URL the ledger has never seen is still seeded');
});

test('without a schema change, a differing hash still advances the date', () => {
  const stored = {
    schema: require('../scripts/lib/lastmod_ledger.js').SCHEMA,
    entries: { '/a/': { hash: 'old-hash-a', lastmod: '2026-09-25' } }
  };
  const resolved = ledger.resolve({ '/a/': { hash: 'changed', file: 'dist/a/index.html' } }, stored, '2026-10-26', { trustGit: false });
  assert.strictEqual(resolved['/a/'], '2026-10-26', 'real content change under the current schema must advance lastmod');
});

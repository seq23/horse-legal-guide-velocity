'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writePublicIndexes } = require('../scripts/build/write_public_indexes');
const paths = ['faq', 'scenario', 'compare', 'state', 'hubs', 'reference'];
function output() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hlg-index-schema-'));
  const targets = ['faq','scenario','comparison','state'].map((type, index) => ({ review_status: 'approved', page_type: type, slug: '/test/'+index+'/', title: 'Question '+index+'?', cluster: 'test' }));
  writePublicIndexes(dir, targets, [{ slug: '/hubs/test/', title: 'Test hub', cluster: 'test' }], [{ slug: 'test', query: 'Test reference?' }]);
  return Object.fromEntries(paths.map(slug => [slug, fs.readFileSync(path.join(dir, slug, 'index.html'), 'utf8')]));
}
test('library list schema remains absent until approval; approved lists mirror visible ordered links; revocation restores exact output', () => {
  const previous = process.env.PREVIEW_SITE_CHANGES;
  try {
    delete process.env.PREVIEW_SITE_CHANGES;
    const pending = output();
    for (const html of Object.values(pending)) assert.ok(!html.includes('"@type":"ItemList"'));
    process.env.PREVIEW_SITE_CHANGES = 'public-index-itemlist';
    const approved = output();
    for (const slug of paths) {
      const html = approved[slug];
      const nodes = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
      const lists = nodes.filter(node => node['@type'] === 'ItemList');
      assert.equal(lists.length, 1, slug);
      const list = lists[0]; assert.ok(list.numberOfItems > 0, slug);
      const visible = [...html.match(/<h2>Pages<\/h2><ul>(.*?)<\/ul>/s)[1].matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)];
      assert.equal(list.numberOfItems, visible.length);
      assert.deepEqual(list.itemListElement, visible.map((match,index) => ({ '@type':'ListItem', position:index+1, name:match[2], url:'https://horselegalguide.com'+match[1] })));
      assert.equal(list.url, 'https://horselegalguide.com/'+slug+'/');
      // Only metadata changes, and stripping it recovers every original byte.
      assert.equal(html.replace(/<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org","@type":"ItemList".*?<\/script>/, ''), pending[slug]);
    }
    delete process.env.PREVIEW_SITE_CHANGES;
    assert.deepEqual(output(), pending);
  } finally {
    if (previous === undefined) delete process.env.PREVIEW_SITE_CHANGES; else process.env.PREVIEW_SITE_CHANGES=previous;
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

test('build installs recording only on visitor form/buy pages and removes stale tags', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'horse-clarity-'));
  try {
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.mkdirSync(path.join(root, 'data'));
    fs.cpSync(path.join(__dirname, '../scripts/install_clarity.js'), path.join(root, 'scripts/install_clarity.js'));
    fs.writeFileSync(path.join(root, 'data/clarity_projects.json'), JSON.stringify({ public_root: 'dist', projects: { 'horselegalguide.com': 'fixture-project' } }));
    const stale = '<script data-clarity-loader>oldRecording()</script>';
    const fixtures = {
      'index.html': '<h1>Horse Legal Guide</h1>',
      'article/index.html': '<!-- <form> --><script>const example = "<form>";</script><a href="/faq/">Read answers</a>',
      'stale/index.html': stale + '<p>A form was removed.</p>',
      'contact/index.html': '<form action="/api/inquiry"><input name="message"><button>Send</button></form>',
      'buy/index.html': '<a href="https://example.gumroad.com/l/guide">Buy guide</a>',
      'checkout/index.html': '<a href=/checkout/>Buy</a>',
      'spoof/index.html': '<a href="https://gumroad.com.evil.invalid/l/guide">Article</a>',
      'admin/index.html': stale + '<form><input type="password"></form>',
      '404.html': '<p>Page not found</p>',
    };
    const read = (rel) => fs.readFileSync(path.join(root, 'dist', rel), 'utf8');
    for (const [rel, body] of Object.entries(fixtures)) {
      fs.mkdirSync(path.dirname(path.join(root, 'dist', rel)), { recursive: true });
      fs.writeFileSync(path.join(root, 'dist', rel), `<html><head></head><body>${body}</body></html>`);
    }
    const run = () => execFileSync(process.execPath, [path.join(root, 'scripts/install_clarity.js')]);
    run();
    for (const rel of Object.keys(fixtures)) {
      assert.equal(read(rel).includes('data-clarity-loader'), ['contact/index.html', 'buy/index.html', 'checkout/index.html'].includes(rel), rel);
    }
    const before = Object.keys(fixtures).map(read);
    run();
    assert.deepEqual(Object.keys(fixtures).map(read), before, 'installer must be idempotent');
    // The installed script must still choose the correct host, including www,
    // and never load a real project on an unrelated host or local preview.
    const script = read('contact/index.html').match(/<script data-clarity-loader>([\s\S]*?)<\/script>/)[1];
    for (const host of ['horselegalguide.com', 'www.horselegalguide.com', 'unrelated.invalid', 'localhost']) {
      const loaded = [];
      const document = { createElement: () => ({}), getElementsByTagName: () => [{ parentNode: { insertBefore: (s) => loaded.push(s.src) } }] };
      vm.runInNewContext(script, { window: { location: { hostname: host } }, document });
      assert.deepEqual(loaded, host.endsWith('horselegalguide.com') ? ['https://www.clarity.ms/tag/fixture-project'] : []);
    }
    fs.writeFileSync(path.join(root, 'dist/contact/index.html'), read('contact/index.html').replace(/<form[\s\S]*?<\/form>/, '<p>Inquiry form retired</p>'));
    run();
    assert.equal(read('contact/index.html').includes('data-clarity-loader'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

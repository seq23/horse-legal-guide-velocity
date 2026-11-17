const test = require('node:test');
const assert = require('node:assert');
const { isFacebookSignal } = require('../scripts/community/signal_utils');

const cases = [
  // [signal, isFacebook]
  [{ platform: 'reddit', source_key: 'reddit_equestrian', source_url: 'https://www.reddit.com/r/Equestrian/comments/abc/this_is_why_i_hate_facebook/' }, false],
  [{ platform: 'facebook', source_key: 'facebook_groups', source_url: 'https://example.com/' }, true],
  [{ platform: 'reddit', source_key: 'facebook_groups_mirror', source_url: 'https://www.reddit.com/r/x/' }, true],
  [{ platform: 'web', source_key: 'forum', source_url: 'https://www.facebook.com/groups/horses/posts/1' }, true],
  [{ platform: 'web', source_key: 'forum', source_url: 'https://m.facebook.com/story.php?id=1' }, true],
  [{ platform: 'web', source_key: 'forum', source_url: 'https://fb.watch/abc' }, true],
  [{ platform: 'web', source_key: 'forum', source_url: 'https://notfacebook.com.example.org/facebook' }, false],
  [{ platform: 'quora', source_key: 'quora_horses', source_url: 'not a url' }, false],
];

test('a removed (Facebook) source is known by its platform, source or link host, never by words in the link', () => {
  assert.ok(cases.length > 0, 'examined zero cases');
  for (const [signal, expected] of cases) assert.strictEqual(isFacebookSignal(signal), expected, JSON.stringify(signal));
});

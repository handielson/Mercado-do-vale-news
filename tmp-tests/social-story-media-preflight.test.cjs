const assert = require('node:assert/strict');
const test = require('node:test');
const { assertSocialStoryMediaAvailable } = require('../services/marketingCampaignApi.cjs');

test('accepts an available Story media URL', async () => {
  let calls = 0;
  await assertSocialStoryMediaAvailable({ media_url: 'https://example.com/story.jpg' }, {
    fetchImpl: async (_url, options) => {
      calls += 1;
      assert.equal(options.method, 'HEAD');
      return { ok: true, status: 200 };
    },
  });
  assert.equal(calls, 1);
});

test('marks an unavailable Synology-backed media URL as safely retryable', async () => {
  await assert.rejects(
    assertSocialStoryMediaAvailable({ media_url: 'https://videos.mercadodovale.com.br/story.mp4' }, {
      fetchImpl: async () => ({ ok: false, status: 530 }),
    }),
    (error) => error.code === 'SOCIAL_STORY_MEDIA_UNAVAILABLE' && /HTTP 530/.test(error.message),
  );
});

test('falls back to a ranged GET when HEAD is unsupported', async () => {
  const methods = [];
  await assertSocialStoryMediaAvailable({ media_url: 'https://example.com/story.mp4' }, {
    fetchImpl: async (_url, options) => {
      methods.push(options.method);
      if (options.method === 'HEAD') return { ok: false, status: 405 };
      return { ok: true, status: 206, body: { cancel: async () => {} } };
    },
  });
  assert.deepEqual(methods, ['HEAD', 'GET']);
});

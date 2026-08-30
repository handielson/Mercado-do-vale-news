const assert = require('node:assert/strict');
const test = require('node:test');
const { expandSocialStoryItemsForDates } = require('../services/marketingCampaignApi.cjs');

test('expands repeated Story media across dates inside one approval batch', () => {
  const dates = [
    new Date('2030-01-02T11:00:00.000Z'),
    new Date('2030-01-03T11:00:00.000Z'),
  ];
  const items = [{
    media_type: 'video',
    media_url: 'https://example.com/story.mp4',
    label: 'Story avulso',
    caption: '',
    offset_seconds: 15,
  }];

  const expanded = expandSocialStoryItemsForDates(items, dates);

  assert.equal(expanded.length, 2);
  assert.deepEqual(expanded.map((item) => item.day_index), [0, 1]);
  assert.deepEqual(expanded.map((item) => item.source_item_index), [0, 0]);
  assert.deepEqual(expanded.map((item) => item.scheduled_at.toISOString()), [
    '2030-01-02T11:00:15.000Z',
    '2030-01-03T11:00:15.000Z',
  ]);
});

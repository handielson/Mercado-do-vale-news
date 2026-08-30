import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSocialStoryScheduleInstant,
  prepareSocialStoryScheduleDates,
  STORY_SCHEDULE_PAST_TOLERANCE_MS,
} from '../services/socialStoryScheduleTime.js';

test('builds a browser-local Story instant without losing the selected wall time', () => {
  const instant = buildSocialStoryScheduleInstant('2030-01-02', '14:35');
  assert.ok(instant instanceof Date);
  assert.equal(instant.getFullYear(), 2030);
  assert.equal(instant.getMonth(), 0);
  assert.equal(instant.getDate(), 2);
  assert.equal(instant.getHours(), 14);
  assert.equal(instant.getMinutes(), 35);
});

test('detects stale schedules while preserving sorted future dates', () => {
  const now = new Date('2030-01-02T14:35:00').getTime();
  const stale = prepareSocialStoryScheduleDates(['2030-01-02'], '14:30', now);
  assert.equal(stale.past?.dateKey, '2030-01-02');

  const future = prepareSocialStoryScheduleDates(['2030-01-04', '2030-01-03', '2030-01-03'], '14:30', now);
  assert.equal(future.past, null);
  assert.deepEqual(future.entries.map((entry) => entry.dateKey), ['2030-01-03', '2030-01-04']);
});

test('keeps the same one-minute tolerance used by the VPS', () => {
  const instant = new Date('2030-01-02T14:35:00').getTime();
  const withinTolerance = prepareSocialStoryScheduleDates(
    ['2030-01-02'],
    '14:35',
    instant + STORY_SCHEDULE_PAST_TOLERANCE_MS,
  );
  assert.equal(withinTolerance.past, null);
  const expired = prepareSocialStoryScheduleDates(
    ['2030-01-02'],
    '14:35',
    instant + STORY_SCHEDULE_PAST_TOLERANCE_MS + 1,
  );
  assert.equal(expired.past?.dateKey, '2030-01-02');
});

test('rejects malformed calendar or time values', () => {
  assert.equal(buildSocialStoryScheduleInstant('02/01/2030', '14:35'), null);
  assert.equal(buildSocialStoryScheduleInstant('2030-01-02', '2:35'), null);
  assert.equal(prepareSocialStoryScheduleDates(['invalid'], '14:35').invalid?.dateKey, 'invalid');
});

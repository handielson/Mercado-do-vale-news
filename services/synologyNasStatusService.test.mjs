import assert from 'node:assert/strict';
import {
  buildSynologyStatusResponse,
  normalizeSynologyStatusPayload,
} from './synologyNasStatusService.js';

const onlineNow = new Date('2026-04-20T16:41:00.000Z');
const onlineSnapshot = normalizeSynologyStatusPayload({
  hostname: 'Hand_Server',
  model: 'DS723+',
  timestamp: '2026-04-20T16:40:00.000Z',
  uptime_seconds: 3600,
  memory: { total_mb: 1942, used_mb: 765, available_mb: 876 },
  swap: { total_mb: 3213, used_mb: 28, free_mb: 3185 },
  cache: { cached_mb: 762, buffers_mb: 18, slab_mb: 126 },
  scheduled_reboot: { enabled: true, label: 'Domingo 04:00' },
}, onlineNow);

assert.equal(onlineSnapshot.hostname, 'Hand_Server');
assert.equal(onlineSnapshot.model, 'DS723+');
assert.equal(onlineSnapshot.memory.used_percent, 39);
assert.equal(onlineSnapshot.memory.available_percent, 45);
assert.equal(onlineSnapshot.swap.used_percent, 1);
assert.equal(onlineSnapshot.freshness.state, 'online');
assert.equal(onlineSnapshot.health.level, 'ok');
assert.equal(onlineSnapshot.scheduled_reboot.enabled, true);
assert.equal(onlineSnapshot.scheduled_reboot.label, 'Domingo 04:00');

const staleResponse = buildSynologyStatusResponse({
  snapshot: onlineSnapshot,
  command: { id: 'cmd-1', command: 'restart-cloudflared', status: 'pending' },
  now: new Date('2026-04-20T16:44:30.000Z'),
});

assert.equal(staleResponse.ok, false);
assert.equal(staleResponse.state, 'stale');
assert.equal(staleResponse.snapshot.freshness.state, 'stale');
assert.equal(staleResponse.snapshot.health.level, 'warning');
assert.deepEqual(staleResponse.command, { id: 'cmd-1', command: 'restart-cloudflared', status: 'pending' });

const offlineResponse = buildSynologyStatusResponse({
  snapshot: {
    ...onlineSnapshot,
    timestamp: '2026-04-20T16:30:00.000Z',
  },
  command: null,
  now: new Date('2026-04-20T16:41:00.000Z'),
});

assert.equal(offlineResponse.ok, false);
assert.equal(offlineResponse.state, 'offline');
assert.equal(offlineResponse.snapshot.freshness.state, 'offline');
assert.equal(offlineResponse.snapshot.health.level, 'critical');

const missingResponse = buildSynologyStatusResponse({
  snapshot: null,
  command: null,
  now: onlineNow,
});

assert.equal(missingResponse.ok, false);
assert.equal(missingResponse.state, 'missing');
assert.equal(missingResponse.snapshot, null);
assert.equal(missingResponse.command, null);

console.log('synologyNasStatusService.test.mjs: ok');

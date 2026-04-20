import assert from 'node:assert/strict';
import { createSynologyCommandQueue } from './synologyCommandQueueService.js';

const queue = createSynologyCommandQueue({ ttlMs: 5 * 60 * 1000 });
const t0 = new Date('2026-04-20T10:00:00.000Z');

const first = queue.enqueue('restart-cloudflared', t0);
assert.equal(first.ok, true);
assert.equal(first.command.command, 'restart-cloudflared');
assert.equal(first.command.status, 'pending');

const pollPending = queue.poll(new Date('2026-04-20T10:00:30.000Z'));
assert.equal(pollPending.command, 'restart-cloudflared');
assert.equal(typeof pollPending.id, 'string');

const locked = queue.enqueue('reboot-nas', new Date('2026-04-20T10:01:00.000Z'));
assert.equal(locked.ok, false);
assert.equal(locked.reason, 'pending');
assert.equal(locked.command.status, 'pending');

const statusBeforeExpiry = queue.getStatus(new Date('2026-04-20T10:04:59.000Z'));
assert.equal(statusBeforeExpiry.status, 'pending');

const expiredStatus = queue.getStatus(new Date('2026-04-20T10:05:01.000Z'));
assert.equal(expiredStatus.status, 'expired');
assert.equal(queue.poll(new Date('2026-04-20T10:05:02.000Z')).command, null);

const reboot = queue.enqueue('reboot-nas', new Date('2026-04-20T10:05:03.000Z'));
assert.equal(reboot.ok, true);
assert.equal(reboot.command.command, 'reboot-nas');

const rebootPoll = queue.poll(new Date('2026-04-20T10:05:04.000Z'));
assert.equal(rebootPoll.command, 'reboot-nas');

const ackFailed = queue.ack(
  { id: rebootPoll.id, status: 'failed', result: 'Reboot manual interrompido' },
  new Date('2026-04-20T10:05:05.000Z'),
);

assert.equal(ackFailed.ok, true);
assert.equal(ackFailed.command.status, 'failed');
assert.equal(ackFailed.command.result, 'Reboot manual interrompido');
assert.equal(queue.poll(new Date('2026-04-20T10:05:06.000Z')).command, null);

const rebootAgain = queue.enqueue('reboot-nas', new Date('2026-04-20T10:06:00.000Z'));
assert.equal(rebootAgain.ok, true);
const rebootAgainPoll = queue.poll(new Date('2026-04-20T10:06:01.000Z'));
const ackSuccess = queue.ack(
  { id: rebootAgainPoll.id, status: 'success', result: 'NAS reboot scheduled' },
  new Date('2026-04-20T10:06:02.000Z'),
);

assert.equal(ackSuccess.command.status, 'success');
assert.equal(ackSuccess.command.result, 'NAS reboot scheduled');
assert.equal(queue.getStatus(new Date('2026-04-20T10:06:03.000Z')).status, 'success');

console.log('synologyCommandQueueService.test.mjs: ok');

import assert from 'node:assert/strict';
import { buildSynologyStatusViewModel } from './synologyStatusViewModel.js';

const onlineModel = buildSynologyStatusViewModel({
  synologyStatus: {
    state: 'online',
    snapshot: {
      hostname: 'Hand_Server',
      model: 'DS723+',
      timestamp: '2026-04-20T16:40:00.000Z',
      uptime_seconds: 7200,
      memory: {
        total_mb: 1942,
        used_mb: 1200,
        available_mb: 742,
        used_percent: 62,
        available_percent: 38,
      },
      swap: {
        total_mb: 3213,
        used_mb: 300,
        free_mb: 2913,
        used_percent: 9,
      },
      scheduled_reboot: {
        enabled: true,
        label: 'Domingo 04:00',
      },
      health: {
        level: 'ok',
        message: 'Memoria estavel',
      },
      freshness: {
        state: 'online',
        age_ms: 45_000,
      },
    },
  },
  commandStatus: null,
  now: new Date('2026-04-20T16:40:45.000Z'),
});

assert.equal(onlineModel.title, 'Hand_Server');
assert.equal(onlineModel.subtitle, 'DS723+');
assert.equal(onlineModel.status.label, 'Synology online');
assert.equal(onlineModel.heartbeat.state, 'online');
assert.match(onlineModel.heartbeat.label, /45s/);
assert.equal(onlineModel.schedule.label, 'Domingo 04:00');
assert.equal(onlineModel.actions.restartTunnel.disabled, false);
assert.equal(onlineModel.actions.rebootNas.disabled, false);
assert.equal(onlineModel.command.blocked, false);

const pendingModel = buildSynologyStatusViewModel({
  synologyStatus: {
    state: 'stale',
    snapshot: {
      hostname: 'Hand_Server',
      model: 'DS723+',
      timestamp: '2026-04-20T16:30:00.000Z',
      uptime_seconds: 7200,
      memory: {
        total_mb: 1942,
        used_mb: 1400,
        available_mb: 542,
        used_percent: 72,
        available_percent: 28,
      },
      swap: {
        total_mb: 3213,
        used_mb: 410,
        free_mb: 2803,
        used_percent: 13,
      },
      scheduled_reboot: {
        enabled: false,
        label: '',
      },
      health: {
        level: 'warning',
        message: 'Memoria em alerta',
      },
      freshness: {
        state: 'stale',
        age_ms: 180_000,
      },
    },
  },
  commandStatus: {
    id: 'cmd_123',
    command: 'reboot-nas',
    status: 'pending',
    enqueuedAt: '2026-04-20T16:32:00.000Z',
    completedAt: null,
    result: null,
  },
  now: new Date('2026-04-20T16:33:00.000Z'),
});

assert.equal(pendingModel.status.label, 'Leitura desatualizada');
assert.equal(pendingModel.heartbeat.state, 'stale');
assert.equal(pendingModel.command.blocked, true);
assert.match(pendingModel.command.label, /pendente/i);
assert.equal(pendingModel.actions.restartTunnel.disabled, true);
assert.equal(pendingModel.actions.rebootNas.disabled, true);
assert.match(pendingModel.actions.rebootNas.reason, /comando pendente/i);
assert.equal(pendingModel.schedule.label, 'Agendamento não configurado');

const missingModel = buildSynologyStatusViewModel({
  synologyStatus: {
    state: 'missing',
    snapshot: null,
  },
  commandStatus: null,
  now: new Date('2026-04-20T16:33:00.000Z'),
});

assert.equal(missingModel.status.label, 'Sem dados do Synology');
assert.equal(missingModel.heartbeat.label, 'Sem heartbeat recebido');
assert.equal(missingModel.command.label, 'Nenhum comando pendente');

console.log('synologyStatusViewModel.test.mjs: ok');

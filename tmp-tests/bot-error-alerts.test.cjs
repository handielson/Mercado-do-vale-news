'use strict';
// bot-error-alerts-v1: um alerta por incidente, resumo quando para; workflow de erros manda para a API com fallback direto.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const { createBotErrorAlerts } = require('../services/botErrorAlerts.cjs');
const { patchErrorWorkflow, NAMES, PREPARE, DIRECT } = require('../scripts/n8n-bot-error-alerts.cjs');

const MIN = 60 * 1000;
function setup() {
  let clock = Date.parse('2026-11-11T12:39:00Z');
  const sent = [];
  const alerts = createBotErrorAlerts({ now: () => clock, send: async (number, text) => { sent.push({ number, text }); } });
  return { alerts, sent, tick: (ms) => { clock += ms; } };
}
const failure = (extra = {}) => ({ workflowName: 'Mercado do Vale - Bot WhatsApp Producao', node: 'Nao informado', error: 'timeout exceeded when trying to connect', executionId: '75224', admins: ['5587996246812', '558796246812@s.whatsapp.net'], ...extra });

test('rajada vira um alerta e um resumo', async () => {
  const { alerts, sent, tick } = setup();
  assert.deepEqual(await alerts.report(failure()), { sent: 2, grouped: false, count: 1 });
  assert.match(sent[0].text, /⚠️ Falha no bot do Mercado do Vale[\s\S]*Erro: timeout exceeded[\s\S]*Execução: 75224[\s\S]*aviso o total quando parar/);
  for (let index = 0; index < 19; index += 1) { tick(10 * 1000); await alerts.report(failure({ node: index % 2 ? 'Entrada - Mensagem ou edicao' : 'Nao informado', executionId: String(75225 + index) })); }
  assert.equal(sent.length, 2, '19 falhas iguais (nós diferentes) não geram mensagens novas');
  tick(9 * MIN); assert.equal(await alerts.sweep(), 0, 'ainda dentro dos 10 min');
  tick(2 * MIN); assert.equal(await alerts.sweep(), 2);
  assert.match(sent.at(-1).text, /✅ As falhas do bot pararam: 20 falhas iguais entre 09:39 e 09:42/);
  assert.equal(alerts.snapshot().length, 0);
});

test('falha única não manda resumo; erros diferentes são incidentes separados; lembrete se durar', async () => {
  const { alerts, sent, tick } = setup();
  await alerts.report(failure({ admins: ['5587996246812'] }));
  await alerts.report(failure({ admins: ['5587996246812'], error: 'Evolution respondeu 500' }));
  assert.equal(sent.length, 2);
  tick(11 * MIN); await alerts.sweep();
  assert.equal(sent.length, 2, 'sem resumo para falha única');
  await alerts.report(failure({ admins: ['5587996246812'], executionId: '1' }));
  for (let minute = 0; minute < 31; minute += 1) { tick(MIN); await alerts.report(failure({ admins: ['5587996246812'], executionId: String(minute + 2) })); }
  assert.match(sent.at(-1).text, /⚠️ O bot continua com falhas: 31 desde/, 'lembrete a cada 30 min');
});

test('workflow de erros: API primeiro, alerta direto se a API falhar', () => {
  const base = { nodes: [NAMES.trigger, NAMES.admins, NAMES.prepare, NAMES.send].map((name, index) => ({ id: String(index), name, type: 'x', parameters: { jsCode: 'return []' }, position: [index, 0] })),
    connections: { [NAMES.trigger]: { main: [[{ node: NAMES.admins, type: 'main', index: 0 }]] }, [NAMES.admins]: { main: [[{ node: NAMES.prepare, type: 'main', index: 0 }]] }, [NAMES.prepare]: { main: [[{ node: NAMES.send, type: 'main', index: 0 }]] } } };
  const next = patchErrorWorkflow(base);
  assert.deepEqual(patchErrorWorkflow(next), next, 'idempotente');
  const api = next.nodes.find((node) => node.name === NAMES.api);
  assert.equal(api.onError, 'continueErrorOutput');
  assert.equal(api.parameters.url, 'https://api.xiaomipetrolina.com.br/n8n-bot/error-alerts');
  assert.deepEqual(next.connections[NAMES.prepare].main[0].map((edge) => edge.node), [NAMES.api]);
  assert.deepEqual(next.connections[NAMES.api].main[0], []);
  assert.deepEqual(next.connections[NAMES.api].main[1].map((edge) => edge.node), [NAMES.direct]);
  assert.deepEqual(next.connections[NAMES.direct].main[0].map((edge) => edge.node), [NAMES.send]);
  const failureJson = { execution: { id: '9', lastNodeExecuted: 'Dados', error: { message: 'x' } }, workflow: { name: 'Bot' } };
  const prepared = new Function('$', '$json', PREPARE)(() => ({ first: () => ({ json: failureJson }) }), { adminNumbers: [{ phone: '5587996246812', active: 1 }, { remote_jid: '5587996246812@s.whatsapp.net' }, { phone: '5511', active: 0 }] });
  assert.deepEqual(prepared[0].json.admins, ['5587996246812']);
  const direct = new Function('$', DIRECT)(() => ({ first: () => ({ json: prepared[0].json }) }));
  assert.equal(direct.length, 1);
  assert.match(direct[0].json.text, /alerta direto/);
});

test('API registra as rotas e o deploy leva o módulo', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) assert.match(fs.readFileSync(file, 'utf8'), /require\('\.\/services\/botErrorAlerts\.cjs'\)\.registerBotErrorAlertRoutes\(fastify, \{/);
  assert.match(fs.readFileSync('scripts/deploy-evolution-webhook-relay.cjs', 'utf8'), /services\/botErrorAlerts\.cjs/);
  assert.match(fs.readFileSync('deploy-vps-server-only.cjs', 'utf8'), /Uploaded services\/botErrorAlerts\.cjs/);
});

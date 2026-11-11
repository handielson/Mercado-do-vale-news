'use strict';
// evolution-webhook-relay-v1: recibos de entrega/leitura não chegam ao n8n; mensagens, edições e conexão chegam intactas.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const { shouldRelayEvolutionEvent, registerEvolutionWebhookRelay, N8N_BOT_RELAY_URL } = require('../services/evolutionWebhookRelay.cjs');

const ack = (status) => ({ event: 'messages.update', instance: 'botmercadodovale', data: { keyId: 'X', remoteJid: '1@lid', fromMe: true, status } });

test('decide o que vai para o n8n', () => {
  assert.equal(shouldRelayEvolutionEvent({ event: 'messages.upsert', data: { message: { conversation: 'oi' } } }), true);
  assert.equal(shouldRelayEvolutionEvent({ event: 'connection.update', data: { state: 'open' } }), true);
  for (const status of ['SERVER_ACK', 'DELIVERY_ACK', 'READ', 'PLAYED']) assert.equal(shouldRelayEvolutionEvent(ack(status)), false, status);
  assert.equal(shouldRelayEvolutionEvent({ event: 'MESSAGES_UPDATE', data: { status: 'DELIVERY_ACK' } }), false, 'nome do evento em maiúsculas');
  assert.equal(shouldRelayEvolutionEvent({ event: 'messages.update', data: { status: 'SERVER_ACK', message: { protocolMessage: { editedMessage: { conversation: 'corrigindo: 256GB' } } } } }), true, 'edição do cliente passa');
  assert.equal(shouldRelayEvolutionEvent({ event: 'messages.update', data: { editedMessage: { extendedTextMessage: { text: 'novo texto' } } } }), true);
  assert.equal(shouldRelayEvolutionEvent({ event: 'messages.update', data: { status: 'ALGO_NOVO' } }), true, 'atualização desconhecida passa');
  assert.equal(shouldRelayEvolutionEvent({ event: 'messages.update', data: {} }), true, 'sem status também passa');
});

function fakeFastify() {
  const routes = {};
  return { routes, post: (url, opts, handler) => { routes[`POST ${url}`] = { opts, handler }; }, get: (url, opts, handler) => { routes[`GET ${url}`] = { opts, handler }; } };
}
const reply = () => ({ statusCode: 200, payload: null, code(value) { this.statusCode = value; return this; }, send(value) { this.payload = value; return value; } });

test('rota descarta recibos, repassa o resto e acusa falha do n8n', async () => {
  const fastify = fakeFastify();
  const calls = [];
  let fail = false;
  const stats = registerEvolutionWebhookRelay(fastify, { targetUrl: 'https://n8n.test/webhook/whatsapp', instanceName: 'botmercadodovale', logger: { warn() {} },
    fetchImpl: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: !fail, status: fail ? 500 : 200 }; } });
  const route = fastify.routes['POST /webhooks/evolution/whatsapp'];
  assert.ok(route.opts.bodyLimit >= 32 * 1024 * 1024, 'aceita mídia em base64');

  assert.deepEqual(await route.handler({ body: ack('DELIVERY_ACK') }, reply()), { ok: true, relayed: false });
  assert.equal(calls.length, 0);

  const message = { event: 'messages.upsert', instance: 'botmercadodovale', data: { key: { remoteJid: '5587@s.whatsapp.net' }, message: { conversation: 'Bom dia' } }, apikey: 'k' };
  assert.deepEqual(await route.handler({ body: message }, reply()), { ok: true, relayed: true });
  assert.deepEqual(calls[0], { url: 'https://n8n.test/webhook/whatsapp', body: message }, 'corpo repassado sem mudança');

  const other = reply();
  await route.handler({ body: { ...message, instance: 'outra' } }, other);
  assert.equal(other.statusCode, 403);

  fail = true;
  const failed = reply();
  await route.handler({ body: message }, failed);
  assert.equal(failed.statusCode, 502, 'Evolution vê a falha');
  assert.deepEqual([stats.relayed, stats.dropped, stats.failed, stats.rejected], [1, 1, 1, 1]);
});

test('servidor registra o relay, aceita a URL nova e o deploy seletivo existe', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /registerEvolutionWebhookRelay\(fastify, \{ targetUrl: EXPECTED_N8N_BOT_WEBHOOK_URL, instanceName: N8N_BOT_EVOLUTION_INSTANCE_NAME, guard: requireSyncKey \}\)/, file);
    assert.match(source, /ACCEPTED_N8N_BOT_WEBHOOK_URLS\.includes\(webhook\?\.url\)/, file);
  }
  assert.equal(N8N_BOT_RELAY_URL, 'https://api.xiaomipetrolina.com.br/webhooks/evolution/whatsapp');
  const deploy = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
  assert.match(deploy, /--evolution-webhook-relay-only/);
  assert.match(deploy, /const evolutionWebhookRelayPath = 'services\/evolutionWebhookRelay\.cjs';/);
  const selective = fs.readFileSync('scripts/deploy-evolution-webhook-relay.cjs', 'utf8');
  assert.match(selective, /server\.js em produção não bate com o git/);
});

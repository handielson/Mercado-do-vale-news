'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPrint3dWhatsAppSender } = require('../services/print3dWhatsAppSender.cjs');

const config = { webhookUrl: 'https://n8n-3d.example.test/webhook/verify-phone',
  webhookToken: 'distinct-secret-for-the-3d-n8n-webhook-only', evolutionInstance: 'loja3d',
  senderPhone: '5587999998888', mercadoDoValePhone: '5587999997777' };

test('falha fechada sem n8n 3D configurado ou com instância MDV', async () => {
  const noConfig = createPrint3dWhatsAppSender({});
  assert.equal((await noConfig('5511987654321', 'Código 123456')).ok, false);
  const mdv = createPrint3dWhatsAppSender({ ...config, evolutionInstance: 'botmercadodovale' });
  assert.equal((await mdv('5511987654321', 'Código 123456')).ok, false);
  const sameNumber = createPrint3dWhatsAppSender({ ...config, senderPhone: config.mercadoDoValePhone });
  assert.equal((await sameNumber('5511987654321', 'Código 123456')).ok, false);
});

test('envio usa apenas webhook 3D autenticado e exige confirmação da Evolution', async () => {
  let call;
  const send = createPrint3dWhatsAppSender({ ...config, fetchImpl: async (url, options) => {
    call = { url, options }; return { ok: true, json: async () => ({ ok: true, instance: 'loja3d',
      sender_phone: '5587999998888', message_id: 'wamid.123' }) };
  } });
  assert.equal((await send('5511987654321', '3DMV: código 123456')).ok, true);
  assert.equal(call.url, config.webhookUrl);
  assert.equal(call.options.headers['x-print3d-verification-key'], config.webhookToken);
  assert.deepEqual(JSON.parse(call.options.body), { phone: '5511987654321', text: '3DMV: código 123456',
    purpose: 'print3d_phone_verification' });
  assert.equal(call.options.headers.apikey, undefined);
});

test('HTTP 200 antecipado, instância errada ou falha de rede não confirmam envio', async () => {
  for (const result of [{}, { ok: true, instance: 'botmercadodovale', sender_phone: config.senderPhone, message_id: 'wamid.1' },
    { ok: true, instance: 'loja3d', sender_phone: config.mercadoDoValePhone, message_id: 'wamid.1' },
    { ok: true, instance: 'loja3d', sender_phone: config.senderPhone }]) {
    const send = createPrint3dWhatsAppSender({ ...config, fetchImpl: async () => ({ ok: true, json: async () => result }) });
    assert.equal((await send('5511987654321', '3DMV: código 123456')).ok, false);
  }
  const down = createPrint3dWhatsAppSender({ ...config, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal((await down('5511987654321', '3DMV: código 123456')).ok, false);
});

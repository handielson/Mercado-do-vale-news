const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { patchClassifierMessage, patchParseCode, patchResolverCode, MARKER } = require('./n8n-fix-delivery-intent-priority.cjs');

const parseLive = fs.readFileSync('C:/tmp/parse-classificacao-live.js', 'utf8');
const resolverLive = fs.readFileSync('C:/tmp/resolver-conversation-live.js', 'utf8');
const parsePatched = patchParseCode(parseLive);
const resolverPatched = patchResolverCode(resolverLive);

assert.match(parsePatched, /'entrega_frete'/);
assert.match(parsePatched, new RegExp(MARKER));
assert.match(resolverPatched, new RegExp(MARKER));
assert.match(resolverPatched, /deterministicServiceDecisionV135 \|\| deterministicDeliveryIntentV337/);
const classifierFixture = '- formas_pagamento\n- fallback\n\n- Perguntas sobre Pix, cartao, cartao de credito, cartao de debito, debito, credito, boleto, parcelamento, dinheiro, transferencia, link de pagamento ou usado como entrada: formas_pagamento.\n';
assert.match(patchClassifierMessage(classifierFixture), /- entrega_frete\n/);
assert.match(patchClassifierMessage(classifierFixture), /opcoes de entrega: entrega_frete/);

const detect = (text) => {
  const normalized = String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const delivery = /\b(?:entreg(?:a|as|ar|am|amos|ando|ue|ues)|frete|fretes|envi(?:o|os|ar|am|amos|ando)|motoboy|motoboys|retir(?:ada|adas|ar|am|amos|ando)|delivery)\b/.test(normalized);
  const payment = /\b(?:pix|cartao|credito|debito|boleto|parcelamento|dinheiro|transferencia|pagamento|pagar)\b/.test(normalized);
  return delivery && !payment ? 'consultar_entrega' : 'preservar_outra_rota';
};

assert.equal(detect('Quais são suas opções de entrega?'), 'consultar_entrega');
assert.equal(detect('Vocês entregam em Juazeiro?'), 'consultar_entrega');
assert.equal(detect('Qual o valor do frete?'), 'consultar_entrega');
assert.equal(detect('Posso retirar na loja?'), 'consultar_entrega');
assert.equal(detect('Quais são suas formas de pagamento?'), 'preservar_outra_rota');
assert.equal(detect('Posso pagar no cartão na entrega?'), 'preservar_outra_rota');

new vm.Script(`(function($json, $){${parsePatched}\n})`);
new vm.Script(`(function($json, $getWorkflowStaticData){${resolverPatched}\n})`);
console.log('n8n delivery intent priority regression: ok');

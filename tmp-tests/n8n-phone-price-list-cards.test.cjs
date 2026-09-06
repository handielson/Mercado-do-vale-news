'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildGroups, appendCards, patchWorkflow, CHECK, GENERATE, APPEND } = require('./n8n-add-phone-price-list-cards.cjs');

test('keeps filtered variant IDs, canonical cents and each memory configuration', () => {
  assert.deepEqual(buildGroups([{ name: 'POCO X7', memoryOptions: [
    { productIds: ['blue', 'black', 'blue'], memory: '8GB/256GB', priceCents: 159900 },
    { productIds: ['green'], memory: '12GB/512GB', priceCents: 189900 },
  ] }]), [
    { productIds: ['blue', 'black'], name: 'POCO X7', memory: '8GB/256GB', priceCents: 159900 },
    { productIds: ['green'], name: 'POCO X7', memory: '12GB/512GB', priceCents: 189900 },
  ]);
});
test('invalid prices and unavailable product IDs do not become image requests', () => {
  assert.deepEqual(buildGroups([{name:'A',productIds:[],priceCents:100}, {name:'B',id:'b',priceCents:NaN}, {name:'C',id:'c',priceCents:0}]), []);
});
test('generation success preserves text first, image order, reply and followup context', () => {
  const source = { output: 'Olá[[MSG]]Lista[[BR]]1. POCO', remoteJid: 'customer', phoneCatalogFollowupToken: 'token' };
  const result = appendCards(source, { ok: true, items: [1,2].map(n => ({ mediaType: 'image', mediaUrl: `https://api.xiaomipetrolina.com.br/images/list-${n}.png`, caption: `Página ${n}` })) });
  assert.deepEqual(result.messages.slice(0,2), [{text:'Olá'}, {text:'Lista[[BR]]1. POCO'}]);
  assert.deepEqual(result.messages.slice(2).map(m=>m.caption), ['Página 1','Página 2']);
  assert.equal(result.remoteJid, source.remoteJid);
  assert.equal(result.phoneCatalogFollowupToken, 'token');
  assert.equal(result.phonePriceListCardsStatus, 'ready');
});
test('timeout, 409, malformed and unsafe preview preserve original text without images', () => {
  const source = { output:'Lista original', remoteJid:'customer' };
  for(const response of [{error:'timeout'}, {statusCode:409}, {ok:true,items:[]}, {ok:true,items:[{mediaType:'image',mediaUrl:'https://evil.example/image.png'}]}]) {
    assert.deepEqual(appendCards(source,response), {...source,phonePriceListCardsStatus:'unavailable'});
  }
});

const activePath = path.join(__dirname, '../tmp/phone-price-list-active-workflow.json');
test('patch actual active workflow idempotently, preserving handoff and sequential sender', { skip: !fs.existsSync(activePath) }, () => {
  const before = JSON.parse(fs.readFileSync(activePath));
  const after = patchWorkflow(before);
  assert.deepEqual(patchWorkflow(after), after);
  assert.equal(after.nodes.length, before.nodes.length + 3);
  assert.equal(after.connections['Vendas - Precisa Handoff?'].main[1][0].node, CHECK);
  assert.deepEqual(after.connections['Vendas - Precisa Handoff?'].main[0], before.connections['Vendas - Precisa Handoff?'].main[0]);
  assert.equal(after.connections[GENERATE].main[1][0].node, APPEND);
  for (const name of ['Dividir mensagens', 'Enviar WhatsApp', 'Enviar WhatsApp - Imagem', 'Loop - Enviar mensagens em ordem']) {
    assert.deepEqual(after.nodes.find(n=>n.name===name), before.nodes.find(n=>n.name===name));
    assert.deepEqual(after.connections[name], before.connections[name]);
  }
  const context = after.nodes.find(n=>n.name==='Vendas - Contexto Produtos').parameters.jsCode;
  assert.match(context,/phonePriceListGroups: isCompleteCategoryRequest && prefersSmartphones && products.length > 0/);
});

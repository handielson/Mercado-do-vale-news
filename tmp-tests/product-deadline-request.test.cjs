'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDeadlineRequest, normalizeAdminUpdate, deadlineLabel, buildAdminNotification } = require('../services/productDeadlineRequest.cjs');
const { eligibleProduct } = require('../services/productDeadlineRequestsServer.cjs');

test('prazo vazio vira consulta e prazo informado continua editável', () => {
  assert.equal(deadlineLabel(null), 'Prazo sob consulta');
  assert.equal(deadlineLabel(0), 'Prazo sob consulta');
  assert.equal(deadlineLabel(1), '1 dia útil estimado');
  assert.equal(deadlineLabel(12), '12 dias úteis estimados');
});

test('solicitação pública normaliza contato e não aceita spam ou quantidade inválida', () => {
  const result = normalizeDeadlineRequest('loja_3d', { product_id:'product-1', quantity:100,
    customer_name:' Cliente Teste ', customer_phone:'(87) 99999-9999', customer_email:'TESTE@EXAMPLE.COM', customer_message:' Cor azul ' });
  assert.equal(result.customer_phone, '5587999999999');
  assert.equal(result.customer_email, 'teste@example.com');
  assert.equal(result.quantity, 100);
  assert.throws(() => normalizeDeadlineRequest('loja_3d', { ...result, website:'spam' }), /inválida/);
  assert.throws(() => normalizeDeadlineRequest('loja_3d', { ...result, quantity:0 }), /quantidade/);
});

test('produto precisa aceitar encomenda e estar publicado no site correto', () => {
  const base = { status:'active',is_parent:0,is_print3d:1,print3d_preorder_enabled:1,publication_status:'published',offer_price:1000 };
  assert.equal(eligibleProduct(base,'loja_3d'),true);
  assert.equal(eligibleProduct({...base,is_print3d:0},'loja_3d'),false);
  assert.equal(eligibleProduct({...base,print3d_preorder_enabled:0},'loja_3d'),false);
  assert.equal(eligibleProduct(base,'mercado_do_vale'),true);
});

test('atualização administrativa aceita prazo negociado e mensagem identifica o canal', () => {
  assert.deepEqual(normalizeAdminUpdate({status:'negotiating',negotiated_business_days:20,admin_notes:'Confirmar cor'}),
    {status:'negotiating',negotiated_business_days:20,admin_notes:'Confirmar cor'});
  const message = buildAdminNotification({storefront:'loja_3d',public_code:'PRZ-1234',product_name:'Peça',sku:'P1',quantity:100,
    lead_time_label:'Prazo sob consulta',customer_name:'Cliente',customer_phone:'5587999999999'});
  assert.match(message,/Loja 3D/); assert.match(message,/100/); assert.match(message,/PRZ-1234/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assessNfeCancellation, marketplaceCancellationEvidence, JUSTIFICATION } = require('../services/fiscalCancellationCore.cjs');

const cnpj = '11222333000181';
const accessKey = `262609${cnpj}550010000006991123456780`;
const document = { model: '55', channel: 'shopee', external_sale_id: 'ORDER-1', access_key: accessKey, status: 'authorized' };
const sefaz = { situation: 'authorized', cStat: '100', authorizationProtocol: '126260000000001', authorizedAt: '2026-09-24T10:00:00-03:00' };
const input = marketplace => ({ document, profile: { cnpj, uf:'PE' }, sefaz, marketplace, now: '2026-09-24T11:00:00-03:00' });

test('CANCELLED da Shopee permite avaliação sem atribuir desistência ao comprador', () => {
  const marketplace = marketplaceCancellationEvidence('shopee', { order_sn: 'ORDER-1', order_status: 'CANCELLED', pickup_done_time: 0 }, 'ORDER-1');
  assert.equal(marketplace.cancelled, true);
  assert.equal(marketplace.buyerInitiated, false);
  assert.equal(assessNfeCancellation(input(marketplace)).eligible, true);
  assert.match(JUSTIFICATION, /Pedido cancelado/);
  assert.doesNotMatch(JUSTIFICATION, /cliente/);
});

test('TikTok CANCELLED também é elegível; sinal positivo de envio bloqueia ambos', () => {
  const tiktok = marketplaceCancellationEvidence('tiktok', { id:'12345678', status:'CANCELLED' }, '12345678');
  assert.equal(tiktok.cancelled, true);
  assert.equal(assessNfeCancellation({ ...input(tiktok), document: { ...document, channel:'tiktok' } }).eligible, true);
  for (const [channel, order, id] of [
    ['shopee', { order_sn:'ORDER-1', order_status:'CANCELLED', pickup_done_time:123 }, 'ORDER-1'],
    ['tiktok', { id:'12345678', status:'CANCELLED', shipped_time:123 }, '12345678'],
  ]) {
    const marketplace = marketplaceCancellationEvidence(channel, order, id);
    assert.equal(marketplace.shipped, true);
    assert(assessNfeCancellation({ ...input(marketplace), document: { ...document, channel } }).blockers.includes('shipment_recorded'));
  }
});

test('pedido em aberto com NF-e autorizada gera alerta e não cancela', () => {
  for (const [channel, order, id] of [
    ['shopee', { order_sn:'ORDER-1', order_status:'READY_TO_SHIP' }, 'ORDER-1'],
    ['tiktok', { id:'12345678', status:'AWAITING_SHIPMENT' }, '12345678'],
  ]) {
    const marketplace = marketplaceCancellationEvidence(channel, order, id);
    const assessment = assessNfeCancellation({ ...input(marketplace), document: { ...document, channel } });
    assert.equal(assessment.eligible, false);
    assert.equal(assessment.alert, 'open_order_with_authorized_nfe');
  }
});

test('pedido divergente, devolução e status sem identificação não autorizam evento', () => {
  for (const order of [null, { order_sn:'OTHER', order_status:'CANCELLED' }, { order_sn:'ORDER-1', order_status:'RETURNED' }]) {
    const marketplace = marketplaceCancellationEvidence('shopee', order, 'ORDER-1');
    assert.equal(marketplace.cancelled, false);
    assert.equal(assessNfeCancellation(input(marketplace)).eligible, false);
  }
});

test('protocolo, CNPJ e janela interna de 23 horas permanecem obrigatórios', () => {
  const marketplace = { cancelled:true, shipped:false };
  const base = input(marketplace);
  assert.equal(assessNfeCancellation(base).eligible, true);
  assert(assessNfeCancellation({ ...base, now:'2026-09-25T09:01:00-03:00' }).blockers.includes('internal_23h_window_elapsed'));
  assert(assessNfeCancellation({ ...base, sefaz:{ ...sefaz, authorizationProtocol:'' } }).blockers.includes('authorization_protocol_missing'));
  assert(assessNfeCancellation({ ...base, profile:{ cnpj:'99888777000166', uf:'PE' } }).blockers.includes('issuer_access_key_mismatch'));
  assert(assessNfeCancellation({ ...base, sefaz:{ ...sefaz, situation:'cancelled', cStat:'101' } }).blockers.includes('sefaz_not_authorized'));
});

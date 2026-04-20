import assert from 'node:assert/strict';
import {
  applyPurchaseQueueStatusTransition,
  buildPurchaseQueueClipboardText,
  mergeSalesDigestIntoPurchaseQueue,
} from './purchaseQueueService.js';

const now = new Date('2026-04-19T18:00:00-03:00');

const mergedFresh = mergeSalesDigestIntoPurchaseQueue({
  now,
  existingItems: [],
  summaryRows: [
    {
      model: 'Carregador Turbo USB-C',
      sku: 'CAR-USB-C',
      totalQuantity: 3,
      currentStock: 2,
      lastPurchasePriceCents: 2100,
      lastSalePriceCents: 4500,
      channels: 'Bling + PDV',
    },
  ],
});

assert.equal(mergedFresh.length, 1);
assert.deepEqual(
  {
    model: mergedFresh[0].model,
    sku: mergedFresh[0].sku,
    accumulatedQuantity: mergedFresh[0].accumulated_quantity,
    currentStock: mergedFresh[0].current_stock,
    status: mergedFresh[0].status,
    lastDigestDate: mergedFresh[0].last_digest_date,
    lastDigestQuantity: mergedFresh[0].last_digest_quantity,
    originChannels: mergedFresh[0].origin_channels,
  },
  {
    model: 'Carregador Turbo USB-C',
    sku: 'CAR-USB-C',
    accumulatedQuantity: 3,
    currentStock: 2,
    status: 'pending',
    lastDigestDate: '2026-04-19',
    lastDigestQuantity: 3,
    originChannels: ['Bling', 'PDV'],
  },
);

const mergedSameDay = mergeSalesDigestIntoPurchaseQueue({
  now,
  existingItems: mergedFresh,
  summaryRows: [
    {
      model: 'Carregador Turbo USB-C',
      sku: 'CAR-USB-C',
      totalQuantity: 5,
      currentStock: 1,
      lastPurchasePriceCents: 2200,
      lastSalePriceCents: 4700,
      channels: 'Bling + Shopee',
    },
  ],
});

assert.equal(mergedSameDay.length, 1);
assert.deepEqual(
  {
    accumulatedQuantity: mergedSameDay[0].accumulated_quantity,
    currentStock: mergedSameDay[0].current_stock,
    lastPurchase: mergedSameDay[0].last_purchase_price_cents,
    lastSale: mergedSameDay[0].last_sale_price_cents,
    lastDigestDate: mergedSameDay[0].last_digest_date,
    lastDigestQuantity: mergedSameDay[0].last_digest_quantity,
    originChannels: mergedSameDay[0].origin_channels,
  },
  {
    accumulatedQuantity: 5,
    currentStock: 1,
    lastPurchase: 2200,
    lastSale: 4700,
    lastDigestDate: '2026-04-19',
    lastDigestQuantity: 5,
    originChannels: ['Bling', 'PDV', 'Shopee'],
  },
);

const reopenedPurchased = mergeSalesDigestIntoPurchaseQueue({
  now: new Date('2026-04-20T09:00:00-03:00'),
  existingItems: [
    {
      ...mergedSameDay[0],
      status: 'purchased',
      reason: '',
      accumulated_quantity: 0,
      last_digest_date: '2026-04-19',
      last_digest_quantity: 5,
    },
  ],
  summaryRows: [
    {
      model: 'Carregador Turbo USB-C',
      sku: 'CAR-USB-C',
      totalQuantity: 2,
      currentStock: 0,
      lastPurchasePriceCents: 2200,
      lastSalePriceCents: 4700,
      channels: 'Shopee',
    },
  ],
});

assert.equal(reopenedPurchased[0].status, 'pending');
assert.equal(reopenedPurchased[0].accumulated_quantity, 2);

assert.throws(
  () => applyPurchaseQueueStatusTransition(mergedSameDay[0], { status: 'removed', reason: '' }),
  /motivo/i,
);

const removed = applyPurchaseQueueStatusTransition(mergedSameDay[0], {
  status: 'removed',
  reason: 'Fornecedor sem estoque',
  now,
});

assert.equal(removed.status, 'removed');
assert.equal(removed.reason, 'Fornecedor sem estoque');

const reopened = applyPurchaseQueueStatusTransition(removed, {
  status: 'pending',
  reason: '',
  now,
});

assert.equal(reopened.status, 'pending');
assert.equal(reopened.reason, '');

const clipboardText = buildPurchaseQueueClipboardText([
  reopened,
  {
    ...reopened,
    model: 'Pelicula iPhone 13',
    sku: 'PEL-IP13',
    accumulated_quantity: 4,
    current_stock: 8,
    last_purchase_price_cents: 900,
    last_sale_price_cents: 2500,
    origin_channels: ['Shopee'],
    status: 'not_purchased',
    reason: 'Sem fornecedor hoje',
  },
]);

assert.match(clipboardText, /LISTA DE COMPRA/i);
assert.match(clipboardText, /CAR-USB-C/);
assert.match(clipboardText, /PEL-IP13/);
assert.match(clipboardText, /Sem fornecedor hoje/);

console.log('purchaseQueueService.test.mjs: ok');

import assert from 'node:assert/strict';
import test from 'node:test';
import { scanShopeeCatalogLinks } from '../services/shopeeCatalogLinkScanner.ts';

test('scan links item and every variation by SKU in the selected account', () => {
  const result = scanShopeeCatalogLinks({
    connectionId: 'store-g',
    scannedAt: '2026-09-29T00:00:00.000Z',
    localProducts: [
      { id: 'parent', sku: 'OIS063' },
      { id: 'white', sku: 'OIS063B' },
      { id: 'black', sku: 'OIS063P' },
    ],
    existingLinks: [{ product_id: 'parent', connection_id: 'primary', shopee_item_id: 10 }],
    remoteItems: [{
      item_id: 58269230038,
      item_sku: 'OIS063',
      category_id: 100279,
      price_info: [{ original_price: 25 }],
      models: [
        { model_id: 101, model_sku: 'OIS063B', model_name: 'Branco', tier_index: [0], price_info: [{ original_price: 25 }] },
        { model_id: 102, model_sku: 'OIS063P', model_name: 'Preto', tier_index: [1], price_info: [{ original_price: 25 }] },
      ],
    }],
  });

  assert.deepEqual(result.discoveries.map(link => link.product_id).sort(), ['black', 'parent', 'white']);
  assert.ok(result.discoveries.every(link => link.connection_id === 'store-g'));
  assert.ok(result.discoveries.every(link => link.already_linked === false), 'a link in M must not block discovery in G');
  assert.equal(result.discoveries.find(link => link.product_id === 'white')?.shopee_model_id, 101);
  assert.equal(result.unmatchedRemoteItems.length, 0);
});

test('scan refuses ambiguous compact SKU matches', () => {
  const result = scanShopeeCatalogLinks({
    connectionId: 'primary',
    localProducts: [{ id: 'a', sku: 'AB-12' }, { id: 'b', sku: 'AB12' }],
    existingLinks: [],
    remoteItems: [{ item_id: 99, item_sku: 'AB 12', item_name: 'Ambiguous' }],
  });

  assert.equal(result.discoveries.length, 0);
  assert.equal(result.unmatchedRemoteItems.length, 1);
});

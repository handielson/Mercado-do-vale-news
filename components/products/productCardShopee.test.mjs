import assert from 'node:assert/strict';
import {
  buildShopeeProductUrl,
  getShopeeButtonVisualState,
  mapProductToShopeeLocalProduct,
  validateShopeeItemForProduct,
} from './productCardShopee.js';

const syncedState = getShopeeButtonVisualState({ shopee_item_id: 987654321 });
assert.equal(syncedState.isSynced, true);
assert.equal(syncedState.itemId, 987654321);
assert.match(syncedState.title, /Shopee/i);

const pendingState = getShopeeButtonVisualState({ shopee_item_id: null });
assert.equal(pendingState.isSynced, false);
assert.equal(pendingState.itemId, null);

assert.equal(
  buildShopeeProductUrl('12345', 987654321),
  'https://shopee.com.br/product/12345/987654321',
);
assert.equal(buildShopeeProductUrl('', 987654321), null);
assert.equal(buildShopeeProductUrl('12345', null), null);

assert.deepEqual(
  validateShopeeItemForProduct({ sku: 'CTR3' }, { item_sku: 'CBX-U2AMAF30' }),
  {
    isMatch: false,
    reason: 'SKU local CTR3 difere do SKU Shopee CBX-U2AMAF30',
  },
);
assert.deepEqual(
  validateShopeeItemForProduct({ sku: 'CTR3' }, { item_sku: 'ctr3' }),
  { isMatch: true, reason: null },
);
assert.deepEqual(
  validateShopeeItemForProduct({ sku: 'CTR3' }, { item_sku: '' }),
  { isMatch: true, reason: null },
);

const mapped = mapProductToShopeeLocalProduct({
  id: 'prod-1',
  name: 'Produto Teste',
  sku: 'SKU-1',
  images: ['https://cdn/image-1.png', '', null],
  price_retail: 15990,
  price_cost: 8900,
  description: 'Descricao',
  brand: 'Marca',
  bling_id: 123,
  video_url: 'https://cdn/video.mp4',
  stock_quantity: 3,
  track_inventory: true,
  category_id: 'cat-10',
  category_name: 'Fonte de Alimentacao',
  model: 'MSG-H3500WR120',
  model_name: 'MSG-H3500WR120',
  eans: ['789', '', null],
  weight_kg: 0.4,
  shipping_weight: 400,
  shipping_length: 18,
  shipping_width: 9,
  shipping_height: 4,
  dimensions: { width_cm: 9, height_cm: 4, depth_cm: 18 },
  ncm: '12345678',
  specs: { inmetro_certificate: 'CERT-1' },
});

assert.deepEqual(mapped, {
  id: 'prod-1',
  name: 'Produto Teste',
  sku: 'SKU-1',
  images: ['https://cdn/image-1.png'],
  price_retail: 15990,
  price_cost: 8900,
  category_slug: '',
  inmetro_certificate: 'CERT-1',
  ncm: '12345678',
  description: 'Descricao',
  brand: 'Marca',
  bling_id: 123,
  video_url: 'https://cdn/video.mp4',
  stock_quantity: 3,
  track_inventory: true,
  category_id: 'cat-10',
  category_name: 'Fonte de Alimentacao',
  model: 'MSG-H3500WR120',
  model_name: 'MSG-H3500WR120',
  specs: { inmetro_certificate: 'CERT-1' },
  eans: ['789'],
  weight_kg: 0.4,
  shipping_weight: 400,
  shipping_length: 18,
  shipping_width: 9,
  shipping_height: 4,
  dimensions: { width_cm: 9, height_cm: 4, depth_cm: 18 },
  model_id: null,
});

console.log('productCardShopee.test.mjs: ok');

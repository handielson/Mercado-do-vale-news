import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { productImageList, resolveProductFamilyImages } from '../services/productFamilyImages.js';
const require = createRequire(import.meta.url);
const { projectStorefrontProduct } = require('../services/productStorefrontOffer.cjs');
const { registerProductStorefrontOfferRoutes } = require('../services/productStorefrontOffersServer.cjs');
const child = (id, images = [], extra = {}) => ({ id, parent_id: 'family', model_id: 'shared-model', name: 'Vaso', images, ...extra });

test('capa do pai e fotos próprias das cores ficam separadas, sem mutações', () => {
  const red = child('a', ['red.jpg'], { parent_images: ['all-colors.jpg'] });
  const blue = child('b', ['blue.jpg', 'blue-back.jpg'], { parent_images: ['all-colors.jpg'] });
  const family = [blue, red];
  const snapshot = JSON.stringify(family);
  assert.deepEqual(resolveProductFamilyImages(blue, family), ['all-colors.jpg']);
  assert.deepEqual(resolveProductFamilyImages(blue, family, true), ['blue.jpg', 'blue-back.jpg']);
  assert.deepEqual(resolveProductFamilyImages(red, family, true), ['red.jpg']);
  assert.equal(JSON.stringify(family), snapshot);
});

test('famílias antigas usam primeira foto disponível de forma estável, sem cruzar pais', () => {
  const blank = child('0'); const red = child('a', ['red.jpg']); const blue = child('b', ['blue.jpg']);
  const foreign = child('-1', ['wrong.jpg'], { parent_id: 'another-family' });
  assert.deepEqual(resolveProductFamilyImages(blank, [foreign, blue, red]), ['red.jpg']);
  assert.deepEqual(resolveProductFamilyImages(blue, [red, blank]), ['red.jpg']);
  assert.deepEqual(resolveProductFamilyImages(blue, [red, blank], true), ['blue.jpg']);
  assert.deepEqual(resolveProductFamilyImages(blank, [foreign, blue, red], true), ['red.jpg']);
  assert.deepEqual(resolveProductFamilyImages(blank, [foreign]), []);
});

test('adicionar/remover foto do pai troca a capa e não modifica nenhuma variação', () => {
  const blue = child('b', ['blue.jpg']); const blank = child('a');
  assert.deepEqual(resolveProductFamilyImages(blank, [blue]), ['blue.jpg']);
  const updated = { ...blank, parent_images: ['new-cover.jpg'] };
  assert.deepEqual(resolveProductFamilyImages(updated, [blue]), ['new-cover.jpg']);
  assert.deepEqual(resolveProductFamilyImages(updated, [blue], true), ['new-cover.jpg']);
  assert.deepEqual(resolveProductFamilyImages(blue, [updated], true), ['blue.jpg']);
  assert.deepEqual(blue.images, ['blue.jpg']); assert.deepEqual(blank.images, []);
});

test('herança explícita usa foto atual do pai; JSON, image_url e dados antigos são aceitos', () => {
  assert.deepEqual(resolveProductFamilyImages(child('a', ['old-copy.jpg'], {
    parent_images: '["current-parent.jpg"]', specs: '{"_inherit_parent_images":true}'
  }), [], true), ['current-parent.jpg']);
  assert.deepEqual(productImageList('[null,"","photo.jpg","photo.jpg"]', 'cover.jpg'), ['photo.jpg', 'cover.jpg']);
  assert.deepEqual(resolveProductFamilyImages({ id: 'solo', name: 'Solo', image_url: 'solo.jpg' }), ['solo.jpg']);
});

test('projeções dos dois sites transportam foto do pai sem substituir imagens do filho', () => {
  for (const storefront of ['mercado_do_vale', 'loja_3d']) {
    const row = child('a', ['child.jpg'], { status: 'active', parent_images: ['parent.jpg'] });
    const result = projectStorefrontProduct(row, { storefront, publication_status: 'published', price_retail: 500 });
    assert.deepEqual(result.parent_images, ['parent.jpg']); assert.deepEqual(result.images, ['child.jpg']);
    assert.equal(projectStorefrontProduct({ ...row, is_parent: true }, { publication_status: 'published', price_retail: 500 }), null);
  }
});

test('rotas reais de catálogo completo/compacto e detalhe retornam a mídia familiar', async () => {
  const handlers = new Map(); const queries = [];
  const row = child('a', '["child.jpg"]', { status: 'active', product_id: 'a', publication_status: 'published',
    price_retail: 500, parent_images: '["parent.jpg"]' });
  registerProductStorefrontOfferRoutes({ get: (url, ...args) => handlers.set(url, args.at(-1)), post() {}, put() {} }, {
    pool: { query: async sql => { queries.push(sql); return [[row]]; } }, requireSyncKeyOrAdmin() {}
  });
  const reply = { header() {}, code() { return this; }, send(value) { return value; } };
  for (const storefront of ['mercado_do_vale', 'loja_3d']) {
    for (const compact of ['true', 'false']) {
      const result = await handlers.get('/storefronts/:storefront/products')({ params: { storefront }, query: { compact } }, reply);
      assert.deepEqual(result[0].images, ['child.jpg']); assert.deepEqual(result[0].parent_images, ['parent.jpg']);
      assert.match(queries.at(-1), /AS parent_images/);
      if (compact === 'true') assert.match(queries.at(-1), /JSON_EXTRACT\(pp.images/);
    }
    const detail = await handlers.get('/storefronts/:storefront/products/:productId')({ params: { storefront, productId: 'a' }, query: {} }, reply);
    assert.deepEqual(detail.parent_images, ['parent.jpg']);
  }
});

test('os dois sites conectam a mesma regra à capa e à seleção de cor', () => {
  const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  assert.match(source('pages/store/Print3dStorePage.tsx'), /<ProductImage product=\{product\} family=\{family\}/);
  assert.match(source('pages/store/Print3dProductPage.tsx'), /resolveProductFamilyImages\(product, variants, Boolean\(requestedVariant\)\)/);
  assert.match(source('components/catalog/ModernProductCard.tsx'), /resolveProductFamilyImages\(currentProduct, family, userInteractedWithColor && currentColorIndex >= 0\)/);
  assert.match(source('components/catalog/ModernProductCard.tsx'), /const currentImage = !userInteractedWithColor \|\| currentColorIndex === -1/);
  assert.match(source('pages/store/PublicProductPage.tsx'), /resolveProductFamilyImages\(product, siblings, variationImageSelected\)/);
  assert.match(source('pages/store/PublicProductPage.tsx'), /galleryImages\.map/);
  assert.match(source('utils/print3dStorefront.ts'), /product.parent_id \? `family:\$\{product.parent_id\}`/);
  assert.match(source('vps_server.cjs'), /AS parent_images/);
  assert.match(source('vps_server.cjs'), /productFamilyNameSelectSql\('products', true\)/);
});

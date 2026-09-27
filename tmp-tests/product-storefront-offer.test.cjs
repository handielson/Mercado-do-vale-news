const test = require('node:test');
const assert = require('node:assert/strict');
const { validateStorefrontOffer, projectStorefrontProduct } = require('../services/productStorefrontOffer.cjs');

test('preços e publicação são independentes por site, com mesmo estoque e mídia', () => {
  const shared = { id: 'p1', sku: 'SKU-1', name: 'Produto', status: 'active', stock_quantity: 3,
    images: ['foto.webp'], specs: { cor: 'Azul' }, category_name: 'Acessórios',
    blueprint_image_url: 'desenho.webp', warranty_type: 'brand', warranty_template_id: 'garantia-1',
    model_template_values: { nfc: 'Sim' } };
  const mdv = projectStorefrontProduct(shared, { storefront: 'mercado_do_vale', publication_status: 'published', title: 'Nome MDV', category_label: 'Presentes', price_retail: 5000 });
  const site3d = projectStorefrontProduct(shared, { storefront: 'loja_3d', publication_status: 'published', title: 'Nome 3D', category_label: 'Personalizados', meta_title: 'Título 3D', price_retail: 6500 });
  assert.equal(mdv.price_retail, 5000);
  assert.equal(site3d.price_retail, 6500);
  assert.equal(mdv.stock_quantity, site3d.stock_quantity);
  assert.deepEqual(mdv.images, site3d.images);
  assert.deepEqual(mdv.specs, site3d.specs);
  assert.equal(mdv.blueprint_image_url, 'desenho.webp');
  assert.equal(mdv.warranty_template_id, 'garantia-1');
  assert.deepEqual(mdv.model_template_values, { nfc: 'Sim' });
  assert.equal(mdv.hide_from_catalog, false);
  assert.equal(mdv.storefront_category, 'Presentes');
  assert.equal(site3d.storefront_category, 'Personalizados');
  assert.equal(site3d.meta_title, 'Título 3D');
  assert.equal(projectStorefrontProduct(shared, { storefront: 'loja_3d', publication_status: 'draft', price_retail: 6500 }), null);
});

test('publicação exige preço em centavos positivo e não altera a ficha compartilhada', () => {
  assert.throws(() => validateStorefrontOffer('loja_3d', { publication_status: 'published', price_retail: 0 }), /maior que zero/);
  assert.throws(() => validateStorefrontOffer('loja_3d', { publication_status: 'published', price_retail: 49.9, category_label: 'Decoração' }), /inteiro em centavos/);
  assert.throws(() => validateStorefrontOffer('loja_3d', { publication_status: 'published', price_retail: 4900 }), /categoria deste site/);
  assert.throws(() => validateStorefrontOffer('outro', { publication_status: 'draft' }), /Site desconhecido/);
  const offer = validateStorefrontOffer('loja_3d', { publication_status: 'published', title: 'Vaso', category_label: 'Decoração', price_retail: 4900 });
  assert.equal(offer.price_retail, 4900);
  assert.equal(offer.category_label, 'Decoração');
  assert.equal(validateStorefrontOffer('loja_3d', { publication_status: 'draft' }).category_label, null);
  assert.equal(Object.hasOwn(offer, 'stock_quantity'), false);
});

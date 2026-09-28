import test from 'node:test';
import assert from 'node:assert/strict';
import { fillStorefrontOfferFromProduct, htmlToPlainText } from '../utils/storefrontOfferDefaults.mjs';

const central = {
  name: 'Suporte de antena', description: 'Descrição central', category_name: 'Suportes', slug: 'suporte-antena',
  price_retail: 4990, price_reseller: 4500, price_wholesale: 4000, price_promo: 4690,
  meta_title: 'Suporte para antena', meta_description: 'Meta central',
};

test('nova oferta recebe todos os dados disponíveis do cadastro central', () => {
  assert.deepEqual(fillStorefrontOfferFromProduct('loja_3d', null, central), {
    storefront: 'loja_3d', publication_status: 'draft', title: 'Suporte de antena', description: 'Descrição central',
    category_label: 'Suportes', slug: 'suporte-antena', price_retail: 4990, price_reseller: 4500,
    price_wholesale: 4000, price_promo: 4690, meta_title: 'Suporte para antena', meta_description: 'Meta central',
  });
});

test('dados já personalizados no site não são substituídos pelo cadastro central', () => {
  const result = fillStorefrontOfferFromProduct('loja_3d', {
    publication_status: 'published', title: 'Nome exclusivo 3D', description: 'Texto exclusivo',
    category_label: 'Impressão 3D', slug: null, price_retail: 6500, price_reseller: null,
    price_wholesale: null, price_promo: null, meta_title: null, meta_description: null,
  }, central);
  assert.equal(result.title, 'Nome exclusivo 3D');
  assert.equal(result.description, 'Texto exclusivo');
  assert.equal(result.category_label, 'Impressão 3D');
  assert.equal(result.price_retail, 6500);
  assert.equal(result.slug, 'suporte-antena');
  assert.equal(result.price_reseller, 4500);
});

test('HTML becomes a clean search description', () => {
  const description = '<h2>Suporte KU</h2><p>Peca <strong>resistente</strong> &amp; leve.</p><ul><li>Facil instalacao</li></ul>';
  const result = fillStorefrontOfferFromProduct('loja_3d', null, {
    ...central,
    meta_description: null,
    description,
  });
  assert.equal(result.description, description);
  assert.equal(result.meta_description, 'Suporte KU Peca resistente & leve. Facil instalacao');
});

test('search description is limited to 160 characters without a trailing space', () => {
  const result = htmlToPlainText(`<p>${'produto '.repeat(30)}</p>`, 160);
  assert.ok(result.length <= 160);
  assert.equal(result.endsWith(' '), false);
});

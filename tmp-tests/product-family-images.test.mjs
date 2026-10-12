import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { productImageList, resolveProductFamilyImages } from '../services/productFamilyImages.js';
const require = createRequire(import.meta.url);
const { projectStorefrontProduct } = require('../services/productStorefrontOffer.cjs');
const { registerProductStorefrontOfferRoutes } = require('../services/productStorefrontOffersServer.cjs');
const child = (id, images = [], extra = {}) => ({ id, parent_id: 'family', model_id: 'shared-model', name: 'Vaso', images, ...extra });

function parentProductService(api) {
  const source = readFileSync(new URL('../services/products.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, console, URL, setTimeout: callback => { callback(); }, require: name => {
    if (name === './vpsApiService') return { vpsApiService: api };
    if (name === './productFamilyImages.js') return { productImageList };
    if (name === '../utils/field-standards') return { ProductStatus: { ACTIVE: 'active' } };
    return {};
  } });
  return exports.productService;
}

test('model photos resolve direct and child-linked parents by IDs and fetch their complete galleries', async () => {
  const fetched = [];
  const service = parentProductService({
    getProducts: async params => {
      assert.equal(params.model_id, 'm');
      assert.equal(params.status, 'all');
      assert.equal(params.compact, true);
      return [
        { id: 'direct', model_id: 'm', is_parent: 1 },
        { id: 'child', model_id: 'm', parent_id: 'linked' },
        { id: 'child2', model_id: 'm', parent_id: 'linked' },
        { id: 'unrelated', model_id: 'other', is_parent: 1 },
      ];
    },
    getProductById: async (id, fresh) => {
      assert.equal(fresh, true);
      fetched.push(id);
      return { id, is_parent: id === 'linked' ? 0 : 1, name: id, images: '["cover.jpg","back.jpg"]', image_url: 'cover.jpg' };
    },
  });
  const parents = await service.listParentsByModel('m');
  assert.deepEqual(fetched.sort(), ['direct', 'linked']);
  assert.equal(parents.length, 2);
  assert.deepEqual(parents[0].images, ['cover.jpg', 'back.jpg']);
});

test('model parent gallery paginates and treats lookup failures as errors, not absence of parents', async () => {
  const offsets = [];
  const service = parentProductService({
    getProducts: async params => {
      offsets.push(params.offset);
      return params.offset === 0 ? Array(500).fill({ model_id: 'm' }) : [{ id: 'p', model_id: 'm', is_parent: 1 }];
    },
    getProductById: async () => ({ id: 'p', name: 'Pai', is_parent: 1, images: [] }),
  });
  assert.equal((await service.listParentsByModel('m')).length, 1);
  assert.deepEqual(offsets, [0, 500]);
  await assert.rejects(parentProductService({ getProducts: async () => null }).listParentsByModel('m'), /consultar/);
  await assert.rejects(parentProductService({ getProducts: async () => [{ id: 'p', model_id: 'm', is_parent: 1 }], getProductById: async () => null }).listParentsByModel('m'), /cadastro do pai/);
});

test('model parent lookup retries a transient failure once and never treats failed reads as empty galleries', async () => {
  let lists=0, details=0;
  const service=parentProductService({
    getProducts:async()=> ++lists === 1 ? null : [{id:'p',model_id:'m',is_parent:1}],
    getProductById:async()=> ++details === 1 ? null : {id:'p',name:'Pai',is_parent:1,images:['cover.jpg']},
  });
  assert.equal((await service.listParentsByModel('m'))[0].images[0],'cover.jpg');
  assert.equal(lists,2); assert.equal(details,2);
  let failures=0;
  await assert.rejects(parentProductService({getProducts:async()=>{failures++;return null;}}).listParentsByModel('m'),/consultar/);
  assert.equal(failures,2);
});

test('model media editor shows canonical cover, five photo limit, one video and all parent choices', () => {
  const source = readFileSync(new URL('../components/settings/ModelParentImages.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const exports = {};
  const values = [[{ id: 'p', name: 'Pai', sku: 'P', images: ['cover.jpg', 'back.jpg'], video_url: 'https://video.test/p.mp4' }, { id: 'p2', name: 'Outro pai', images: [] }], 'p', false, '', 0, ['cover.jpg', 'back.jpg'], 'https://video.test/p.mp4', null, false, '', true];
  const gallery = {};
  const galleryCode = ts.transpileModule(readFileSync('components/products/sections/ProductImages.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(galleryCode, { exports: gallery, require: name => name === 'react' ? React : name.includes('cache-buster') ? { getCacheBustedUrl: url => url } : require(name) });
  let state = 0;
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'react') return { ...React, useState: () => [values[state++], () => {}], useEffect: () => {} };
    if (name === '../../services/products') return { productService: {} };
    if (name === '../products/sections/ProductImages') return gallery;
    if (name === '../../services/productImageUpload' || name === '../../services/productVideoUpload') return {};
    if (name === '../../services/localCatalogPreview') return { isLocalCatalogPreviewRuntime: () => true };
    if (name === '../../utils/media-url') return { toBrowserSafeMediaUrl: url => url };
    return require(name);
  } });
  const html = renderToStaticMarkup(React.createElement(exports.ModelParentImages, { modelId: 'm' }));
  assert.match(html, /CAPA/);
  assert.match(html, /cover.jpg/);
  assert.match(html, /back.jpg/);
  assert.match(html, /Outro pai/);
  assert.doesNotMatch(html, /Abrir cadastro do pai|href="\/admin\/products\/p"|target="_blank"/);
  assert.match(html, /type="file"/);
  assert.match(html, /Vídeo do pai \(1 vídeo\)/);
  assert.match(html, /Salvar mídias do pai/);
  assert.match(html, /2 \/ 5 imagens/);
  assert.match(html, /https:\/\/video.test\/p.mp4/);
  const modal = readFileSync(new URL('../components/settings/ModelModal.tsx', import.meta.url), 'utf8');
  assert.match(modal, /<ModelParentImages[\s\S]*<ColorImageManager/);
});

test('parent media saves only images/video on the linked parent, preserves child and prices', async () => {
  const writes = [];
  const service = parentProductService({
    getProducts: async () => [{ id: 'c', model_id: 'm', parent_id: 'p' }],
    getProductById: async () => ({ id: 'p', name: 'Pai', sku: 'P', is_parent: 0, images: ['old.jpg'], price_retail: 99900 }),
    updateProductMedia: async (id, payload) => { writes.push({ id, payload: JSON.parse(JSON.stringify(payload)) }); return true; },
  });
  const saved = await service.saveParentMedia('m', 'p', {images: ['a.jpg','b.jpg','c.jpg','d.jpg','e.jpg'],video_url:'https://video.test/p.mp4'});
  assert.equal(saved.price_retail,99900);
  assert.deepEqual(writes,[{id:'p',payload:{images:['a.jpg','b.jpg','c.jpg','d.jpg','e.jpg'],video_url:'https://video.test/p.mp4'}}]);
  await service.saveParentMedia('m','p',{images:[],video_url:null});
  assert.deepEqual(writes[1].payload,{images:[],video_url:null});
  await assert.rejects(service.saveParentMedia('m','p',{images:Array(6).fill('x.jpg'),video_url:null}),/5 fotos/);
  await assert.rejects(service.saveParentMedia('m','p',{images:[],video_url:'javascript:alert(1)'}),/link público/);
  await assert.rejects(service.saveParentMedia('m','c',{images:[],video_url:null}),/vinculado/);
  assert.equal(writes.length,2);
  await assert.rejects(parentProductService({getProducts:async()=>[{id:'p',model_id:'m',is_parent:1}],getProductById:async()=>({id:'p',name:'Pai',is_parent:1}),updateProductMedia:async()=>false}).saveParentMedia('m','p',{images:[],video_url:null}),/salvar/);
});

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
  assert.match(source('components/catalog/ModernProductCard.tsx'), /resolveProductFamilyImages\(currentProduct, family, currentColorIndex >= 0\)/);
  assert.match(source('components/catalog/ModernProductCard.tsx'), /const currentImage = currentColorIndex === -1/);
  assert.match(source('components/catalog/ModernProductCard.tsx'), /useState<number>\(-1\)/);
  assert.match(source('components/catalog/ModernProductCard.tsx'), /setCurrentColorIndex\(isSelectedColor \? -1 : color.origIdx\)/);
  assert.match(source('components/catalog/ModernProductCard.tsx'), /aria-pressed=\{isSelectedColor\}/);
  assert.doesNotMatch(source('components/catalog/ModernProductCard.tsx'), /Cor: <span className="font-semibold"/);
  assert.match(source('pages/store/PublicProductPage.tsx'), /resolveProductFamilyImages\(product, siblings, variationImageSelected\)/);
  assert.match(source('pages/store/PublicProductPage.tsx'), /galleryImages\.map/);
  assert.match(source('pages/store/PublicProductPage.tsx'), /setSelectedVariantId\(String\(data\.id\)\);\s*setVariationImageSelected\(Number\(data\.is_parent\) !== 1\)/);
  assert.match(source('pages/store/PublicProductPage.tsx'), /resolveProductFamilyImages\(displayProduct, \[\], Number\(data\.is_parent\) !== 1\)/);
  assert.match(source('utils/print3dStorefront.ts'), /product.parent_id \? `family:\$\{product.parent_id\}`/);
  assert.match(source('vps_server.cjs'), /AS parent_images/);
  assert.match(source('vps_server.cjs'), /productFamilyNameSelectSql\('products', true\)/);
});

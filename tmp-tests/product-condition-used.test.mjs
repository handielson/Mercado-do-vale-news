// product-condition-v1: Novo / Seminovo / Usado / Caixa aberta + observação (specs.condition_note) no cadastro, site, admin e Meta.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as condition from '../utils/productCondition.js';
import { productUnitCondition } from '../components/products/familyRegistration.js';

const read = (file) => fs.readFileSync(file, 'utf8');

test('peças e cadastro gravam seminovo separado de usado', () => {
  assert.equal(productUnitCondition({ condition: 'seminovo' }), 'seminovo');
  assert.equal(productUnitCondition({ condicao: 'usado' }), 'used');
  assert.equal(productUnitCondition({}), 'new');
});

test('selo e observação: nada para novo; rótulo e texto para seminovo/usado', () => {
  const out = ts.transpileModule(read('components/catalog/ProductConditionBadge.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, React, require: (id) => (id.endsWith('productCondition.js') ? condition : id === 'react' ? React : (() => { throw new Error(id); })()) });
  const render = (Comp, product) => renderToStaticMarkup(React.createElement(Comp, { product }));
  assert.equal(render(exports.ProductConditionBadge, { specs: { condition: 'new' } }), '');
  assert.match(render(exports.ProductConditionBadge, { specs: { condition: 'seminovo' } }), />Seminovo</);
  assert.match(render(exports.ProductConditionBadge, { specs: '{"condition":"used"}' }), />Usado</);
  assert.match(render(exports.ProductConditionNote, { specs: { condition: 'used', condition_note: 'Trocado a placa principal pela assistência autorizada' } }), /Usado:.*Trocado a placa principal/);
  assert.equal(render(exports.ProductConditionNote, { specs: { condition: 'new', condition_note: 'x' } }), '');
});

test('cadastro: as quatro opções e o campo de observação', () => {
  for (const file of ['components/products/ProductForm.tsx', 'components/products/VariationListing.tsx']) {
    const src = read(file);
    assert.match(src, /PRODUCT_CONDITIONS\.map\(option => <option key=\{option\.value\} value=\{option\.value\}>/, `${file}: opções vêm do módulo único`);
    assert.match(src, /aria-label="Observação da condição"/, `${file}: campo de observação`);
    assert.match(src, /condition_note/, `${file}: grava em specs.condition_note`);
    assert.doesNotMatch(src, /<option value="used">Usado<\/option>/, `${file}: sem lista de opções fixa duplicada`);
  }
  // Aparelhos entram pela Entrada (o UnitForm saiu na etapa 6): a condição dela também separa seminovo de usado.
  assert.match(read('components/entrada/ManualEntryTab.tsx'), /\{ value: 'seminovo', label: 'Seminovo' \},\s*\{ value: 'used', label: 'Usado' \}/);
});

test('site e admin mostram o selo; página do produto mostra a observação', () => {
  assert.match(read('components/catalog/ModernProductCard.tsx'), /<ProductConditionBadge product=\{productForDisplay\}/);
  const pdp = read('pages/store/PublicProductPage.tsx');
  assert.match(pdp, /<ProductConditionBadge product=\{product\}/);
  assert.match(pdp, /<ProductConditionNote product=\{product\}/);
  assert.match(read('components/products/ProductCard.tsx'), /<ProductConditionBadge product=\{product\} \/>/);
  assert.match(read('components/products/ProductList.tsx'), /<ProductConditionBadge product=\{product\} \/>/);
  assert.match(read('pages/admin/products/ModelProductAggregatorPage.tsx'), /<ProductConditionBadge product=/);
  assert.match(read('services/productGrouping.ts'), /condition === 'new' \? key : `\$\{key\}\|condition:\$\{condition\}`/);
});

test('Meta: seminovo/usado/caixa aberta nunca vão como "new"', () => {
  assert.match(read('services/metaCatalogFeedServer.cjs'), /\['used', 'usado', 'seminovo', 'semi-novo', 'semi novo', 'open_box'\]\.includes\(/);
});

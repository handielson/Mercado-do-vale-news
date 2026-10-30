import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPublicProductName } from '../pages/store/publicProductName.js';
import { getCatalogCardDisplayName } from '../components/catalog/modernProductCardState.js';
import { getCatalogFamilyName } from '../services/productGroupingCore.js';

const parentName = 'POCO X8 Pro 5G';
const variants = [
  { name: 'Poco X8 Pró Preto', specs: { color: 'Preto', ram: '8GB', storage: '256GB' } },
  { name: 'Poco X8 Pró 5G, NFC, 256GB, 8GB Ram, Global Cor:Verde', specs: { color: 'Verde', ram: '8GB', storage: '256GB' } },
  { name: 'Poco X8 Pró Branco 12GB/512GB', specs: { color: 'Branco', ram: '12GB', storage: '512GB' } },
];
for (const variant of variants) {
  const child = { ...variant, parent_id: 'family', parent_name: parentName };
  assert.equal(getPublicProductName(child), parentName);
  assert.equal(getCatalogCardDisplayName({ product: child, productGroup: {model: 'Nome divergente'} }), parentName);
  assert.equal(getCatalogFamilyName(child), parentName);
  assert.deepEqual(child.specs, variant.specs);
  assert.equal(getPublicProductName({...child,parent_name:'POCO X8 Pro atualizado'}),'POCO X8 Pro atualizado');
}
assert.equal(getCatalogFamilyName({parent_name:parentName}), '');
assert.equal(getPublicProductName({name:'Produto independente',parent_name:parentName}), 'Produto independente');
assert.equal(getCatalogFamilyName({parent_id:'family',parent_name:'  '}), '');
assert.equal(getCatalogCardDisplayName({product:variants[0],productGroup:{representativeProduct:{parent_id:'family',parent_name:parentName}}}),parentName);
// Same parent authority across grouping, cards, quotes and detail page, even
// when a selected variation has its own name or model text.
const parent = { id: 'poco-family', is_parent: true, name: 'Poco X8 5G - POCO0001', sku: 'POCO0001' };
assert.equal(getCatalogFamilyName(parent), 'Poco X8 5G');
for (const [index, color] of ['Preto', 'Branco', 'Laranja'].entries()) {
  const child = { parent_id: parent.id, parent_name: parent.name, parent_sku: parent.sku, sku: `POCO0001-0${index + 1}`, name: `Nome divergente ${color}`, model: 'Modelo divergente', specs: { color, ram: '8GB', storage: '256GB' } };
  const before = structuredClone(child);
  const expected = 'Poco X8 5G';
  assert.equal(getCatalogFamilyName(child), expected);
  assert.equal(getPublicProductName(child), expected);
  assert.equal(getCatalogCardDisplayName({ product: child, productGroup: { model: 'Grupo divergente' } }), expected);
  assert.equal(getCatalogCardDisplayName({ product: {}, productGroup: { representativeProduct: child } }), expected);
  assert.deepEqual(child, before, 'presentation must not mutate names, SKU or variant specs');
}
const publicNameSource = fs.readFileSync(new URL('../pages/store/publicProductName.js', import.meta.url), 'utf8');
assert.doesNotMatch(publicNameSource, /familySku|parent_sku|variationSku/, 'page must delegate family cleanup to the shared source');
for (const file of ['../components/catalog/ModernProductCard.tsx', '../components/catalog/ProductCard.tsx', '../services/productGrouping.ts']) {
  assert.match(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), /getCatalogFamilyName\(/, `${file} must consume the canonical family name`);
}
console.log('Family title is stable across variants; exact parent spelling preserved; standalone fallback preserved.');

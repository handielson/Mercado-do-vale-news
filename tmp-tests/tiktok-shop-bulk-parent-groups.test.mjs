import assert from 'node:assert/strict';
import { buildTikTokBulkVariationGroups } from '../utils/tiktokBulkVariationGroups.js';

const parent = {
  id: 'parent',
  name: 'Capa de Silicone 360º para Tablet Redmi PAD Pro e Poco PAD 12.1"',
  stock_quantity: 0,
};
const blue = {
  id: 'blue',
  name: 'Capa de Silicone 360º para Tablet Redmi PAD Pro e Poco PAD 12.1" Cor:Azul claro',
  stock_quantity: 2,
};
const black = {
  id: 'black',
  name: 'Capa de Silicone 360º para Tablet Redmi PAD Pro e Poco PAD 12.1" Cor:Preto',
  stock_quantity: 3,
};
const standalone = {
  id: 'standalone',
  name: 'Cabo USB-C',
  stock_quantity: 4,
};

const groups = buildTikTokBulkVariationGroups([blue, standalone, parent, black]);

assert.equal(groups.parentIds.has(parent.id), true, 'the item without Cor: must become the inferred parent');
assert.equal(groups.parentIdByChild.get(blue.id), parent.id, 'a matching color variation must be consolidated under the parent');
assert.equal(groups.parentIdByChild.get(black.id), parent.id, 'all matching colors must be consolidated under the parent');
assert.deepEqual(
  groups.childrenByParent.get(parent.id).map((product) => product.id).sort(),
  ['black', 'blue'],
  'the inferred parent must expose all color SKUs'
);
assert.equal(groups.parentIds.has(standalone.id), false, 'an unrelated standalone product must not become a parent');

console.log('TikTok Shop bulk parent group checks passed');

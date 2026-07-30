import assert from 'node:assert/strict';
import {
  buildTikTokBulkVariationGroups,
  chooseTikTokBulkGroupCategoryMapping,
  getTikTokBulkGroupCategoryIds,
} from '../utils/tiktokBulkVariationGroups.js';

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

const yellowGame = {
  id: 'game-yellow',
  name: 'Video Game Portátil Retrô 400 Sup Game Box Cor:Amarelo',
  sku: 'SGB4001A',
  bling_parent_id: '16670834961',
  stock_quantity: 0,
};
const blueGame = {
  id: 'game-blue',
  name: 'Video Game Portátil Retrô 400 Sup Game Box Cor:Azul',
  sku: 'SGB4001AZ',
  bling_parent_id: '16670834961',
  stock_quantity: 2,
};
const blackGame = {
  id: 'game-black',
  name: 'Video Game Portátil Retrô 400 Sup Game Box Cor:Preto',
  sku: 'SGB4001P',
  bling_parent_id: '16670834961',
  stock_quantity: 8,
};
const redGame = {
  id: 'game-red',
  name: 'Video Game Portátil Retrô 400 Sup Game Box Cor:Vermelho',
  sku: 'SGB4001V',
  bling_parent_id: '16670834961',
  stock_quantity: 12,
};

const blingGroups = buildTikTokBulkVariationGroups([yellowGame, blueGame, blackGame, redGame]);

assert.equal(
  blingGroups.parentIds.has(blueGame.id),
  true,
  'the first Bling variation with positive stock must become the parent'
);
assert.equal(
  blingGroups.parentIds.has(blackGame.id),
  false,
  'later in-stock variations must remain children'
);
assert.deepEqual(
  blingGroups.childrenByParent.get(blueGame.id).map((product) => product.id),
  [yellowGame.id, blackGame.id, redGame.id],
  'all remaining Bling variations must be consolidated under the selected in-stock parent'
);

const noStockGroups = buildTikTokBulkVariationGroups([
  { id: 'empty-a', name: 'Produto Cor:Azul', bling_parent_id: 123, stock_quantity: 0 },
  { id: 'empty-b', name: 'Produto Cor:Preto', bling_parent_id: 123, stock_quantity: 0 },
]);

assert.equal(
  noStockGroups.parentIds.size,
  0,
  'a Bling family without stock must not promote an unavailable variation to parent'
);

assert.deepEqual(
  getTikTokBulkGroupCategoryIds(
    { id: 'group-parent', category_id: 'local-parent' },
    [
      { id: 'group-child-a', category_id: 'local-child' },
      { id: 'group-child-b', category_id: 'local-parent' },
    ]
  ),
  ['local-parent', 'local-child'],
  'category mapping lookup must inspect every distinct local category in the variation group'
);

const inheritedMapping = chooseTikTokBulkGroupCategoryMapping([
  { mapping: null },
  { mapping: { tiktok_category_id: 'remote-game', tiktok_category_name: 'Video Games' } },
]);
assert.equal(
  inheritedMapping.mapping?.tiktok_category_id,
  'remote-game',
  'the parent must inherit the only TikTok category mapping available in its variation group'
);

const conflictingMapping = chooseTikTokBulkGroupCategoryMapping([
  { mapping: { tiktok_category_id: 'remote-a' } },
  { mapping: { tiktok_category_id: 'remote-b' } },
]);
assert.equal(conflictingMapping.mapping, null, 'conflicting TikTok category mappings must block the group');
assert.match(conflictingMapping.error, /conflitantes/i, 'a category conflict must provide an actionable diagnostic');

console.log('TikTok Shop bulk parent group checks passed');

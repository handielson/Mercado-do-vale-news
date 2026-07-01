import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  page,
  /buildShopeeVariationParentIdentity/,
  'Shopee publish flow must build a parent identity for variation listings',
);

assert.match(
  page,
  /const variationParentIdentity = publishWithVariations[\s\S]*buildShopeeVariationParentIdentity/,
  'variation publish must compute parent title/SKU before duplicate lookup',
);

assert.match(
  page,
  /findExistingShopeeItemForDuplicate\(\{[\s\S]*item_sku: publishItemSku[\s\S]*item_name: publishItemName/,
  'variation duplicate lookup must use the parent identity instead of the selected child SKU/title',
);

assert.match(
  page,
  /item_name: publishItemName,[\s\S]*item_sku: publishItemSku/,
  'base payload must use the parent identity for Shopee variation listings',
);

const updateModelBlocks = Array.from(
  page.matchAll(/postShopeeDebug\('update_model',\s*\{([\s\S]*?)\},\s*'[^']+'\)/g),
  (match) => match[1],
);
assert.ok(updateModelBlocks.length >= 2, 'ShopeePage must have update_model calls for variation recovery/update');
for (const block of updateModelBlocks) {
  assert.doesNotMatch(
    block,
    /model_list:/,
    'Shopee update_model requests must send the model field expected by the API, not model_list',
  );
}

assert.match(
  page,
  /postShopeeDebug\('update_model',\s*\{[\s\S]*model: modelListForUpdate/,
  'duplicate variation recovery must send model in update_model',
);

assert.match(
  page,
  /postShopeeDebug\('update_model',\s*\{[\s\S]*model: variationModelListForPublish/,
  'existing variation update must send model in update_model',
);

console.log('shopee variation parent title static checks passed');

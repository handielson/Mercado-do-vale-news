import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  page,
  /function getUnselectedShopeeSearchableAttributes/,
  'Shopee sync must detect searchable attributes that were typed but not selected.'
);

assert.match(
  page,
  /attr\.input_kind === 'searchable'[\s\S]*decodeShopeeSearchableAttributeValue\(entry\)/,
  'Searchable attribute validation must require the encoded Shopee value selected from search results.'
);

assert.match(
  page,
  /function assertShopeeSearchableAttributesSelected/,
  'Shopee sync must block publish when searchable attributes are not selected.'
);

assert.match(
  page,
  /pushSyncDebug\('attribute_validation:searchable_selection_required'[\s\S]*unselected_attributes/,
  'Searchable attribute validation failures must be logged with the affected attributes.'
);

assert.match(
  page,
  /assertShopeeSearchableAttributesSelected\(attributes,\s*attrValues,\s*pushSyncDebug\);[\s\S]*const attributeList = buildAttributePayload\(\)/,
  'Shopee sync must validate searchable selections before building add_item attributes.'
);

assert.match(
  page,
  /Selecione uma opcao da lista da Shopee/,
  'Searchable attribute UI must tell the user to select a Shopee option.'
);

console.log('shopee searchable attribute selection required static checks passed');

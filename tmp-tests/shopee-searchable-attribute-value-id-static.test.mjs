import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  page,
  /const SHOPEE_SEARCHABLE_ATTRIBUTE_VALUE_PREFIX = '__shopee_searchable_value__:'/,
  'Searchable Shopee attributes must use an internal encoded value format.'
);

assert.match(
  page,
  /onChange\(encodeShopeeSearchableAttributeValue\(option\.value_id,\s*option\.value_name\)\)/,
  'Selecting a searchable Shopee attribute option must preserve its Shopee value_id.'
);

assert.match(
  page,
  /const searchableValue = decodeShopeeSearchableAttributeValue\(entry\);[\s\S]*value_id: searchableValue\.value_id,[\s\S]*original_value_name: searchableValue\.value_name,/,
  'Shopee add_item attribute payload must send selected searchable attributes with their real value_id.'
);

assert.match(
  page,
  /const hasCustomValueWithoutShopeeId = values\.some\(\(value: any\) => Number\(value\?\.value_id \|\| 0\) === 0\);[\s\S]*mandatoryAttributeIds\.has\(attributeId\)/,
  'Attribute validation retry must remove optional custom values without Shopee IDs while preserving mandatory attributes.'
);

console.log('shopee searchable attribute value_id static checks passed');

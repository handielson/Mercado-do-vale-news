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
  /const attributeUnitList = Array\.isArray\(attr\?\.attribute_info\?\.attribute_unit_list\)[\s\S]*attribute_unit_list: attributeUnitList,/,
  'Shopee attributes must preserve attribute_info.attribute_unit_list so numeric unit fields can be sent with value_unit.'
);

assert.match(
  page,
  /function buildShopeeAttributeValuePayload[\s\S]*value_unit: matchingUnit,/,
  'Shopee add_item attribute payload must split values with units into original_value_name plus value_unit.'
);

assert.match(
  page,
  /const customValuesAreAllowed = !hasShopeeOptionList \|\| \[3, 5\]\.includes\(Number\(field\?\.raw_input_type\)\);[\s\S]*mandatoryAttributeIds\.has\(attributeId\)/,
  'Attribute validation retry must preserve numeric/text custom values while pruning optional invalid enum values.'
);

console.log('shopee searchable attribute value_id static checks passed');

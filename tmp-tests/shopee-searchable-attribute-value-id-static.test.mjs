import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const fieldTemplates = readFileSync('pages/admin/settings/shopeeFieldTemplates.js', 'utf8');

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
  /const SHOPEE_ATTRIBUTE_FALLBACK_UNITS[\s\S]*101029:\s*'Piece'[\s\S]*SHOPEE_ATTRIBUTE_FALLBACK_UNITS\[Number\(attr\.attribute_id\)\]/,
  'Shopee package size attribute 101029 must prefer Piece when the default value has no explicit unit.'
);

assert.match(
  page,
  /function normalizeShopeeAttributeEntryForPayload[\s\S]*Number\(attr\.attribute_id\)\s*===\s*101029[\s\S]*acceptsPiece[\s\S]*isDimensionText\(normalizedEntry\)[\s\S]*return '1 Piece'/,
  'Shopee package size attribute 101029 must convert misplaced dimensions such as 11 x 6 x 6 cm into the valid one-piece package size when Piece is an allowed unit.'
);

assert.match(
  page,
  /\.map\(\(entry\)\s*=>\s*normalizeShopeeAttributeEntryForPayload\(attr,\s*entry\)\)[\s\S]*buildShopeeAttributeValuePayload\(attr,\s*entry\)[\s\S]*attributeValueList\.length > 0/,
  'Shopee add_item attribute payload must normalize unsafe attribute entries before building attribute values.'
);

assert.match(
  page,
  /const SHOPEE_ATTRIBUTE_FALLBACK_VALUES[\s\S]*100413:[\s\S]*value_id:\s*2497,[\s\S]*original_value_name:\s*'New'[\s\S]*normalizeLookupText\(candidate\.match\)\s*===\s*normalizeLookupText\(entry\)/,
  'Shopee condition attribute 100413 must map Novo/New to the real Shopee enum value_id 2497.'
);

assert.match(
  page,
  /function getShopeeNativeConditionAttributeValue[\s\S]*Number\(attr\.attribute_id\)\s*!==\s*100413[\s\S]*return 'Novo'/,
  'Shopee condition attribute 100413 must still have a UI default value.'
);

assert.match(
  page,
  /function withShopeeNativeConditionAttributeDefault[\s\S]*Number\(attr\.attribute_id\)\s*===\s*100413[\s\S]*hasFilledAttributeValue\(values\[100413\]\)[\s\S]*100413:\s*'Novo'/,
  'Shopee condition attribute 100413 must be prefilled in attrValues so the UI shows Condicao as Novo.'
);

assert.match(
  page,
  /setAttrValues\(\(current\)\s*=>\s*withShopeeNativeConditionAttributeDefault\(attributes,[\s\S]*mergedAttributeValues[\s\S]*\)\)/,
  'Applying Shopee templates must keep the native Condition default visible in the attribute form.'
);

assert.match(
  page,
  /const mergedTemplateValues = withShopeeNativeConditionAttributeDefault\(normalizedAttributes,[\s\S]*mergeShopeeAttributeDefaults/,
  'Selecting a Shopee category must initialize attrValues with the native Condition default when the category exposes it.'
);

assert.match(
  page,
  /function shouldSkipShopeeAttributePayload[\s\S]*Number\(attr\.attribute_id\)\s*===\s*100413[\s\S]*return true/,
  'Shopee condition attribute 100413 must be omitted from attribute_list because condition is sent as a native field.'
);

assert.match(
  fieldTemplates,
  /id:\s*'power_supply'[\s\S]*category_id:\s*101803[\s\S]*strict_attribute_ids:\s*\[100121,\s*100370,\s*101029,\s*101219,\s*102292\]/,
  'Power supply field template must mirror phone case behavior with a strict set of safe Shopee attributes.'
);

assert.match(
  page,
  /function shouldSkipShopeeAttributePayload\(attr: ShopeeAttributeField,\s*fieldTemplate:[\s\S]*strictAttributeIds[\s\S]*!strictAttributeIds\.has\(Number\(attr\.attribute_id\)\)[\s\S]*\.filter\(\(attr\) => !shouldSkipShopeeAttributePayload\(attr,\s*activeFieldTemplate\)\)/,
  'Shopee add_item must omit attributes outside a strict field template allowlist.'
);

assert.match(
  page,
  /const SHOPEE_ATTRIBUTE_RETRY_PROTECTED_OPTIONAL_IDS[\s\S]*100942[\s\S]*101029[\s\S]*100999[\s\S]*100134/,
  'Attribute validation retry must preserve core optional Shopee fields including product dimensions, package size, quantity, and material.'
);

console.log('shopee searchable attribute value_id static checks passed');

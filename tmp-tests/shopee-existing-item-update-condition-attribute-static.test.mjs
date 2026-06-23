import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  page,
  /function omitShopeeNativeConditionAttributeForUpdateItem[\s\S]*Number\(attr\?\.attribute_id\)\s*!==\s*100413/,
  'Existing item update must strip Shopee native Condition attribute 100413 from attribute_list.'
);

assert.match(
  page,
  /resolvedExistingProductItemId[\s\S]*omitShopeeNativeConditionAttributeForUpdateItem\(finalPayload\)[\s\S]*update_item:existing_item/,
  'Existing item update must use the Condition-stripped payload before calling update_item.'
);

assert.match(
  page,
  /condition:\s*'NEW'/,
  'Shopee payload must keep the native condition field while stripping duplicate Condition attributes for update_item.'
);

console.log('shopee existing item update condition attribute static checks passed');

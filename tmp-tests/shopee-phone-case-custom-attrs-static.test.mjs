import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fieldTemplates = readFileSync('pages/admin/settings/shopeeFieldTemplates.js', 'utf8');
const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  fieldTemplates,
  /const PHONE_CASE_TEMPLATE[\s\S]*attribute_defaults:\s*\{[\s\S]*100999:\s*'1'/,
  'Phone case template must default Shopee Quantity (100999) to numeric 1, not Others.'
);

assert.match(
  fieldTemplates,
  /const PHONE_CASE_TEMPLATE[\s\S]*attribute_defaults:\s*\{[\s\S]*101219:\s*'No'/,
  'Phone case template must default Shopee Custom Product (101219) to No, not a custom text value.'
);

assert.doesNotMatch(
  fieldTemplates,
  /const PHONE_CASE_TEMPLATE[\s\S]*attribute_defaults:\s*\{[\s\S]*100999:\s*'Others'/,
  'Phone case template must not send Others for Shopee Quantity (100999).'
);

assert.doesNotMatch(
  fieldTemplates,
  /const PHONE_CASE_TEMPLATE[\s\S]*attribute_defaults:\s*\{[\s\S]*101219:\s*'Soft'/,
  'Phone case template must not send Soft for Shopee Custom Product (101219).'
);

assert.match(
  page,
  /value=\{getShopeeOptionFormValue\(option\)\}/,
  'Shopee select fields must use a stable option value so translated labels such as Nao stay selected and submit the original Shopee value.'
);

assert.match(
  page,
  /function getShopeeSelectFormValue[\s\S]*normalizeLookupText\(candidate\.original_value_name\)[\s\S]*normalizeLookupText\(candidate\.label\)[\s\S]*getShopeeOptionFormValue\(option\)/,
  'Shopee select fields must map existing translated/default values back to the original Shopee option value.'
);

console.log('shopee phone case custom attrs static checks passed');

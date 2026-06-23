import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  page,
  /function shouldPruneShopeeOptionalCustomAttribute/,
  'Shopee sync must centralize the decision to prune optional custom attributes after classification.attribute errors.'
);

assert.match(
  page,
  /optional_custom_attribute_ids/,
  'Attribute debug summary must expose all optional custom attributes that can be retried without narrowing to enum-only issues.'
);

assert.match(
  page,
  /const SHOPEE_ATTRIBUTE_RETRY_PROTECTED_OPTIONAL_IDS[\s\S]*100121[\s\S]*101029[\s\S]*100999[\s\S]*100134/,
  'Retry sanitizer must protect core optional Shopee attributes that should remain visible in Seller Center.'
);

assert.match(
  page,
  /function shouldPruneShopeeOptionalCustomAttribute[\s\S]*protectedAttributeIds:\s*Set<number>[\s\S]*protectedAttributeIds\.has\(attributeId\)[\s\S]*return false[\s\S]*hasCustomValue[\s\S]*removedAttributes\.push\(attr\)/,
  'Retry sanitizer must remove only non-protected optional custom attributes after classification errors.'
);

assert.match(
  page,
  /if \(mandatoryAttributeIds\.has\(attributeId\)\) return false/,
  'Retry sanitizer must preserve mandatory custom attributes.'
);

assert.match(
  page,
  /attribute_retry_without_optional_custom_values[\s\S]*removed_attributes/,
  'Retry logs must list the optional custom attributes removed before retrying add_item.'
);

console.log('shopee optional custom attribute prune static checks passed');

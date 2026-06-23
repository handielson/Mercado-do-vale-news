import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  page,
  /function summarizeShopeeAttributePayloadForDebug/,
  'Shopee sync must build a focused debug summary for attribute payloads.'
);

assert.match(
  page,
  /custom_value_attribute_ids[\s\S]*enum_custom_value_attribute_ids[\s\S]*required_attribute_ids/,
  'Attribute debug summary must expose custom values, invalid enum risks, and required attributes.'
);

assert.match(
  page,
  /attribute_debug:\s*summarizeShopeeAttributePayloadForDebug\(payload,\s*attributes\)/,
  'add_item payload_preview must include the attribute debug summary.'
);

assert.match(
  page,
  /add_item:variant_error[\s\S]*attribute_debug:\s*summarizeShopeeAttributePayloadForDebug\(payload,\s*attributes\)/,
  'add_item variant errors must include the attribute debug summary.'
);

assert.match(
  page,
  /add_item:attribute_retry_without_optional_custom_values[\s\S]*removed_attributes:[\s\S]*summarizeShopeeAttributePayloadForDebug\(sanitized\.payload,\s*attributes\)/,
  'Attribute validation retry logs must show removed attributes and the sanitized attribute summary.'
);

assert.match(
  page,
  /variant:\s*'variation'[\s\S]*removed_attributes:[\s\S]*summarizeShopeeAttributePayloadForDebug\(sanitized\.payload,\s*attributes\)/,
  'Variation attribute validation retry logs must include the same removed attributes and sanitized summary.'
);

console.log('shopee attribute validation debug static checks passed');

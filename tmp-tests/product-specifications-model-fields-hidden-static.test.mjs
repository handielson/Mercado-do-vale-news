import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const specs = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');
const metadata = readFileSync('components/products/sections/fieldMetadata.ts', 'utf8');

assert.match(
  metadata,
  /PRODUCT_LEVEL_FIELDS[\s\S]*'imei1'[\s\S]*'battery_health'/,
  'field metadata must keep an explicit product-level allowlist',
);

assert.match(
  metadata,
  /Fields NOT listed here \(e\.g\., battery_mah, display\) belong to the model template\./,
  'field metadata must document that battery_mah and display belong to the model template',
);

assert.match(
  specs,
  /getCategoryDynamicSpecFields\(categoryConfig, templateValues\)[\s\S]*shouldRenderField\(key, requirement as any\)/,
  'ProductSpecifications dynamic fields must use shouldRenderField so model-level fields stay hidden',
);

console.log('product specifications model fields hidden static checks passed');

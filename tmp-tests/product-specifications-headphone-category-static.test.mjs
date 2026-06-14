import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const formSource = readFileSync('components/products/ProductForm.tsx', 'utf8');
const specsSource = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');

assert.match(
  formSource,
  /__category_slug:\s*category\.slug/,
  'ProductForm must pass category slug metadata into ProductSpecifications.',
);

assert.match(
  formSource,
  /__category_name:\s*category\.name/,
  'ProductForm must pass category name metadata into ProductSpecifications.',
);

assert.match(
  specsSource,
  /NON_SERIALIZED_CATEGORY_SLUG_PATTERNS[\s\S]*fone-de-ouvido/,
  'Headphone categories must be recognized as non-serialized legacy categories.',
);

[
  'imei1',
  'imei2',
  'serial',
  'storage',
  'ram',
  'version',
  'battery_health',
].forEach((fieldKey) => {
  assert.match(
    specsSource,
    new RegExp(`PHONE_ONLY_BASE_SPEC_FIELD_KEYS[\\s\\S]*${fieldKey}`),
    `${fieldKey} must be treated as a phone-only/base serialized field for headphone categories.`,
  );
});

assert.match(
  specsSource,
  /isNonSerializedLegacyCategory[\s\S]*PHONE_ONLY_BASE_SPEC_FIELD_KEYS\.has\(key\)[\s\S]*return false/,
  'Phone-only/base serialized fields must be hidden for non-serialized legacy categories.',
);

console.log('headphone category spec visibility static checks passed');

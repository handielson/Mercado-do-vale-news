import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');

assert.match(
  source,
  /const shouldShowBaseSpecField\s*=\s*\(/,
  'ProductSpecifications must define a category-aware guard for built-in spec fields.',
);

[
  'specs.imei1',
  'specs.imei2',
  'specs.serial',
  'specs.storage',
  'specs.ram',
  'specs.version',
  'specs.battery_health',
].forEach((technicalName) => {
  const key = technicalName.replace('specs.', '');
  assert.match(
    source,
    new RegExp(`shouldShowBaseSpecField\\('${key}'\\)`),
    `${technicalName} must only render when allowed by the category field list.`,
  );
});

assert.match(
  source,
  /customFields[\s\S]*filter[\s\S]*BASE_SPEC_FIELD_KEYS/,
  'Dynamic custom fields must keep filtering built-in spec fields to avoid duplicates.',
);

console.log('product specification category visibility guard is present');

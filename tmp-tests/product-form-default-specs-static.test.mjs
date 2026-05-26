import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const form = readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  form,
  /const DEFAULT_PRODUCT_VERSION = 'Global';/,
  'ProductForm must define Global as the default product version',
);

assert.match(
  form,
  /const DEFAULT_BATTERY_HEALTH = '100';/,
  'ProductForm must define 100 as the default battery health select value',
);

assert.match(
  form,
  /if \(initialData \|\| !categoryConfig\) return;/,
  'default spec values must not be applied in edit mode or before category config loads',
);

assert.match(
  form,
  /categoryConfig\.version !== 'off'[\s\S]{0,240}setValue\('specs\.version', DEFAULT_PRODUCT_VERSION/,
  'new products with the version field active must default specs.version to Global',
);

assert.match(
  form,
  /categoryConfig\.battery_health !== 'off'[\s\S]{0,260}setValue\('specs\.battery_health', DEFAULT_BATTERY_HEALTH/,
  'new products with the battery field active must default specs.battery_health to 100',
);

assert.match(
  form,
  /shouldDirty: false,[\s\S]{0,80}shouldTouch: false,[\s\S]{0,80}shouldValidate: true/,
  'preselected defaults must validate without marking the form as manually edited',
);

console.log('product form default specs static checks passed');

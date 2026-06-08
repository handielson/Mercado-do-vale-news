import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/categories.ts', 'utf8');

assert.match(
  source,
  /function\s+normalizeCategoryConfig/,
  'category service must normalize category config before exposing it to product forms',
);

assert.match(
  source,
  /categoryKey === 'smartphones' \|\| categoryKey === 'celulares'/,
  'smartphone/celular categories must be detected by slug/name',
);

assert.match(
  source,
  /ram:\s*config\.ram && config\.ram !== 'off' \? config\.ram : 'required'/,
  'smartphones must keep RAM visible and required even when VPS config still says off',
);

assert.match(
  source,
  /storage:\s*config\.storage && config\.storage !== 'off' \? config\.storage : 'required'/,
  'smartphones must keep storage visible and required even when VPS config still says off',
);

console.log('smartphones category RAM/storage guard OK');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');

assert.match(
  source,
  /const storageRequirement = getBaseSpecRequirement\('storage'\);/,
  'storage requirement must still be resolved from legacy/custom config when present',
);

assert.match(
  source,
  /const ramRequirement = getBaseSpecRequirement\('ram'\);/,
  'ram requirement must still be resolved from legacy/custom config when present',
);

const storageBlockStart = source.indexOf('/* ARMAZENAMENTO */');
const ramBlockStart = source.indexOf('/* RAM */');

assert.ok(storageBlockStart > 0, 'storage block must exist in ProductSpecifications');
assert.ok(ramBlockStart > storageBlockStart, 'ram block must exist after storage block');

const storageBlock = source.slice(storageBlockStart, ramBlockStart);
const ramBlock = source.slice(ramBlockStart);

assert.ok(
  storageBlock.includes('shouldShowSmartphoneMemoryFields') &&
  storageBlock.includes('label="Armazenamento"') &&
  storageBlock.includes('technicalName="specs.storage"'),
  'ProductSpecifications must render storage as a fixed smartphone field, not a category spec field',
);

assert.ok(
  ramBlock.includes('shouldShowSmartphoneMemoryFields') &&
  ramBlock.includes('label="Mem') &&
  ramBlock.includes('technicalName="specs.ram"'),
  'ProductSpecifications must render RAM as a fixed smartphone field, not a category spec field',
);

assert.doesNotMatch(
  storageBlock,
  /shouldShowBaseSpecField\('storage'\)/,
  'Storage visibility must not depend on category spec field configuration.',
);

assert.doesNotMatch(
  ramBlock,
  /shouldShowBaseSpecField\('ram'\)/,
  'RAM visibility must not depend on category spec field configuration.',
);

console.log('product specifications memory fields static checks passed');

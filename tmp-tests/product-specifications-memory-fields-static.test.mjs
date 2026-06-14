import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');

assert.match(
  source,
  /const storageRequirement = getBaseSpecRequirement\('storage'\);/,
  'storage requirement must be resolved from category custom fields or legacy category config',
);

assert.match(
  source,
  /const ramRequirement = getBaseSpecRequirement\('ram'\);/,
  'ram requirement must be resolved from category custom fields or legacy category config',
);

const storageBlockStart = source.indexOf('/* ARMAZENAMENTO */');
const ramBlockStart = source.indexOf('/* RAM */');

assert.ok(storageBlockStart > 0, 'storage block must exist in ProductSpecifications');
assert.ok(ramBlockStart > storageBlockStart, 'ram block must exist after storage block');

const storageBlock = source.slice(storageBlockStart, ramBlockStart);
const ramBlock = source.slice(ramBlockStart);

assert.ok(
  storageBlock.includes("shouldShowBaseSpecField('storage')") &&
  storageBlock.includes('label="Armazenamento"') &&
  storageBlock.includes('technicalName="specs.storage"'),
  'ProductSpecifications must render the storage control directly inside the specifications grid',
);

assert.ok(
  ramBlock.includes("shouldShowBaseSpecField('ram')") &&
  ramBlock.includes('label="Memória RAM"') &&
  ramBlock.includes('technicalName="specs.ram"'),
  'ProductSpecifications must render the ram control directly inside the specifications grid',
);

console.log('product specifications memory fields static checks passed');

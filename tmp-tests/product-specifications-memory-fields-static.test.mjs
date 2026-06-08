import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/products/sections/ProductSpecifications.tsx', 'utf8');

assert.match(
  source,
  /const storageRequirement: FieldRequirement = categoryConfig\.storage === 'required' \? 'required' : 'optional';/,
  'storage must stay visible even when the category only marks it as optional',
);

assert.match(
  source,
  /const ramRequirement: FieldRequirement = categoryConfig\.ram === 'required' \? 'required' : 'optional';/,
  'ram must stay visible even when the category only marks it as optional',
);

const storageBlockStart = source.indexOf('/* ARMAZENAMENTO */');
const ramBlockStart = source.indexOf('/* RAM */');

assert.ok(storageBlockStart > 0, 'storage block must exist in ProductSpecifications');
assert.ok(ramBlockStart > storageBlockStart, 'ram block must exist after storage block');

const storageBlock = source.slice(storageBlockStart, ramBlockStart);
const ramBlock = source.slice(ramBlockStart);

assert.ok(
  storageBlock.includes('label="Armazenamento"') && storageBlock.includes('technicalName="specs.storage"'),
  'ProductSpecifications must render the storage control directly inside the specifications grid',
);

assert.ok(
  ramBlock.includes('label="Memória RAM"') && ramBlock.includes('technicalName="specs.ram"'),
  'ProductSpecifications must render the ram control directly inside the specifications grid',
);

console.log('product specifications memory fields static checks passed');

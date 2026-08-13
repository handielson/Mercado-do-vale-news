'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  normalizePhysicalRamValue,
  normalizeProductSpecsRam,
} = require('../services/physicalRamCore.cjs');

assert.equal(normalizePhysicalRamValue('24GB(8+16)'), '8GB');
assert.equal(normalizePhysicalRamValue('Até 24GB (8GB + 16GB virtual)'), '8GB');
assert.equal(normalizePhysicalRamValue('12GB (4+8)'), '4GB');
assert.equal(normalizePhysicalRamValue('8 GB'), '8GB');
assert.equal(normalizePhysicalRamValue('16GB'), '16GB');

assert.deepEqual(normalizeProductSpecsRam({
  ram: '24GB(8+16)',
  memoria_ram_virtual: 'Até 24GB (8+16)',
  storage: '512GB',
}), {
  ram: '8GB',
  memoria_ram_virtual: 'Até 24GB (8+16)',
  storage: '512GB',
});

assert.equal(normalizeProductSpecsRam({ ram_fisica: '6GB', ram: '12GB(6+6)' }).ram, '6GB');

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8');
  assert.match(source, /specs:\s+normalizeProductSpecsRam\(r\.specs\)/, `${file} deve normalizar a RAM nas respostas de produtos`);
  assert.match(source, /jsonStr\(normalizeProductSpecsRam\(p\.specs\)\)/, `${file} deve salvar somente a RAM física nos produtos`);
}

console.log('product physical RAM checks passed');

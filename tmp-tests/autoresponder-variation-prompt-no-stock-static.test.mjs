import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf('function buildAutoresponderVariationPrompt');
  assert.notEqual(start, -1, `${file} must define buildAutoresponderVariationPrompt`);
  const end = source.indexOf('function findAutoresponderSelectedVariation', start);
  assert.notEqual(end, -1, `${file} must define findAutoresponderSelectedVariation after variation prompt`);
  const block = source.slice(start, end);

  assert.match(block, /filterAutoresponderAvailableProducts\(variations\)/, `${file} must keep filtering available variations`);
  assert.match(block, /formatAutoresponderCurrency\(getAutoresponderProductPrice\(variation\)\)/, `${file} must keep showing variation price`);
  assert.doesNotMatch(block, /em estoque/, `${file} variation prompt must not show stock quantity to customer`);
  assert.doesNotMatch(block, /stock_quantity/, `${file} variation prompt must not read stock quantity for display`);
}

console.log('autoresponder variation prompt no stock static checks passed');

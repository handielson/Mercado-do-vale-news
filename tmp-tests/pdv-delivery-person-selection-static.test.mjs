import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deliverySection = readFileSync('components/pdv/DeliverySection.tsx', 'utf8');

assert.match(
  deliverySection,
  /const needsDeliveryPerson = selectedType === 'store_delivery' \|\| selectedType === 'hybrid_delivery'/,
  'store delivery must expose every registered delivery person',
);
assert.match(
  deliverySection,
  /<option value="">Loja<\/option>[\s\S]{0,300}deliveryPersons\.map/,
  'Loja must be the default option before the registered delivery people',
);
assert.match(
  deliverySection,
  /selectedType === 'store_delivery'[\s\S]{0,240}onDeliveryChange\(selectedType, selectedPerson, costStore, 0\)/,
  'store delivery must preserve a delivery person selected by the cashier',
);
assert.match(
  deliverySection,
  /type === 'store_delivery'[\s\S]{0,160}setSelectedPerson\(undefined\)/,
  'selecting store delivery must initially select Loja',
);
assert.match(
  deliverySection,
  /required=\{selectedType === 'hybrid_delivery'\}/,
  'Loja must remain a valid default for store delivery while hybrid delivery still requires a person',
);

console.log('PDV delivery person selection checks passed');

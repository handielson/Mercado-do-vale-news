import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');

assert.match(
  source,
  /getProductByImei/,
  'IMEI search must fall back to product specs when no unit row exists',
);

assert.match(
  source,
  /const addSerializedProductToCart = async \(product: Product, preferredIdentifier\?: string\)/,
  'PDV must share one serialized-product add path between scan, Enter, and Add button',
);

assert.match(
  source,
  /unitService\.create\(\{[\s\S]*product_id: product\.id[\s\S]*status: UnitStatus\.AVAILABLE/s,
  'Fallback must create a real available unit before adding the serialized product to the cart',
);

assert.match(
  source,
  /internal_notes: 'Unidade criada automaticamente pelo PDV a partir do cadastro legado do produto'/,
  'Fallback-created units must be auditable in internal notes',
);

assert.match(
  source,
  /onAddToCart\(product, 1, \{[\s\S]*unitId: unit\.id/s,
  'Fallback path must add the product using the real unit id returned by the VPS',
);

assert.match(
  source,
  /const handleAddToCart = async \(product: Product\)[\s\S]*await addSerializedProductToCart\(product\);[\s\S]*return;/,
  'Clicking Add on a serialized product card must create/reuse a unit and add it to the cart',
);

assert.match(
  source,
  /await addSerializedProductToCart\(singleProduct, term\);/,
  'Pressing Enter on a single serialized product result must add it instead of only switching tabs',
);

console.log('pdv legacy serialized product fallback static checks passed');

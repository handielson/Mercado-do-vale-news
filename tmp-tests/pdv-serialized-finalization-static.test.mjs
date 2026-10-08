import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pdvPage = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
const saleService = readFileSync('services/saleService.ts', 'utf8');

assert.match(
  pdvPage,
  /unitData\?\.unitId[\s\S]{0,500}cartItems\.some\([\s\S]{0,500}serialized_unit\?\.unitId[\s\S]{0,300}unitData\.unitId/,
  'PDVPage.handleAddToCart must reject a serialized unit already present in the cart',
);

assert.match(
  pdvPage,
  /toast\.error\(['"`]Esta unidade ja esta no carrinho['"`]\)/,
  'Duplicate selected unit must show a clear cart error',
);

assert.match(
  saleService,
  /serialized_unit_id:\s*item\.serialized_unit\?\.unitId\s*\|\|\s*null/,
  'saleService must persist selected serialized_unit_id on sale items',
);

assert.match(
  saleService,
  /hasSerializedUnits \? '\/sales\/finalize-serialized'/,
  'saleService must persist sale and selected units through atomic API',
);

assert.match(
  saleService,
  /!\(item as any\)\.serialized_unit\?\.unitId/,
  'serialized items must be excluded from generic product stock decrement',
);

assert.doesNotMatch(
  saleService,
  /unitService\.markAsSold\(/,
  'serialized unit write-off must not occur in separate client requests',
);

console.log('pdv serialized finalization static checks passed');

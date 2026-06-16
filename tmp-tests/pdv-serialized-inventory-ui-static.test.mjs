import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');

assert.match(
  source,
  /buildPdvSearchCards|fromHydratedPdvSearchPayload/,
  'ProductSearchSection must render grouped PDV cards from pdvSerializedInventory',
);

assert.match(
  source,
  /selectedUnitByCardId/,
  'Serialized product cards must store the selected unit option per product card',
);

assert.match(
  source,
  /card\.unitOptions/,
  'Serialized product cards must render/select available unit options inside the product card',
);

assert.match(
  source,
  /selectedUnit\.unitData/,
  'Adding a serialized product must pass the selected unitData to the cart',
);

assert.doesNotMatch(
  source,
  /availableSerializedLines/,
  'ProductSearchSection must not keep ad-hoc serialized line maps',
);

assert.doesNotMatch(
  source,
  /join\(' \| '\)/,
  'ProductSearchSection must not join multiple serials into one product text line',
);

assert.doesNotMatch(
  source,
  /specs\.(imei|imei1|imei2|serial|serial_number)/,
  'ProductSearchSection must not render or decide serialized state from legacy specs identifiers',
);

console.log('pdv serialized inventory UI static checks passed');

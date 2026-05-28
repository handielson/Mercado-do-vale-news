import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('utils/catalogPDFGenerator.ts', 'utf8');

assert.match(
  source,
  /const\s+addWarrantyStyleHeader\s*=\s*async\s*\(\)\s*=>/,
  'catalog PDF must use a warranty-style A4 header helper'
);

assert.match(
  source,
  /doc\.line\(margin,\s*headerBottomY,\s*pageWidth\s*-\s*margin,\s*headerBottomY\)/,
  'catalog PDF header must keep the standard A4 bottom divider line'
);

assert.doesNotMatch(
  source,
  /doc\.rect\(0,\s*0,\s*pageWidth,\s*45,\s*'F'\)/,
  'catalog PDF must not use the old large blue catalog header block'
);

assert.ok(
  source.includes("const documentTitle = categoryName ? `Catálogo - ${categoryName}` : 'Catálogo Completo de Produtos';"),
  'catalog PDF must keep the catalog document name under the standard header'
);

assert.match(
  source,
  /getCustomerTypeLabel\(customerType\)/,
  'catalog PDF must keep the customer type metadata in the compact header'
);

console.log('catalog pdf warranty header static checks passed');

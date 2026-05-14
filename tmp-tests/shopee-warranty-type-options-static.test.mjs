import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  source,
  /SHOPEE_WARRANTY_TYPE_ATTRIBUTE_IDS\s*=\s*new Set\(\[100370\]\)/,
  'warranty type attribute id should be explicitly recognized'
);

assert.match(
  source,
  /original_value_name:\s*'Supplier Warranty'/,
  'supplier warranty option should be preserved for Shopee payloads'
);

assert.match(
  source,
  /ensureWarrantyTypeOptions\(Number\(attr\?\.attribute_id\)[\s\S]*options\)/,
  'normalized Shopee attributes should add warranty type fallback options'
);

assert.match(
  source,
  /Garantia do Fornecedor/,
  'UI should expose a Portuguese supplier warranty label'
);

console.log('shopee warranty type options static test passed');

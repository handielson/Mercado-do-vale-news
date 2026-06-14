import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/products/ModelProductAggregatorPage.tsx', 'utf8');

assert.match(
  source,
  /onClick=\{\(\) => onNavigate\(product\.editUrl\)\}/,
  'model panel product shortcut must navigate to the product edit URL'
);
assert.match(
  source,
  />\s*Editar produto\s*</,
  'model panel must expose the explicit "Editar produto" shortcut label'
);

console.log('model panel product edit shortcut static checks passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  source,
  /const adminProductUrl = isAdmin && product\?\.id[\s\S]*\/admin\/products\/\$\{encodeURIComponent\(product\.id\)\}/,
  'public product page must build a direct admin product edit/detail URL for admins',
);

assert.match(
  source,
  /adminProductUrl && \([\s\S]*Editar produto/,
  'public product page must render the admin edit product button independently of model panel validity',
);

assert.match(
  source,
  /adminModelPanelUrl && \(/,
  'model panel button should remain separate and optional',
);

console.log('public product admin edit button static checks passed');

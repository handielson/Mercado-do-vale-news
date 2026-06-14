import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  source,
  /const isAdmin = customer\?\.customer_type === 'ADMIN'/,
  'PDP must derive admin visibility from the logged customer type',
);

assert.match(
  source,
  /const adminProductUrl = isAdmin && product\?\.id[\s\S]*?`\/admin\/products\/\$\{encodeURIComponent\(product\.id\)\}\/\$\{encodeURIComponent\(productSlug\)\}`/,
  'PDP must build an admin product edit URL for logged admins',
);

assert.match(
  source,
  /const adminModelPanelUrl = isAdmin[\s\S]*?`\/admin\/products\/models\/\$\{encodeURIComponent\(productModelId\)\}`/,
  'PDP must build the model panel URL for logged admins when the product has a valid model',
);

assert.match(
  source,
  /title="Editar produto no admin"[\s\S]*?Editar produto/,
  'PDP admin action row must render the Editar produto button',
);

assert.match(
  source,
  /title="Abrir painel do modelo"[\s\S]*?Painel do modelo/,
  'PDP admin action row must render the Painel do modelo button',
);

assert.match(
  source,
  /<Pencil size=\{16\}/,
  'Editar produto button must keep a visible edit icon',
);

assert.match(
  source,
  /<Settings size=\{16\}/,
  'Painel do modelo button must keep a visible settings icon',
);

console.log('PDP admin edit actions static checks passed');

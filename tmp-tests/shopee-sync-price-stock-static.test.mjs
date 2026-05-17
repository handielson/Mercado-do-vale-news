import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  source,
  /<input[\s\S]*type="number"[\s\S]*value=\{shopeeStock\}[\s\S]*readOnly[\s\S]*Estoque vindo do Bling/,
  'Shopee publish modal must show initial stock as read-only because stock comes from Bling'
);

assert.doesNotMatch(
  source,
  /stockDirtyRef\.current\s*=\s*true/,
  'Shopee publish modal must not let operators dirty/edit the Bling stock value'
);

assert.match(
  source,
  /Simulador de Ganhos Shopee/,
  'Shopee publish modal must include the Shopee earnings calculator near the sale price'
);

assert.match(
  source,
  /onClick=\{\(\) => setShopeePrice\(precoSugerido\)\}/,
  'Shopee publish modal calculator must be able to apply the suggested sale price'
);

console.log('shopee sync price and stock static checks passed');

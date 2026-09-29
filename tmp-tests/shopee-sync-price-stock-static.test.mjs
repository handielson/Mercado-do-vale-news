import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const shopeeService = readFileSync('services/shopeeService.ts', 'utf8');
const productsService = readFileSync('services/products.ts', 'utf8');
const vpsServer = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /<input[\s\S]*type="number"[\s\S]*value=\{shopeeStock\}[\s\S]*readOnly[\s\S]*Estoque vindo do Bling/,
  'Shopee publish modal must show initial stock as read-only because stock comes from Bling'
);

assert.match(shopeeService, /getLinkedShopeeConnectionIds/, 'manual product updates must enumerate every linked Shopee store');
assert.match(shopeeService, /connection_id:\s*connectionId/, 'stock and price mutations must carry the target store connection');
assert.match(shopeeService, /Promise\.all\(connectionIds\.map/, 'stock and price mutations must run for every linked store');
assert.match(productsService, /getByProductIds\(\[id\]\)[\s\S]*Number\(link\.shopee_item_id\) > 0/, 'G-only links must also trigger product stock and price synchronization');
assert.match(productsService, /shopee_store_codes:\s*Array\.isArray\(row\.shopee_store_codes\)/, 'transformed products must preserve their M/G badges');
assert.match(vpsServer, /async function getShopeeActionsLinkedItemIdVps/, 'Shopee action mutations must resolve the item within the selected store');
assert.match(vpsServer, /getShopeeActionsLinkedItemIdVps\(payload\.product_id, product, connectionId\)/, 'stock and price API actions must not fall back to the primary item for G');

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

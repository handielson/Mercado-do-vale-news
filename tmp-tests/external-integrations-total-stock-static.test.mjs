import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const blingService = read('services/blingService.ts');
const blingApi = read('api/bling.ts');
const blingWebhook = read('api/bling-webhook.ts');
const vpsServer = read('vps_server.cjs');
const catalogService = read('services/catalogService.ts');
const catalogConfigService = read('services/catalogConfigService.ts');
const catalogProductCard = read('components/catalog/ProductCard.tsx');
const catalogModernProductCard = read('components/catalog/ModernProductCard.tsx');
const publicProductPage = read('pages/store/PublicProductPage.tsx');
const shopeeService = read('services/shopeeService.ts');
const shopeeActions = read('api/shopee-actions.ts');
const productsService = read('services/products.ts');
const estoque = read('Estoque.md');

const assertNoInternalStockLocations = (name, contents) => {
  assert.doesNotMatch(
    contents,
    /product_stock_locations|from\(['"]stock_locations['"]\)|stockLocationService|getProductStockDistribution|reserveStockByPriority|decrementStockByPriority/,
    `${name} must not depend on internal stock-location tables/services`
  );
};

assert.match(
  blingService,
  /stock_quantity:\s*data\.stock_quantity|stock_quantity:\s*item\.stock_quantity|p\.stock_quantity\s*=\s*stockMap\.get\(p\.id\)/,
  'Bling import must map stock to products.stock_quantity'
);

assert.match(
  blingApi,
  /select\(['"][^'"]*stock_quantity[^'"]*bling_id[^'"]*['"]\)[\s\S]*update\(\{\s*stock_quantity:\s*change\.nextStock\s*\}/,
  'Bling reconcile must update products.stock_quantity'
);

assert.match(
  blingWebhook,
  /update\(\{\s*stock_quantity:\s*stockQty\s*\}\)/,
  'Bling webhook must write total stock_quantity'
);

assert.match(
  blingWebhook,
  /patchVps\(['"]\/products\/stock['"][\s\S]*stock_quantity:\s*stockQty/,
  'Bling webhook must sync total stock_quantity to VPS'
);

assertNoInternalStockLocations('Bling service', blingService);
assertNoInternalStockLocations('Bling API', blingApi);
assertNoInternalStockLocations('Bling webhook', blingWebhook);

assert.match(
  vpsServer,
  /fastify\.patch\(['"]\/products\/stock['"][\s\S]*stock_quantity[\s\S]*UPDATE products SET stock_quantity=\?/,
  'VPS stock endpoint must accept and update total stock_quantity'
);

assert.match(
  vpsServer,
  /UPDATE products SET stock_quantity = \([\s\S]*SELECT COUNT\(\*\) FROM units WHERE product_id = \? AND status = 'available'/,
  'VPS serialized units must recalculate total stock_quantity from available units'
);

assertNoInternalStockLocations('VPS product stock endpoint', vpsServer.slice(vpsServer.indexOf("fastify.patch('/products/stock'"), vpsServer.indexOf("fastify.post('/units'", vpsServer.indexOf("fastify.patch('/products/stock'"))));

assert.match(
  catalogService,
  /stock_quantity/,
  'catalog service must use products.stock_quantity'
);
assert.match(catalogConfigService, /stock_quantity/, 'catalog config must use products.stock_quantity');
assert.match(catalogProductCard, /product\.stock_quantity/, 'catalog product card must use products.stock_quantity');
assert.match(catalogModernProductCard, /product\.stock_quantity|p\.stock_quantity/, 'modern catalog card must use products.stock_quantity');
assert.match(publicProductPage, /product\.stock_quantity|sib\.stock_quantity/, 'public product page must use products.stock_quantity');

assertNoInternalStockLocations('Catalog service', catalogService);
assertNoInternalStockLocations('Catalog config service', catalogConfigService);
assertNoInternalStockLocations('Catalog product card', catalogProductCard);
assertNoInternalStockLocations('Modern catalog product card', catalogModernProductCard);
assertNoInternalStockLocations('Public product page', publicProductPage);

assert.match(
  shopeeService,
  /body:\s*JSON\.stringify\(\{\s*action:\s*['"]update_stock['"],\s*product_id:\s*productId,\s*stock:\s*newStock\s*\}\)/,
  'Shopee service must send only total stock value to update_stock'
);

assert.match(
  shopeeActions,
  /normal_stock:\s*product\.track_inventory\s*\?\s*product\.stock_quantity\s*:\s*999/,
  'Shopee add_item payload must use product.stock_quantity as normal_stock'
);

assert.match(
  shopeeActions,
  /stock_list:[\s\S]*normal_stock:\s*stock/,
  'Shopee update_stock payload must use the total stock argument'
);

assert.match(
  productsService,
  /shopeeService\.updateStock\(id,\s*input\.stock_quantity\s*\|\|\s*0\)/,
  'product edits must send products.stock_quantity to Shopee'
);

assertNoInternalStockLocations('Shopee service', shopeeService);
assertNoInternalStockLocations('Shopee actions', shopeeActions);

assert.match(estoque, /Garantir que Bling receba estoque total\./, 'Estoque.md must keep Bling checklist item');
assert.match(estoque, /Garantir que VPS receba estoque total\./, 'Estoque.md must keep VPS checklist item');
assert.match(estoque, /Garantir que catalogo leia estoque total\./, 'Estoque.md must keep catalog checklist item');
assert.match(estoque, /Garantir que Shopee nao receba local interno\./, 'Estoque.md must keep Shopee checklist item');

console.log('external integrations total stock static checks passed');

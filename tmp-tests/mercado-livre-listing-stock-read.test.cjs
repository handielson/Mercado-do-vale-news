const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createListingStockHandlers } = require('../services/mercadoLivreListingStock.cjs');
const { deployMercadoLivreStockRead } = require('../scripts/deploy-mercado-livre-stock-read.cjs');

const itemId = 'MLB4282518399';
const parentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sellerId = '416389239';

function response(body, headers = {}) {
  return { json: async () => body, headers: { get: name => headers[name.toLowerCase()] || null } };
}

function harness({ linked = [{ id: 'product-1', sku: 'LJH074', variation_id: '' }], familyProducts = [], item, user,
  userProductStock, stockHeaders = {} }) {
  const calls = [];
  const dbQueries = [];
  let queryCount = 0;
  const pool = { query: async (sql, values) => {
    dbQueries.push({ sql, values });
    queryCount += 1;
    return [queryCount === 1 ? linked : familyProducts];
  } };
  const request = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url.startsWith(`/items/${itemId}?`)) return response(item);
    if (url === `/users/${sellerId}`) return response(user);
    if (url === `/user-products/${item.user_product_id}/stock`) return response(userProductStock, stockHeaders);
    throw new Error(`Unexpected Mercado Livre API path: ${url}`);
  };
  return {
    calls,
    dbQueries,
    read: createListingStockHandlers({ pool, settings: async () => ({ user_id: sellerId }), request }).read,
  };
}

test('reads traditional listing quantity through GET only', async () => {
  const h = harness({
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      condition: 'new', listing_type_id: 'gold_special', available_quantity: 0, variations: [] },
    user: { id: sellerId, tags: [] },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });

  assert.equal(result.mode, 'item_available_quantity');
  assert.equal(result.quantityByVariation, true);
  assert.equal(result.condition, 'new');
  assert.equal(result.listingTypeId, 'gold_special');
  assert.deepEqual(result.quantities, [{ variationId: '', sku: 'LJH074', quantity: 0 }]);
  assert.equal(h.dbQueries.length, 1);
  assert.match(h.dbQueries[0].sql, /^\s*SELECT/i);
  assert.ok(h.calls.length >= 2);
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('returns only valid listing condition and type values for ERP zero-stock preflight', async () => {
  const h = harness({
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      condition: 'not_specified', listing_type_id: 'free', available_quantity: 2, variations: [] },
    user: { id: sellerId, tags: [] },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });
  assert.equal(result.condition, 'not_specified');
  assert.equal(result.listingTypeId, 'free');
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('does not expose malformed listing type as evidence that zero stock is allowed', async () => {
  const h = harness({
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      condition: 'new', listing_type_id: '123', available_quantity: 2, variations: [] },
    user: { id: sellerId, tags: [] },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });
  assert.equal(result.condition, 'new');
  assert.equal(result.listingTypeId, '');
});

test('shares only an in-flight seller-profile GET across concurrent stock reads', async () => {
  const itemIds = [itemId, 'MLB4282518400'];
  const calls = [];
  let releaseSeller;
  let markSellerStarted;
  let releaseItems;
  let markItemsStarted;
  const sellerStarted = new Promise(resolve => { markSellerStarted = resolve; });
  const sellerGate = new Promise(resolve => { releaseSeller = resolve; });
  const itemsStarted = new Promise(resolve => { markItemsStarted = resolve; });
  const itemsGate = new Promise(resolve => { releaseItems = resolve; });
  const pool = { query: async () => [[{ id: 'product-1', sku: 'LJH074', variation_id: '' }]] };
  const request = async url => {
    calls.push(url);
    if (url.startsWith('/items/bulk?ids=')) {
      markItemsStarted();
      await itemsGate;
      const ids = url.slice('/items/bulk?ids='.length).split(',');
      return response(ids.map(id => ({ id, status_code: 200, body: { id, seller_id: sellerId,
        status: 'active', sub_status: [], tags: [],
        available_quantity: id === itemIds[0] ? 3 : 5, variations: [] } })));
    }
    if (url.startsWith('/items/')) {
      const remoteItemId = url.slice('/items/'.length).split('?')[0];
      return response({ id: remoteItemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
        available_quantity: remoteItemId === itemIds[0] ? 3 : 5, variations: [] });
    }
    if (url === `/users/${sellerId}`) {
      markSellerStarted();
      await sellerGate;
      return response({ id: sellerId, tags: [] });
    }
    throw new Error(`Unexpected Mercado Livre API path: ${url}`);
  };
  const read = createListingStockHandlers({ pool, settings: async () => ({ user_id: sellerId }), request }).read;
  const readFirst = read({ params: { itemId: itemIds[0] }, query: { parentId } });
  const readSecond = read({ params: { itemId: itemIds[1] }, query: { parentId } });

  await Promise.all([sellerStarted, itemsStarted]);
  assert.equal(calls.filter(url => url.startsWith('/items/bulk?ids=')).length, 1);
  assert.equal(calls.filter(url => url === `/users/${sellerId}`).length, 1);
  releaseItems();
  releaseSeller();
  const [first, second] = await Promise.all([readFirst, readSecond]);
  assert.deepEqual(first.quantities.map(row => row.quantity), [3]);
  assert.deepEqual(second.quantities.map(row => row.quantity), [5]);
  assert.equal(calls.filter(url => url.startsWith('/items/bulk?ids=')).length, 1);

  await read({ params: { itemId: itemIds[0] }, query: { parentId } });
  assert.equal(calls.filter(url => url === `/users/${sellerId}`).length, 2,
    'the seller profile must be fetched again after the concurrent request completes');
  assert.equal(calls.filter(url => url === `/items/${itemIds[0]}?include_attributes=all`).length, 1,
    'a standalone read keeps the single-item endpoint');
  assert.ok(calls.every(url => !url.includes('?') || url.startsWith('/items/')));
});

test('coalesces stock reads that arrive while ERP finishes staggered local checks', async () => {
  const itemIds = [itemId, 'MLB4282518400', 'MLB4282518401', 'MLB4282518402', 'MLB4282518403'];
  const calls = [];
  let queryIndex = 0;
  const pool = { query: async () => {
    const delay = queryIndex++ * 30;
    await new Promise(resolve => setTimeout(resolve, delay));
    return [[{ id: 'product-1', sku: 'LJH074', variation_id: '' }]];
  } };
  const request = async url => {
    calls.push(url);
    if (url.startsWith('/items/bulk?ids=')) {
      const ids = url.slice('/items/bulk?ids='.length).split(',');
      return response(ids.map(id => ({ id, status_code: 200, body: { id, seller_id: sellerId,
        status: 'active', sub_status: [], tags: [], available_quantity: 1, variations: [] } })));
    }
    if (url.startsWith('/items/')) throw new Error('A staggered group should use the bulk endpoint.');
    if (url === `/users/${sellerId}`) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return response({ id: sellerId, tags: [] });
    }
    throw new Error(`Unexpected Mercado Livre API path: ${url}`);
  };
  const read = createListingStockHandlers({ pool, settings: async () => ({ user_id: sellerId }), request }).read;

  const results = await Promise.all(itemIds.map(remoteId =>
    read({ params: { itemId: remoteId }, query: { parentId } })));

  assert.equal(results.length, 5);
  assert.ok(results.every(result => result.quantities[0].quantity === 1));
  assert.equal(calls.filter(url => url.startsWith('/items/bulk?ids=')).length, 1);
  assert.equal(calls.filter(url => url.startsWith('/items/')).length, 1);
  assert.equal(calls.filter(url => url === `/users/${sellerId}`).length, 1);
});

test('isolates one failed item in an otherwise successful bulk read', async () => {
  const ids = [itemId, 'MLB4282518400'];
  const calls = [];
  const pool = { query: async () => [[{ id: 'product-1', sku: 'LJH074', variation_id: '' }]] };
  const request = async url => {
    calls.push(url);
    if (url.startsWith('/items/bulk?ids=')) return response([
      { id: ids[0], status_code: 200, body: { id: ids[0], seller_id: sellerId,
        status: 'active', sub_status: [], tags: [], available_quantity: 3, variations: [] } },
      { id: ids[1], status_code: 404, body: { message: 'not found' } },
    ]);
    if (url === `/users/${sellerId}`) return response({ id: sellerId, tags: [] });
    throw new Error(`Unexpected Mercado Livre API path: ${url}`);
  };
  const read = createListingStockHandlers({ pool, settings: async () => ({ user_id: sellerId }), request }).read;
  const results = await Promise.allSettled(ids.map(remoteId =>
    read({ params: { itemId: remoteId }, query: { parentId } })));

  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[0].value.quantities[0].quantity, 3);
  assert.equal(results[1].status, 'rejected');
  assert.match(results[1].reason.message, /não confirmou um dos anúncios/);
  assert.equal(calls.filter(url => url.startsWith('/items/bulk?ids=')).length, 1);
  assert.equal(calls.filter(url => url === `/users/${sellerId}`).length, 1);
});

test('maps variation quantities to the exact locally linked SKUs', async () => {
  const h = harness({
    linked: [
      { id: 'product-1', sku: 'PHONE-BLK', variation_id: '11' },
      { id: 'product-2', sku: 'PHONE-WHT', variation_id: '12' },
    ],
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      variations: [{ id: 11, available_quantity: 3 }, { id: 12, available_quantity: 2 }] },
    user: { id: sellerId, tags: [] },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });

  assert.deepEqual(result.quantities, [
    { variationId: '11', sku: 'PHONE-BLK', quantity: 3 },
    { variationId: '12', sku: 'PHONE-WHT', quantity: 2 },
  ]);
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('reads an unlinked single-item listing by exact catalog SKU without persisting a link', async () => {
  const h = harness({
    linked: [],
    familyProducts: [{ id: 'product-1', sku: 'LJH074' }, { id: 'product-2', sku: 'OTHER' }],
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      attributes: [{ id: 'SELLER_SKU', value_name: 'ljh074' }], available_quantity: 4, variations: [] },
    user: { id: sellerId, tags: [] },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });

  assert.equal(result.matchMethod, 'exact_catalog_sku_read_only');
  assert.deepEqual(result.quantities, [{ variationId: '', sku: 'LJH074', quantity: 4 }]);
  assert.equal(h.dbQueries.length, 2);
  assert.ok(h.dbQueries.every(query => /^\s*SELECT/i.test(query.sql)));
  assert.match(h.dbQueries[1].sql, /COALESCE\(is_parent,0\)=0/);
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('fetches seller profile while validating an unlinked exact-SKU listing', async () => {
  let releaseItem;
  let markItemStarted;
  let markSellerStarted;
  const itemGate = new Promise(resolve => { releaseItem = resolve; });
  const itemStarted = new Promise(resolve => { markItemStarted = resolve; });
  const sellerStarted = new Promise(resolve => { markSellerStarted = resolve; });
  const calls = [];
  let queryCount = 0;
  const pool = { query: async () => [++queryCount === 1 ? [] : [
    { id: 'product-1', sku: 'LJH074' }, { id: 'product-2', sku: 'OTHER' },
  ]] };
  const request = async url => {
    calls.push(url);
    if (url.startsWith(`/items/${itemId}?`)) {
      markItemStarted();
      await itemGate;
      return response({ id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
        attributes: [{ id: 'SELLER_SKU', value_name: 'LJH074' }], available_quantity: 4, variations: [] });
    }
    if (url === `/users/${sellerId}`) {
      markSellerStarted();
      return response({ id: sellerId, tags: [] });
    }
    throw new Error(`Unexpected Mercado Livre API path: ${url}`);
  };
  const read = createListingStockHandlers({ pool, settings: async () => ({ user_id: sellerId }), request }).read;
  const pending = read({ params: { itemId }, query: { parentId } });

  await Promise.all([itemStarted, sellerStarted]);
  assert.equal(calls.length, 2);
  releaseItem();
  const result = await pending;
  assert.equal(result.matchMethod, 'exact_catalog_sku_read_only');
  assert.deepEqual(result.quantities, [{ variationId: '', sku: 'LJH074', quantity: 4 }]);
});

test('reads only variations with an exact unique family SKU match', async () => {
  const h = harness({
    linked: [],
    familyProducts: [{ id: 'product-1', sku: 'PHONE-BLK' }, { id: 'product-2', sku: 'PHONE-WHT' }],
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [], variations: [
      { id: 11, attributes: [{ id: 'SELLER_SKU', value_name: 'phone-blk' }], available_quantity: 3 },
      { id: 12, seller_custom_field: 'PHONE-WHT', available_quantity: 99 },
      { id: 13, attributes: [{ id: 'SELLER_SKU', value_name: 'PHONE-WHT' }], available_quantity: 2 },
    ] },
    user: { id: sellerId, tags: [] },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });

  assert.deepEqual(result.quantities, [
    { variationId: '11', sku: 'PHONE-BLK', quantity: 3 },
    { variationId: '13', sku: 'PHONE-WHT', quantity: 2 },
  ]);
  assert.equal(result.matchMethod, 'exact_catalog_sku_read_only');
});

test('rejects ambiguous SKUs and oversized families without querying remote stock', async () => {
  const duplicate = harness({
    linked: [],
    familyProducts: [{ id: 'product-1', sku: 'DUPLICATE' }, { id: 'product-2', sku: 'duplicate' }],
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      attributes: [{ id: 'SELLER_SKU', value_name: 'duplicate' }], available_quantity: 1, variations: [] },
    user: { id: sellerId, tags: [] },
  });
  await assert.rejects(duplicate.read({ params: { itemId }, query: { parentId } }), error => {
    assert.equal(error.statusCode, 409);
    assert.match(error.message, /mais de um produto/);
    return true;
  });
  assert.equal(duplicate.calls.filter(call => call.url.startsWith(`/items/${itemId}?`)).length, 1);
  assert.equal(duplicate.calls.filter(call => call.url === `/users/${sellerId}`).length, 1);
  assert.equal(duplicate.calls.some(call => call.url.startsWith('/user-products/')), false);

  const oversized = harness({
    linked: [],
    familyProducts: Array.from({ length: 201 }, (_, index) => ({ id: `product-${index}`, sku: `SKU-${index}` })),
  });
  await assert.rejects(oversized.read({ params: { itemId }, query: { parentId } }), error => {
    assert.equal(error.statusCode, 409);
    assert.match(error.message, /excede 200 produtos/);
    return true;
  });
  assert.equal(oversized.calls.length, 0);
});

test('does not treat seller_custom_field as the listing SKU', async () => {
  const h = harness({
    linked: [],
    familyProducts: [{ id: 'product-1', sku: 'PHONE-WHT' }],
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      seller_custom_field: 'PHONE-WHT', available_quantity: 5, variations: [] },
    user: { id: sellerId, tags: [] },
  });
  await assert.rejects(h.read({ params: { itemId }, query: { parentId } }), error => {
    assert.equal(error.statusCode, 409);
    assert.match(error.message, /não corresponde a um produto único/);
    return true;
  });
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('reads seller warehouse and Full locations without assigning them to a product SKU', async () => {
  const h = harness({
    linked: [{ id: 'product-1', sku: 'LJH074', variation_id: '77' }],
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      user_product_id: 'MLBU123', variations: [{ id: 77 }] },
    user: { id: sellerId, tags: ['warehouse_management'] },
    userProductStock: { id: 'MLBU123', user_id: sellerId, locations: [
      { type: 'seller_warehouse', store_id: '10', network_node_id: 'node-a', quantity: 3 },
      { type: 'meli_facility', store_id: 'full', network_node_id: 'node-b', quantity: 8 },
    ] },
    stockHeaders: { 'x-version': '17' },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });

  assert.equal(result.mode, 'warehouse_management');
  assert.equal(result.quantityByVariation, false);
  assert.equal(result.stockVersion, '17');
  assert.deepEqual(result.locations.map(row => [row.type, row.quantity]), [
    ['seller_warehouse', 3], ['meli_facility', 8],
  ]);
  assert.ok(result.reason.includes('não atribua esses valores a um SKU'));
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('reads unlinked User Product locations even when no exact SKU is available', async () => {
  const h = harness({
    linked: [],
    familyProducts: [{ id: 'product-1', sku: 'LJH074' }],
    item: { id: itemId, seller_id: sellerId, status: 'active', sub_status: [], tags: [],
      user_product_id: 'MLBU123', variations: [{ id: 77 }] },
    user: { id: sellerId, tags: ['warehouse_management'] },
    userProductStock: { id: 'MLBU123', user_id: sellerId, locations: [
      { type: 'seller_warehouse', store_id: '10', network_node_id: 'node-a', quantity: 3 },
      { type: 'meli_facility', store_id: 'full', network_node_id: 'node-b', quantity: 8 },
    ] },
  });
  const result = await h.read({ params: { itemId }, query: { parentId } });

  assert.equal(result.mode, 'warehouse_management');
  assert.equal(result.matchMethod, 'warehouse_location_only');
  assert.deepEqual(result.locations.map(row => [row.type, row.quantity]), [
    ['seller_warehouse', 3], ['meli_facility', 8],
  ]);
  assert.deepEqual(result.variations, [{ id: '77', sku: '' }]);
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('rejects a listing owned by another Mercado Livre seller', async () => {
  const h = harness({
    item: { id: itemId, seller_id: '999', status: 'active', sub_status: [], tags: [],
      available_quantity: 1, variations: [] },
    user: { id: sellerId, tags: [] },
  });
  await assert.rejects(h.read({ params: { itemId }, query: { parentId } }), /não pertence à conta/);
  assert.ok(h.calls.every(call => call.method === 'GET'));
});

test('registers listing stock writes behind a dedicated key and advertises only implemented stock capabilities', () => {
  const server = fs.readFileSync(path.join(__dirname, '../services/mercadoLivreServer.cjs'), 'utf8');
  assert.match(server, /registerAliases\(fastify, 'get', '\/mercado-livre\/products\/items\/:itemId\/stock', erpReadRoute, presentListingError\(listingStock\.read\)\)/);
  assert.match(server, /registerAliases\(fastify, 'post', '\/mercado-livre\/products\/items\/:itemId\/stock', erpWriteRoute, presentListingError\(listingStock\.update\)\)/);
  assert.match(server, /registerAliases\(fastify, 'post', '\/mercado-livre\/products\/user-products\/:userProductId\/stock', erpWriteRoute, presentListingError\(listingStock\.updateWarehouse\)\)/);
  assert.match(server, /'listing_stock_write_v1'[\s\S]*'user_product_stock_write_v1'/);
  assert.doesNotMatch(server.match(/const ERP_STOCK_WRITE_CAPABILITIES = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || '', /listing_price_write_v1/);
  assert.match(server, /request\.headers\['x-erp-write-key'\]/);
});

test('read-only stock deploy backs up and replaces only the stock module without touching env or price/publication services', async () => {
  const deployEntry = fs.readFileSync(path.join(__dirname, '../deploy-vps-server-only.cjs'), 'utf8');
  assert.match(deployEntry, /process\.argv\.includes\('--mercado-livre-stock-read-only'\)[\s\S]*deployMercadoLivreStockRead/);
  const events = [];
  const result = await deployMercadoLivreStockRead({
    appDir: '/var/www/mdv-api',
    apiProc: { name: 'mdv-api' },
    root: 'C:/candidate',
    exec: async command => { events.push(['exec', command]); return ''; },
    upload: async (source, destination) => events.push(['upload', source, destination]),
  });

  assert.equal(result.target, '/var/www/mdv-api/services/mercadoLivreListingStock.cjs');
  assert.deepEqual(events.map(event => event[0]), ['exec', 'exec', 'upload', 'exec', 'exec', 'exec', 'exec']);
  assert.equal(events[2][1], path.join('C:/candidate', 'services/mercadoLivreListingStock.cjs'));
  assert.match(events[0][1], /backups\/mercado-livre-stock-read-/);
  assert.match(events[1][1], /cp -p .*mercadoLivreListingStock\.cjs/);
  assert.match(events[3][1], /node --check .*mercadoLivreListingStock\.cjs\.next\.cjs/);
  assert.match(events[4][1], /mv .*mercadoLivreListingStock\.cjs\.next\.cjs .*mercadoLivreListingStock\.cjs/);
  assert.equal(events[5][1], 'pm2 restart mdv-api');
  assert.match(events[6][1], /rm -f .*mercadoLivreListingStock\.cjs\.next\.cjs/);
  assert.ok(events.every(event => !event.slice(1).join(' ').includes('.env')));
  assert.ok(events.every(event => !/mercadoLivre(?:Server|Publication|ListingPrice)\.cjs/.test(event.slice(1).join(' '))));
});

test('read-only stock deploy refuses any target except the Mercado do Vale API', async () => {
  const events = [];
  await assert.rejects(deployMercadoLivreStockRead({
    appDir: '/var/www/other', apiProc: { name: 'other' },
    exec: async command => events.push(command), upload: async () => events.push('upload'),
  }), /Unexpected API target/);
  assert.deepEqual(events, []);
});

test('restores the backed-up stock module when the API restart fails', async () => {
  const events = [];
  let restarts = 0;
  await assert.rejects(deployMercadoLivreStockRead({
    appDir: '/var/www/mdv-api',
    apiProc: { name: 'mdv-api' },
    root: 'C:/candidate',
    exec: async command => {
      events.push(command);
      if (command === 'pm2 restart mdv-api' && restarts++ === 0) throw new Error('restart failed');
      return '';
    },
    upload: async () => events.push('upload'),
  }), /restart failed/);

  assert.ok(events.some(command => /cp -p .*backups\/mercado-livre-stock-read-.*mercadoLivreListingStock\.cjs .*services\/mercadoLivreListingStock\.cjs/.test(command)));
  assert.equal(events.filter(command => command === 'pm2 restart mdv-api').length, 2);
  assert.match(events.at(-1), /rm -f .*mercadoLivreListingStock\.cjs\.next\.cjs/);
});

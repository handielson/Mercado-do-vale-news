import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const quoteModal = readFileSync('components/catalog/QuoteModal.tsx', 'utf8');
const orderService = readFileSync('services/orderService.ts', 'utf8');
const stockLocationService = readFileSync('services/stockLocationService.ts', 'utf8');
const vps = readFileSync('vps_server.js', 'utf8');
const vpsCjs = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  quoteModal,
  /onClick=\{handleCreateDeliveryOrder\}/,
  'cart Fazer Pedido button must keep creating the delivery order',
);

assert.match(
  orderService,
  /vpsClient\.post<Order>\('\/table-data\/orders'/,
  'createOrder must persist orders through the VPS client',
);

assert.match(
  orderService,
  /vpsClient\.post\('\/table-data\/order_items\/bulk'/,
  'createOrder must persist order items through the VPS client',
);

assert.match(
  stockLocationService,
  /vpsClient\.post<StockLocationPriorityReservationResult\[\]>\('\/stock-locations\/priority-reservations'/,
  'createOrder must reserve stock through the VPS client after creating items',
);

for (const [file, source] of [
  ['vps_server.js', vps],
  ['vps_server.cjs', vpsCjs],
]) {
  assert.match(
    source,
    /function isVpsProxyCustomerOrderWritePath/,
    `${file} must have a narrow customer order write allowlist for cart checkout`,
  );

  assert.match(
    source,
    /await assertVpsProxyCustomerOrderWriteAllowed/,
    `${file} proxy must validate customer ownership before injecting the internal sync key`,
  );

  assert.match(
    source,
    /pathname === '\/table-data\/orders'/,
    `${file} must allow authenticated customers to create their own order row through the proxy`,
  );

  assert.match(
    source,
    /pathname === '\/table-data\/order_items\/bulk'/,
    `${file} must allow authenticated customers to create items only for their own order`,
  );

  assert.match(
    source,
    /pathname === '\/stock-locations\/priority-reservations'/,
    `${file} must allow authenticated customers to reserve stock for their own new order`,
  );

  assert.match(
    source,
    /auth\.customerId !== String\(body\.customer_id \|\| ''\)/,
    `${file} must block customers from creating orders for another customer`,
  );

  assert.match(
    source,
    /SELECT customer_id FROM orders WHERE id IN/,
    `${file} must validate order ownership for order_items and reservation rollback paths`,
  );
}

console.log('cart create order customer proxy static checks passed');

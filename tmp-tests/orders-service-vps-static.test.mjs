import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/orderService.ts', 'utf8');
const adminOrdersPage = readFileSync('pages/admin/orders/OnlineOrdersPage.tsx', 'utf8');
const checkoutPage = readFileSync('pages/store/CheckoutPage.tsx', 'utf8');
const trackingPage = readFileSync('pages/store/OrderTrackingPage.tsx', 'utf8');
const confirmationPage = readFileSync('pages/store/OrderConfirmationPage.tsx', 'utf8');
const serializedUnitsPage = readFileSync('pages/admin/inventory/SerializedUnitsPage.tsx', 'utf8');
const vpsServers = [
  readFileSync('vps_server.js', 'utf8'),
  readFileSync('vps_server.cjs', 'utf8'),
];

assert.match(source, /import \{ vpsClient \} from '\.\/vpsClient'/, 'orderService must use vpsClient for order persistence');
assert.match(source, /\/table-data\/orders/, 'orderService must persist orders through VPS table-data');
assert.match(source, /\/table-data\/order_items/, 'orderService must persist order items through VPS table-data');
assert.match(source, /loadOrderRows/, 'orderService should centralize paged order loading');
assert.match(source, /loadOrderItemsByOrderId/, 'orderService should centralize order item loading');
assert.match(source, /shipping_origin_cep:[\s\S]*shipping_origin_label:/, 'orderService must persist the origin selected for shipping');

for (const vpsSource of vpsServers) {
  assert.match(vpsSource, /addColumnIfMissing\('orders', 'shipping_origin_cep', 'VARCHAR\(16\) NULL'\)/, 'VPS migration must add the shipping origin CEP before checkout writes it');
  assert.match(vpsSource, /addColumnIfMissing\('orders', 'shipping_origin_label', 'VARCHAR\(255\) NULL'\)/, 'VPS migration must add the shipping origin label before checkout writes it');
}

assert.doesNotMatch(
  source,
  /\.from\(['"]orders['"]\)|supabase\.from\(['"]orders['"]\)/,
  'orderService must not read/write orders through Supabase',
);

assert.doesNotMatch(
  source,
  /\.from\(['"]order_items['"]\)|supabase\.from\(['"]order_items['"]\)/,
  'orderService must not read/write order_items through Supabase',
);

assert.match(
  adminOrdersPage,
  /import \{ getOrders, updateOrderStatus, completeOnDeliveryOrder, cancelOrder \} from '@\/services\/orderService'/,
  'admin online orders page must keep using the orderService contract',
);

assert.match(
  checkoutPage,
  /import \{ createOrder \} from '@\/services\/orderService'/,
  'public checkout must keep creating orders through orderService',
);

assert.match(
  trackingPage,
  /import \{ getOrderById \} from '@\/services\/orderService'/,
  'public tracking must keep reading orders through orderService',
);

assert.match(
  confirmationPage,
  /import \{ getOrderById \} from '@\/services\/orderService'/,
  'public confirmation must keep reading orders through orderService',
);

assert.match(
  serializedUnitsPage,
  /releaseSerializedDocsForOrder/,
  'admin serialized units page must release order docs through orderService',
);

assert.doesNotMatch(
  serializedUnitsPage,
  /\.from\(['"]orders['"]\)|supabase\.from\(['"]orders['"]\)/,
  'admin serialized units page must not update orders through Supabase',
);

console.log('orders service VPS static checks passed');

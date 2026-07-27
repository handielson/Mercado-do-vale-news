import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('services/dashboardSalesDigestService.js', 'utf8');
const ordersTab = readFileSync('pages/admin/settings/components/ShopeeOrdersTab.tsx', 'utf8');

assert.doesNotMatch(
  dashboard,
  /TO_CONFIRM_RECEIVE/,
  'the dashboard must not use the order status rejected by the current Shopee API',
);
assert.match(
  dashboard,
  /response\.next_cursor[\s\S]*response\.more && nextCursor[\s\S]*while \(cursor && pageCount < 20\)/,
  'the dashboard must follow every cursor returned by the Shopee order list',
);
assert.match(
  ordersTab,
  /page_size=100[\s\S]*next_cursor[\s\S]*while \(cursor && pageCount < 20\)/,
  'the Shopee orders tab must not truncate the list at its first page',
);
assert.match(
  ordersTab,
  /for \(let index = 0; index < orderSns\.length; index \+= 50\)[\s\S]*orderSns\.slice\(index, index \+ 50\)/,
  'order details must respect the Shopee limit of 50 order numbers per request',
);

console.log('Shopee order status and cursor pagination checks passed');

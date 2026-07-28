import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/components/ShopeeOrdersTab.tsx', 'utf8');

assert.match(
  page,
  /function writeOrdersCache|const writeOrdersCache[\s\S]*localStorage\.setItem[\s\S]*catch/,
  'Shopee order cache failures must not be reported as network failures',
);
assert.match(
  page,
  /action:\s*'ship_order'[\s\S]*order_sn:\s*orderSn/,
  'prepare shipment must send the action and order number in the request body',
);
assert.match(
  page,
  /fetch\('\/api\/shopee-actions',\s*\{\s*method: 'POST'[\s\S]*action:\s*'ship_order'/,
  'prepare shipment must use POST',
);
assert.match(
  page,
  /fetch\('\/api\/shopee-actions',\s*\{\s*method: 'POST'[\s\S]*action:\s*'get_shipping_document'/,
  'label creation must use POST because it creates a Shopee document task',
);
assert.match(page, /action:\s*'get_shipping_document'/, 'label POST must send the action in its JSON body');
assert.match(page, /order_sn:\s*orderSn/, 'label POST must send the order number in its JSON body');
assert.match(page, /full_page_a4:\s*true/, 'label POST must request an A4 full-page document');
assert.match(
  page,
  /data\.message \|\| data\.doc\?\.message \|\| data\.error/,
  'label errors must prefer the actionable Shopee message',
);

console.log('Shopee order cache and shipping label UI checks passed');

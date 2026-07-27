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
  /fetch\('\/api\/shopee-actions',\s*\{\s*method: 'POST'/,
  'label creation must use POST because it creates a Shopee document task',
);
assert.match(page, /action:\s*'get_shipping_document'/, 'label POST must send the action in its JSON body');
assert.match(page, /order_sn:\s*orderSn/, 'label POST must send the order number in its JSON body');
assert.match(
  page,
  /data\.message \|\| data\.doc\?\.message \|\| data\.error/,
  'label errors must prefer the actionable Shopee message',
);

console.log('Shopee order cache and shipping label UI checks passed');

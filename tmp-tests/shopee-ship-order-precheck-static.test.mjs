import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync('api/shopee-actions.ts', 'utf8');
const ordersTab = readFileSync('pages/admin/settings/components/ShopeeOrdersTab.tsx', 'utf8');

const shipOrderBlock = api.slice(api.indexOf("if (action === 'ship_order')"), api.indexOf("// O FLUXO DE SINCRONIZA"));

assert.match(
  shipOrderBlock,
  /\/api\/v2\/order\/get_order_detail/,
  'ship_order must validate order detail before calling logistics'
);

assert.match(
  shipOrderBlock,
  /order\.order_status !== 'READY_TO_SHIP'/,
  'ship_order must block orders that are not READY_TO_SHIP'
);

assert.match(
  shipOrderBlock,
  /\/api\/v2\/order\/get_package_detail/,
  'ship_order must validate package detail before calling logistics'
);

assert.match(
  shipOrderBlock,
  /fulfillmentStatus !== 'LOGISTICS_READY'/,
  'ship_order must block packages that are not LOGISTICS_READY'
);

assert.match(
  shipOrderBlock,
  /isShipmentArranged \|\| fulfillmentStatus === 'LOGISTICS_REQUEST_CREATED'/,
  'ship_order must not call Shopee again for already arranged shipments'
);

assert.match(
  shipOrderBlock,
  /package_number: resolvedPackageNumber/,
  'ship_order payload must include package_number'
);

assert.match(
  ordersTab,
  /params\.set\('package_number', packageNumber\)/,
  'orders UI must pass package_number when available'
);

console.log('shopee-ship-order-precheck-static.test.mjs: ok');

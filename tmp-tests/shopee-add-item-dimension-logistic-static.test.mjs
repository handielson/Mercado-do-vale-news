import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  source,
  /const packageDimension = \{\s*package_length: Math\.max\(1, Math\.round\(packageLength \|\| 20\)\),\s*package_width: Math\.max\(1, Math\.round\(packageWidth \|\| 15\)\),\s*package_height: Math\.max\(1, Math\.round\(packageHeight \|\| 10\)\),\s*\};/s,
  'Shopee add_item payload must build mandatory package dimension with safe fallbacks'
);

assert.match(
  source,
  /const logisticInfo = await collectShopeeLogisticInfo\(\);[\s\S]*logistic_info: logisticInfo/,
  'Shopee add_item payload must use logistic_info singular, not logistics_info'
);

assert.match(
  source,
  /getShopeeDebug\('logistics_channel_list', 'logistics_context:channel_list'\)/,
  'Shopee add_item must discover enabled logistics channels from Shopee before publishing'
);

assert.match(
  source,
  /enabled_channel_count: logisticInfo\.length/,
  'Shopee add_item must log how many enabled logistics channels were found'
);

const apiSource = fs.readFileSync('api/shopee-catalog.ts', 'utf8');
assert.match(
  apiSource,
  /action === 'logistics_channel_list'[\s\S]*\/api\/v2\/logistics\/get_channel_list/,
  'Shopee catalog proxy must expose logistics/get_channel_list'
);

assert.match(
  source,
  /dimension: packageDimension/,
  'Shopee add_item payload must include dimension'
);

assert.doesNotMatch(
  source,
  /logistics_info: \[\{ logistic_id: 80031, enabled: true \}\]/,
  'Shopee add_item payload must not use logistics_info plural'
);

console.log('shopee-add-item-dimension-logistic-static.test.mjs: ok');

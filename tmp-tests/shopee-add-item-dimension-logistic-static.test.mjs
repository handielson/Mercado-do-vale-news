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
  /logistic_info: \[\{ logistic_id: 80031, enabled: true \}\]/,
  'Shopee add_item payload must use logistic_info singular, not logistics_info'
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

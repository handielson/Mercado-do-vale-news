import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /async function listAutoresponderShippingPriceRanges\(\)/, `${file} must guard shipping_price_ranges schema`);
  assert.match(source, /SHOW COLUMNS FROM shipping_price_ranges/, `${file} must inspect shipping_price_ranges columns before using min_km`);
  assert.match(source, /if \(!columnNames\.has\('min_km'\)\) return \[\];/, `${file} must skip range pricing when min_km is absent`);
  assert.match(source, /const ranges = await listAutoresponderShippingPriceRanges\(\);/, `${file} autoresponder shipping options must use guarded range loader`);
}

console.log('autoresponder shipping ranges schema guard static checks passed');

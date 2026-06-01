import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const server = readFileSync('vps_server.js', 'utf8');

[
  'catalog_sections',
  'custom_fields',
  'cashback_settings',
  'product_reviews',
  'coin_balances',
  'coin_transactions',
  'checkin_logs',
  'model_color_images',
].forEach((table) => {
  assert.match(
    server,
    new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`),
    `VPS migrations must create ${table} because frontend services read it through /table-data`
  );
});

assert.match(
  server,
  /INSERT IGNORE INTO cashback_settings/,
  'cashback_settings must be seeded so public product pages do not fail on an empty table'
);

assert.match(
  server,
  /INSERT IGNORE INTO catalog_sections[\s\S]*Mais Recentes[\s\S]*Destaques[\s\S]*Mais Vendidos/,
  'catalog_sections must seed the homepage sections that disappeared after the VPS migration'
);

console.log('VPS public catalog support table migrations static checks passed');

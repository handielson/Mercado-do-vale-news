import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(file, 'utf8');
  const byIdsIndex = source.indexOf("fastify.get('/products/by-ids'");
  const byIdIndex = source.indexOf("fastify.get('/products/:id'");

  assert.notEqual(byIdsIndex, -1, `${file} must expose /products/by-ids`);
  assert.notEqual(byIdIndex, -1, `${file} must keep /products/:id`);
  assert(byIdsIndex < byIdIndex, `${file} must register /products/by-ids before /products/:id`);

  const route = source.slice(byIdsIndex, byIdIndex);
  assert.match(route, /String\(req\.query\?\.ids \|\| ''\)/, `${file} must read ids from query string`);
  assert.match(route, /slice\(0,\s*100\)/, `${file} must cap batch lookup at 100 ids`);
  assert.match(route, /WHERE id IN \(\$\{placeholders\}\)/, `${file} must query products by id list`);
  assert.match(route, /ORDER BY FIELD\(id, \$\{placeholders\}\)/, `${file} must preserve requested id order`);
  assert.match(route, /comboStockSql\('products'\)[\s\S]*AS stock_quantity/, `${file} must return combo-aware stock`);
}

console.log('vps products by-ids Fastify route static checks ok');

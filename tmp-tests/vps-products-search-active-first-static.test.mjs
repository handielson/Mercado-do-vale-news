import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  const routeStart = source.indexOf("fastify.get('/products'");
  const routeEnd = source.indexOf("fastify.get('/products/by-ids'", routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart, `${file} must expose /products before /products/by-ids`);

  const route = source.slice(routeStart, routeEnd);
  assert.match(route, /ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END/, `${file} product search must sort active rows before inactive duplicates`);
  assert.match(route, /CASE WHEN \(is_parent = 0 OR is_parent IS NULL\) THEN 0 ELSE 1 END/, `${file} product search must sort real products before parent/placeholder duplicates`);
  assert.match(route, /\$\{sortBy\} \$\{sortDir\}/, `${file} product search must keep requested sort after duplicate-safe priority`);
}

console.log('vps products search active-first static checks ok');

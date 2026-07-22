import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const routeStart = source.indexOf("fastify.get('/products/by-slug/:slug'");
  const routeEnd = source.indexOf("fastify.get('/products/by-ean/:ean'", routeStart);
  const route = source.slice(routeStart, routeEnd);

  assert.ok(routeStart >= 0 && routeEnd > routeStart, `${file}: by-slug route must exist`);
  assert.match(route, /SELECT \*,[\s\S]*FROM products[\s\S]*WHERE parent_id = \?/, `${file}: selected variant must include the complete product`);
  assert.match(route, /if \(variant\.slug === slugParam\)/, `${file}: shared parent/variant slug must be detected`);
  assert.match(route, /if \(variant\.slug === slugParam\)[\s\S]*return \{[\s\S]*\.\.\.variant,[\s\S]*images:/, `${file}: shared slug must return the selected variant directly`);
  assert.match(route, /redirect_to_slug: variant\.slug/, `${file}: distinct child slugs must keep the canonical redirect`);
}

console.log('product parent shared slug static checks passed');

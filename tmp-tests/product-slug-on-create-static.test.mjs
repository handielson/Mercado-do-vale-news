import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const server = readFileSync(file, 'utf8');
  const batch = server.slice(server.indexOf("fastify.post('/products/batch'"), server.indexOf("fastify.post('/products/batch'") + 12000);
  assert.match(batch, /product-slug-on-create-v1/, `${file}: /products/batch gera slug`);
  assert.match(batch, /!String\(p\.slug \|\| ''\)\.trim\(\) && !optionalBool\(p\.is_parent\)/, `${file}: so produto sem slug e nao pai`);
  assert.match(batch, /SELECT slug FROM products WHERE id=\? LIMIT 1/, `${file}: nao troca slug ja existente`);
  assert.match(batch, /SELECT id FROM products WHERE slug=\? AND id<>\? LIMIT 1/, `${file}: slug unico`);
  assert.ok(batch.indexOf('product-slug-on-create-v1') < batch.indexOf('withProductSku'), `${file}: slug antes do INSERT`);
}
console.log('product slug on create static checks passed');

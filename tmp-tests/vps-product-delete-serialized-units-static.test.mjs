import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = read(file);
  const routeStart = source.indexOf("fastify.delete('/products/:id'");
  const routeEnd = source.indexOf('// Update images by SKU', routeStart);
  assert(routeStart >= 0 && routeEnd > routeStart, `${file}: product deletion route not found`);

  const route = source.slice(routeStart, routeEnd);
  assert(route.includes('await connection.beginTransaction();'), `${file}: deletion must be transactional`);
  assert(route.includes("'SELECT id FROM products WHERE id=? OR parent_id=?'"), `${file}: deletion must include variations`);
  assert(route.includes('DELETE FROM units WHERE product_id IN'), `${file}: serialized units must be removed`);
  assert(route.includes('DELETE FROM products WHERE id IN'), `${file}: products must be removed after units`);
  assert(route.indexOf('DELETE FROM units WHERE product_id IN') < route.indexOf('DELETE FROM products WHERE id IN'), `${file}: units must be deleted before products`);
  assert(route.includes('await connection.commit();'), `${file}: transaction must commit`);
  assert(route.includes('await connection.rollback();'), `${file}: transaction must roll back on failure`);
}

console.log('vps-product-delete-serialized-units-static: ok');

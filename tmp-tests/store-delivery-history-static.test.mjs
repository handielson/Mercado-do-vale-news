import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const saleService = readFileSync('services/saleService.ts', 'utf8');
const activity = readFileSync('android/entregas/app/src/main/java/br/com/mercadodovale/entregas/MainActivity.kt', 'utf8');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const server = readFileSync(file, 'utf8');
  assert.match(server, /STORE_UNASSIGNED_DELIVERY_PERSON_ID\s*=\s*'store:unassigned'/);
  assert.match(server, /\['store_delivery', 'hybrid_delivery'\]\.includes\(deliveryType\)/);
  assert.match(server, /deliveryType === 'store_delivery'\s*\? STORE_UNASSIGNED_DELIVERY_PERSON_ID/);
  assert.match(server, /fastify\.post\('\/delivery\/app\/jobs\/:jobId\/assign'/);
  assert.match(server, /Entrega da loja exige identificar quem realizou a entrega/);
  assert.match(server, /delivery_people:/);
  assert.match(server, /delivery_summary:/);
  assert.match(server, /delivery_person_name/);
}

assert.match(
  saleService,
  /saleInput\.delivery_type === 'store_delivery'[\s\S]{0,180}\/delivery\/jobs\/from-sale/,
  'store delivery must create its history job even while the store is preselected',
);
assert.match(activity, /delivery_people/);
assert.match(activity, /delivery_summary/);
assert.match(activity, /\/delivery\/app\/jobs\/\$jobId\/assign/);
assert.match(activity, /Definir quem entregou/);

console.log('store delivery history static checks passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const activity = readFileSync('android/entregas/app/src/main/java/br/com/mercadodovale/entregas/MainActivity.kt', 'utf8');
const gradle = readFileSync('android/entregas/app/build.gradle.kts', 'utf8');
const manifest = readFileSync('android/entregas/app/src/main/AndroidManifest.xml', 'utf8');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const server = readFileSync(file, 'utf8');
  assert.match(server, /fastify\.get\('\/delivery\/app\/jobs', \{ preHandler: requireSyncKeyOrCustomer \}/);
  assert.match(server, /delivery_person_customer_id = \?/);
  assert.match(server, /is_delivery_worker/);
  assert.match(server, /Acesso exclusivo do entregador/);
}

assert.match(gradle, /applicationId = "br\.com\.mercadodovale\.entregas"/);
assert.match(gradle, /versionCode = 1/);
assert.match(manifest, /Mercado do Vale Entregas/);
assert.doesNotMatch(activity + gradle, /x-sync-key|SYNC_SECRET|VITE_VPS_SYNC_KEY/);
assert.match(activity, /\/auth\/login/);
assert.match(activity, /\/delivery\/app\/jobs\?status=/);
assert.match(activity, /\/delivery\/\$\{Uri\.encode\(token\)\}/);
assert.match(activity, /onShowFileChooser/);

console.log('android delivery app contract checks passed');

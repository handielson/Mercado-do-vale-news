import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const activity = readFileSync('android/entregas/app/src/main/java/br/com/mercadodovale/entregas/MainActivity.kt', 'utf8');
const gradle = readFileSync('android/entregas/app/build.gradle.kts', 'utf8');
const manifest = readFileSync('android/entregas/app/src/main/AndroidManifest.xml', 'utf8');
const locationService = readFileSync('android/entregas/app/src/main/java/br/com/mercadodovale/entregas/LocationTrackingService.kt', 'utf8');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const server = readFileSync(file, 'utf8');
  assert.match(server, /fastify\.get\('\/delivery\/app\/jobs', \{ preHandler: requireSyncKeyOrCustomer \}/);
  assert.match(server, /delivery_person_customer_id = \?/);
  assert.match(server, /is_delivery_worker/);
  assert.match(server, /access\.isAdmin \? '1 = 1' : 'delivery_person_customer_id = \?'/);
  assert.match(server, /name: 'Loja Mercado do Vale', type: 'store'/);
}

assert.match(gradle, /applicationId = "br\.com\.mercadodovale\.entregas"/);
assert.match(gradle, /versionCode = 4/);
assert.match(manifest, /Mercado do Vale Entregas/);
assert.doesNotMatch(activity + gradle, /x-sync-key|SYNC_SECRET|VITE_VPS_SYNC_KEY/);
assert.match(activity, /\/auth\/login/);
assert.match(activity, /\/delivery\/app\/jobs\?status=/);
assert.match(activity, /\/delivery\/\$\{Uri\.encode\(token\)\}/);
assert.match(activity, /onShowFileChooser/);
assert.match(activity, /WindowInsetsCompat\.Type\.systemBars\(\)/);
assert.match(activity, /setSafeContentView\(root\)/);
assert.match(activity, /optString\("sale_id"\)\.take\(8\)\.uppercase\(\)/);
assert.match(manifest, /ACCESS_FINE_LOCATION/);
assert.match(manifest, /FOREGROUND_SERVICE_LOCATION/);
assert.match(manifest, /POST_NOTIFICATIONS/);
assert.match(manifest, /foregroundServiceType="location"/);
assert.match(activity, /addJavascriptInterface\(DeliveryBridge\(\), "MdvDelivery"\)/);
assert.match(locationService, /delivery\/app\/jobs\/\$jobId\/location/);
assert.match(locationService, /startForeground\(NOTIFICATION_ID, notification\)/);

console.log('android delivery app contract checks passed');

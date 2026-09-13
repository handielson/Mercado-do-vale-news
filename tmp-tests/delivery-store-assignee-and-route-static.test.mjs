import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const server = readFileSync(file, 'utf8');
  assert.match(server, /const STORE_DELIVERY_PERSON_ID = 'store:delivery';/);
  assert.match(server, /\{ id: STORE_DELIVERY_PERSON_ID, name: 'Loja Mercado do Vale', type: 'store' \}/);
  assert.match(server, /if \(assigneeId === STORE_DELIVERY_PERSON_ID\) \{\s+deliveryPersonName = 'Loja Mercado do Vale';/);
  assert.match(server, /assigneeId !== STORE_DELIVERY_PERSON_ID;/, 'store delivery must never create a worker ledger credit');
  assert.match(server, /WHEN jobs\.delivery_person_customer_id = \? THEN 'Loja Mercado do Vale'/);
}

const page = readFileSync('pages/delivery/DeliveryOperationPage.tsx', 'utf8');
assert.match(page, /openExternalUrl = \(event: React\.MouseEvent<HTMLAnchorElement>, url: string\)/);
assert.match(page, /window\.MdvDelivery\.openExternalUrl\(url\)/);
assert.match(page, /onClick=\{\(event\) => openExternalUrl\(event, job\.delivery_route_url!\)\}/);

const activity = readFileSync('android/entregas/app/src/main/java/br/com/mercadodovale/entregas/MainActivity.kt', 'utf8');
assert.match(activity, /fun openExternalUrl\(rawUrl: String\) \{ openTrustedExternalUrl\(rawUrl\) \}/);
assert.match(activity, /private fun openTrustedExternalUrl\(rawUrl: String\)/);
assert.match(activity, /host\.endsWith\("\.google\.com"\)/);
assert.match(activity, /Intent\.ACTION_VIEW, uri/);

console.log('delivery store assignee and external route checks passed');

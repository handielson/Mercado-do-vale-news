import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deliveryTab = readFileSync('components/customer/profile/DeliveryWorkerTab.tsx', 'utf8');

assert.match(
  deliveryTab,
  /const submitAdminComplete = async \(job: CustomerDeliveryJob\) => \{[\s\S]*await adminCompleteDeliveryJob\(job\.token, \{ admin_completion_reason: reason \}\);/,
  'DeliveryWorkerTab must keep the administrative delivery completion action'
);

assert.match(
  deliveryTab,
  /catch \(error\)[\s\S]*toast\.error\(/,
  'DeliveryWorkerTab must show a toast when administrative delivery completion fails'
);

assert.match(
  deliveryTab,
  /getDeliveryAdminCompleteErrorMessage\(error\)/,
  'DeliveryWorkerTab must normalize VPS errors into a readable admin completion message'
);

console.log('delivery admin complete error static checks passed');

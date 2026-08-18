import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const customerService = readFileSync('services/customers.ts', 'utf8');
const upgradeService = readFileSync('services/typeUpgradeRequests.ts', 'utf8');
const authService = readFileSync('services/vpsAuthService.ts', 'utf8');

assert.match(
  customerService,
  /function toVpsCustomerType\(/,
  'customerService must translate UI customer types before writing to MySQL',
);

assert.match(
  customerService,
  /case 'retail':[\s\S]*return 'CUSTOMER'/,
  'retail must be stored as CUSTOMER in the VPS customers table',
);

assert.match(
  customerService,
  /case 'resale':[\s\S]*case 'wholesale':[\s\S]*return 'RESELLER'/,
  'resale and wholesale must be stored as RESELLER in the VPS customers table',
);

assert.match(
  customerService,
  /function fromVpsCustomerType\(/,
  'customerService must translate VPS customer types back to UI values',
);

assert.match(
  customerService,
  /case 'reseller':\s*return 'resale'/,
  'the VPS RESELLER role must become the resale pricing type in the UI',
);

assert.match(
  customerService,
  /export function normalizeCustomerFromVps\(/,
  'customer normalization must be reusable at every VPS boundary',
);

assert.match(
  authService,
  /customer:\s*normalizeCustomerFromVps\(responseSession\.customer\)/,
  'login and restored auth sessions must normalize RESELLER before pricing consumers receive the customer',
);

assert.match(
  customerService,
  /payload\.customer_type = toVpsCustomerType\(payload\.customer_type\)/,
  'serialized customer payloads must normalize customer_type before post/patch',
);

assert.match(
  upgradeService,
  /customer_type:\s*'RESELLER'/,
  'approving resale/wholesale upgrades must write the VPS RESELLER value to customers.customer_type',
);

assert.doesNotMatch(
  upgradeService,
  /customer_type:\s*request\.requested_type/,
  'upgrade approval must not write raw UI requested_type to customers.customer_type',
);

console.log('customer type VPS table-data normalization checks passed');

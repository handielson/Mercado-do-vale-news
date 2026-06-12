import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/customers.ts', 'utf8');

assert.match(
  source,
  /function pickWalkInCustomer\(customers: Customer\[\], companyId: string\)/,
  'walk-in customer selection must centralize duplicate candidate picking',
);

assert.match(
  source,
  /loadAllCustomers\(options: \{ force\?: boolean \} = \{\}/,
  'customer loader must support a forced refresh to avoid stale-cache duplicates',
);

assert.match(
  source,
  /loadAllCustomers\(\{ force: true \}\)/,
  'getOrCreateWalkInCustomer must bypass cache before creating Cliente Balcao',
);

assert.match(
  source,
  /const freshExisting = pickWalkInCustomer/,
  'getOrCreateWalkInCustomer must re-check existing Cliente Balcao immediately before create',
);

assert.match(
  source,
  /walkInCustomers[\s\S]*created_at/,
  'duplicate candidate picking should be deterministic using creation time',
);

console.log('PDV walk-in customer dedupe static checks passed');

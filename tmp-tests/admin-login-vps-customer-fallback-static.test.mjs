import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync('pages/auth/AdminLoginPage.tsx', 'utf8');
const customerServiceSource = readFileSync('services/customers.ts', 'utf8');

assert.doesNotMatch(
  pageSource,
  /from\(['"]customers['"]\)/,
  'AdminLoginPage must not read customers directly through Supabase fallback',
);

assert.match(
  pageSource,
  /import \{ customerService \} from ['"]\.\.\/\.\.\/services\/customers['"]/,
  'AdminLoginPage should use customerService for the timeout customer fallback',
);

assert.match(
  pageSource,
  /customerService\.getByUserId\(user\.id\)/,
  'AdminLoginPage timeout fallback should find the customer profile by auth user id via VPS',
);

assert.doesNotMatch(
  pageSource,
  /if\s*\(\s*user\s*&&\s*customer\?\.customer_type\s*!==\s*['"]ADMIN['"]\s*\)/,
  'AdminLoginPage must not sign out while the VPS customer profile is still loading',
);

assert.match(
  pageSource,
  /if\s*\(\s*user\s*&&\s*customer\s*&&\s*customer\.customer_type\s*!==\s*['"]ADMIN['"]\s*\)/,
  'AdminLoginPage should deny access only after a non-admin customer profile is loaded',
);

assert.match(
  customerServiceSource,
  /async getByUserId\(userId: string\): Promise<Customer \| null>/,
  'customerService should expose getByUserId for Auth-to-customer lookups',
);

assert.match(
  customerServiceSource,
  /customer\.user_id\) === String\(userId\)/,
  'getByUserId should match customers by user_id',
);

console.log('admin login VPS customer fallback static checks passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /function normalizeAuthCustomerType\(/, `${file} must normalize public auth customer types`);
  assert.match(source, /normalized === 'resale' \|\| normalized === 'wholesale' \|\| normalized === 'reseller'[\s\S]*return 'RESELLER'/, `${file} must map resale/wholesale to RESELLER`);
  assert.match(source, /return 'CUSTOMER'/, `${file} must default public self-registration to CUSTOMER`);
  assert.match(source, /normalizeAuthCustomerType\(body\.customer_type\)/, `${file} auth register must not insert raw retail into customers.customer_type`);
  assert.doesNotMatch(source, /body\.customer_type \|\| 'retail'/, `${file} must not default auth register to raw retail`);
}

console.log('VPS auth customer type normalization static checks passed');

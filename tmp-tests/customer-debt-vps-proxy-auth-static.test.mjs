import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /function isVpsProxyCustomerFinancialPath\(proxyPath, method = 'GET'\)/,
    `${file} must classify customer financial routes separately from admin-only proxy routes`,
  );

  assert.match(
    source,
    /pathname === '\/financial\/customer-debts'[\s\S]*pathname === '\/financial\/customer-debts\/payments'/,
    `${file} must allow authenticated customers to read their own debts and payments through the proxy`,
  );

  assert.match(
    source,
    /normalizedMethod === 'POST' && pathname === '\/financial\/customer-debts\/mp-intent'/,
    `${file} must allow authenticated customers to generate Mercado Pago debt intents through the proxy`,
  );

  assert.match(
    source,
    /else if \(isCustomerFinancialPath\) \{[\s\S]*?if \(!auth\.userId\) return reply\.code\(401\)\.send\(\{ error: 'Auth required' \}\);[\s\S]*?\}/,
    `${file} must require a logged-in customer before proxying customer financial routes`,
  );

  assert.match(
    source,
    /const needsInternalSyncKey = \(!isPublicPath && !isCustomerFinancialPath\)/,
    `${file} must not inject the sync key on customer financial proxy routes, so ownership checks use the bearer token`,
  );

  assert.match(
    source,
    /if \(debt_id\) \{[\s\S]*?WHERE p\.debt_id = \?'[\s\S]*?if \(!access\.isSync && !access\.isAdmin\) \{[\s\S]*?queryStr \+= ' AND d\.customer_id = \?';[\s\S]*?params\.push\(access\.customerId\);[\s\S]*?\}/,
    `${file} must scope payment reads by debt_id to the authenticated customer`,
  );
}

console.log('customer debt vps proxy auth static checks passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /allocations_json/,
    `${file} must persist customer debt Mercado Pago allocations for multi-debt Pix payments`,
  );

  assert.match(
    source,
    /normalizeCustomerDebtPaymentAllocations/,
    `${file} must normalize selected debts before creating Mercado Pago intent`,
  );

  assert.match(
    source,
    /processCustomerDebtPaymentAllocation/,
    `${file} must process approved Mercado Pago payment by allocation`,
  );

  assert.match(
    source,
    /customer_debt:multi/,
    `${file} must support a single Pix for multiple open debts`,
  );
}

console.log('customer debt Mercado Pago allocation static checks passed');

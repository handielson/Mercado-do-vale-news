import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const financialTab = readFileSync('components/customer/profile/FinancialTab.tsx', 'utf8');

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(
    source,
    /pathname === '\/financial\/customer-debts\/mp-intent'/,
    `${file} proxy must allow authenticated customer Mercado Pago intents`,
  );
  assert.match(
    source,
    /requireSyncKeyOrCustomer/,
    `${file} target route must continue validating the authenticated customer`,
  );
}

assert.match(
  financialTab,
  /paymentAmountByDebtId/,
  'FinancialTab must keep a per-debt payment amount state',
);
assert.match(
  financialTab,
  /Valor parcial/,
  'FinancialTab must let the customer type a partial amount',
);
assert.match(
  financialTab,
  /Pagar saldo total/,
  'FinancialTab must let the customer select the full open balance for one debt',
);
assert.match(
  financialTab,
  /Pagar todos os debitos/,
  'FinancialTab must let the customer pay all open debts in a single intent',
);
assert.match(
  financialTab,
  /Math\.min\([^)]*summary\.open/,
  'FinancialTab must cap typed payment amounts to the customer total open balance',
);
assert.match(
  financialTab,
  /allocations: buildPaymentAllocations/,
  'FinancialTab must allocate typed payments across open debts',
);

console.log('customer financial client payment static checks passed');

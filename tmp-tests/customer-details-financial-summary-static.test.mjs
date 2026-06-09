import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/customers/CustomerDetailsPage.tsx', 'utf8');
const service = readFileSync('services/customerFinancialSummaryService.ts', 'utf8');

assert.match(
  service,
  /\/financial\/customer-debts\?customer_id=/,
  'customer financial summary service must read customer debts by customer_id',
);

for (const token of ['openBalanceCents', 'overdueBalanceCents', 'paidTotalCents', 'totalDebtCents']) {
  assert.ok(service.includes(token), `summary service must expose ${token}`);
}

assert.match(
  page,
  /getCustomerFinancialSummary/,
  'customer details page must load the customer financial summary',
);

assert.match(
  page,
  /Resumo financeiro/,
  'customer details page must show a financial summary heading',
);

assert.match(
  page,
  /to=.+\/admin\/financial\/crediario/,
  'customer details page must expose a shortcut to the routed crediario page',
);

assert.doesNotMatch(
  page,
  /\/admin\/financeiro\?customer_id=/,
  'customer details page must not link customer balances to the Bling financeiro route',
);

console.log('customer details financial summary static checks passed');

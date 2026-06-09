import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = readFileSync('routes/index.tsx', 'utf8');
const customerDetails = readFileSync('pages/customers/CustomerDetailsPage.tsx', 'utf8');
const service = readFileSync('services/customerDebtService.ts', 'utf8');
const pagePath = 'pages/admin/financial/CustomerCreditLedgerPage.tsx';
let creditPage = '';
try {
  creditPage = readFileSync(pagePath, 'utf8');
} catch {
  creditPage = '';
}

assert.match(
  routes,
  /CustomerCreditLedgerPage/,
  'router must register the customer credit ledger page',
);

assert.match(
  routes,
  /path:\s*["']\/admin\/financial\/crediario["']/,
  'router must restore the old credit ledger route at /admin/financial/crediario',
);

assert.match(
  customerDetails,
  /to=\{`\/admin\/financial\/crediario\?customer_id=/,
  'customer details shortcut must point to the old crediario page, not the Bling finance page',
);

assert.doesNotMatch(
  customerDetails,
  /to=\{`\/admin\/financeiro\?customer_id=/,
  'customer details must not send customer balances to the Bling financeiro route',
);

assert.match(
  service,
  /\/financial\/customer-debts\?/,
  'credit ledger service must read customer debts from the VPS financial endpoint',
);

assert.match(
  service,
  /\/financial\/customer-debts\/payments\?/,
  'credit ledger service must load payment history from the VPS financial endpoint',
);

assert.match(
  creditPage,
  /getSaleById/,
  'credit ledger page must show linked PDV order details',
);

assert.match(
  service,
  /function\s+formatCurrencyCents/,
  'credit ledger service must format debt values as cents',
);

assert.match(
  service,
  /format\(cents\s*\/\s*100\)/,
  'credit ledger values must be divided by 100 for BRL display',
);

assert.match(
  creditPage,
  /function\s+formatSaleMoney[\s\S]*formatCurrencyCents/,
  'linked sale values must be formatted from cents to avoid multiplying PDV sale totals',
);

assert.match(
  creditPage,
  /paymentsByDebtId/,
  'payment history must group payments by customer debt/account',
);

assert.match(
  creditPage,
  /filteredDebts\.map\(\(debt\)/,
  'payment history must render each linked order once per debt/account instead of once per payment',
);

assert.doesNotMatch(
  creditPage,
  /payments\.map\(\(payment\)\s*=>\s*\{[\s\S]*Pedido vinculado/,
  'payment history must not repeat the linked order inside every payment card',
);

assert.match(
  creditPage,
  /openPaymentModal/,
  'credit ledger page must expose an admin action to register a manual payment',
);

assert.match(
  creditPage,
  /Registrar baixa/,
  'credit ledger page must restore the manual payment modal',
);

assert.match(
  creditPage,
  /registerCustomerDebtPayment/,
  'manual payment must call the VPS customer debt payment endpoint',
);

assert.match(
  creditPage,
  /paymentMethodOptions/,
  'manual payment must let admin choose payment method',
);

assert.match(
  creditPage,
  /saldo_devedor/,
  'credit ledger page must show open balances',
);

assert.match(
  creditPage,
  /Historico de pagamentos/,
  'credit ledger page must restore the old payment history section',
);

assert.match(
  creditPage,
  /Pedido vinculado/i,
  'credit ledger page must restore the linked order section',
);

console.log('customer credit ledger route static checks passed');

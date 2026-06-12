import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../pages/customer/CustomerProfilePage.tsx', import.meta.url), 'utf8');
const financialTabSource = readFileSync(new URL('../components/customer/profile/FinancialTab.tsx', import.meta.url), 'utf8');

assert.match(
  source,
  /type TabType = [^;]*'finance'/,
  'CustomerProfilePage TabType must include finance',
);

assert.match(
  source,
  /tabFromQuery === 'finance'/,
  'CustomerProfilePage must allow opening the financial tab through ?tab=finance',
);

assert.match(
  source,
  /label: 'Financeiro'/,
  'CustomerProfilePage side navigation must show the Financeiro tab',
);

assert.match(
  source,
  /activeTab === 'finance' && <FinancialTab customer={effectiveCustomer}/,
  'CustomerProfilePage must render the financial tab for the effective customer',
);

assert.match(
  financialTabSource,
  /paymentsByDebtId/,
  'FinancialTab must group payments by debt id',
);

assert.match(
  financialTabSource,
  /payment\.debt_id/,
  'FinancialTab must associate each payment with its source debt',
);

assert.match(
  financialTabSource,
  /expandedDebtIds/,
  'FinancialTab must keep expand\/collapse state per debt',
);

assert.match(
  financialTabSource,
  /pagamento\(s\)/,
  'FinancialTab must show an informative payment count on each debt',
);

assert.match(
  financialTabSource,
  /ChevronDown|ChevronRight/,
  'FinancialTab must render a chevron control to expand debt payments',
);

assert.match(
  financialTabSource,
  /createCustomerDebtMercadoPagoIntent/,
  'FinancialTab must keep the Mercado Pago payment flow available',
);

assert.match(
  financialTabSource,
  /createMercadoPagoPayment\(debt, 'pix'\)/,
  'FinancialTab must allow Pix payments through Mercado Pago',
);

assert.match(
  financialTabSource,
  /createMercadoPagoPayment\(debt, 'card'\)/,
  'FinancialTab must allow card payments through Mercado Pago',
);

assert.match(
  financialTabSource,
  /Pagar via Pix/,
  'FinancialTab must show a Pix payment action for open debts',
);

assert.match(
  financialTabSource,
  /Pagar com Cartao/,
  'FinancialTab must show a card payment action for open debts',
);

assert.match(
  financialTabSource,
  /valor_cobrado/,
  'FinancialTab must display the charged amount returned by Mercado Pago',
);

assert.match(
  financialTabSource,
  /taxa_pct/,
  'FinancialTab must display the Mercado Pago fee percentage returned by the backend',
);

assert.match(
  financialTabSource,
  /Total cobrado do cliente/,
  'FinancialTab must make clear the customer pays the gross Mercado Pago amount',
);

assert.match(
  financialTabSource,
  /Saldo liquido/,
  'FinancialTab must make clear the receivable balance remains liquid',
);

assert.match(
  financialTabSource,
  /Taxa Mercado Pago/,
  'FinancialTab must show the Mercado Pago fee passed through to the customer',
);

console.log('customer profile financial tab static checks passed');

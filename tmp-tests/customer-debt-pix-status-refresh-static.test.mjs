import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/customerDebtService.ts', 'utf8');
const financialTab = readFileSync('components/customer/profile/FinancialTab.tsx', 'utf8');

assert.match(
  service,
  /refreshCustomerDebtMercadoPagoIntentStatus/,
  'customer debt service must expose a status refresh function for Mercado Pago intents',
);

assert.match(
  service,
  /\/financial\/customer-debts\/mp-intent\/\$\{encodeURIComponent\(intentId\)\}\/status/,
  'customer debt service must call the intent status endpoint',
);

assert.match(
  financialTab,
  /CUSTOMER_DEBT_PAYMENT_POLL_INTERVAL_MS\s*=\s*5000/,
  'FinancialTab must poll pending Pix intents every 5 seconds',
);

assert.match(
  financialTab,
  /refreshCustomerDebtMercadoPagoIntentStatus/,
  'FinancialTab must refresh Mercado Pago intent status',
);

assert.match(
  financialTab,
  /handleRefreshMercadoPagoPayment/,
  'FinancialTab must provide a manual payment status refresh action',
);

assert.match(
  financialTab,
  /Conferir pagamento/,
  'FinancialTab must show a manual payment status refresh button',
);

assert.match(
  financialTab,
  /paymentMethodLabel/,
  'FinancialTab must derive a customer-friendly payment method label',
);

assert.match(
  financialTab,
  /Pago via Mercado Pago/,
  'FinancialTab must show Mercado Pago payments with an explicit label',
);

assert.match(
  financialTab,
  /formatDateTime/,
  'FinancialTab must render payment date and hour when available',
);

assert.match(
  financialTab,
  /setInterval[\s\S]*CUSTOMER_DEBT_PAYMENT_POLL_INTERVAL_MS/,
  'FinancialTab must keep polling while a Mercado Pago intent is pending',
);

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /\/financial\/customer-debts\/mp-intent\/:id\/status/,
    `${file} must expose a customer debt Mercado Pago intent status endpoint`,
  );

  assert.match(
    source,
    /processCustomerDebtMercadoPagoPayment\(payment\)/,
    `${file} status endpoint must process approved Mercado Pago payments through the same debt webhook handler`,
  );

  assert.match(
    source,
    /\^\\\/financial\\\/customer-debts\\\/mp-intent\\\/\[\^\/\]\+\\\/status/,
    `${file} proxy must allow authenticated customers to call the intent status endpoint`,
  );
}

console.log('customer debt Pix status refresh static checks passed');

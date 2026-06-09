import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync('components/customer/profile/PurchaseHistoryTab.tsx', 'utf8');
const service = readFileSync('services/customerDebtService.ts', 'utf8');

assert.match(
  profile,
  /Crediario/,
  'customer profile must show the credit ledger area inside customer history',
);

assert.match(
  profile,
  /Pagar via Pix/,
  'customer profile must let customers start a Pix payment for debts',
);

assert.match(
  profile,
  /Valor parcial/,
  'customer profile must let customers choose a partial payment amount',
);

assert.match(
  profile,
  /Pagar todos os debitos/,
  'customer profile must let customers choose to pay all open debts',
);

assert.match(
  profile,
  /createCustomerDebtMercadoPagoIntent/,
  'customer profile must create a Mercado Pago intent for customer debt Pix payment',
);

assert.match(
  profile,
  /qr_code_base64/,
  'customer profile must render Mercado Pago Pix QR code when available',
);

assert.match(
  service,
  /\/financial\/customer-debts\/mp-intent/,
  'customer debt service must use the Mercado Pago intent endpoint',
);

assert.match(
  service,
  /\/financial\/customer-debts\/pay/,
  'customer debt service must use the manual debt payment endpoint',
);

console.log('customer profile credit payments static checks passed');

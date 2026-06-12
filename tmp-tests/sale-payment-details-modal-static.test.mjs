import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');

assert.match(
  source,
  /const hasDetailedPaymentMethods =/,
  'sale details modal must detect whether payment_methods JSON was actually persisted',
);

assert.match(
  source,
  /Detalhes do pagamento nao registrados/,
  'sale details modal must warn when an older sale has no detailed payment JSON',
);

assert.match(
  source,
  /paymentView\.amount[\s\S]*paymentView\.totalWithFee/,
  'sale details modal must render base amount and charged total for each payment method',
);

assert.match(
  source,
  /Custo da maquina calculado/,
  'sale details modal must show recovered operator fee when profit calculation can infer it',
);

console.log('sale payment details modal static checks passed');

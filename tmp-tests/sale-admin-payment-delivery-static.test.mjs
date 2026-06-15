import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modal = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');
const presentation = readFileSync('utils/salePresentation.ts', 'utf8');

assert.match(
  modal,
  /paymentView\.details\.map/,
  'admin sale modal must render the full internal payment details for each payment'
);

assert.match(
  presentation,
  /Custo da m[aá]quina|Custo da maquina/,
  'admin sale modal must show machine cost details again'
);

assert.match(
  presentation,
  /Percentual cobrado/,
  'admin sale modal must show charged percentage details again'
);

assert.doesNotMatch(
  modal,
  /sale\.delivery_type\s*&&\s*sale\.delivery_type\s*!==\s*'store_pickup'/,
  'admin delivery section must not hide store pickup sales'
);

assert.match(
  modal,
  /deliveryDetails/,
  'admin sale modal must build explicit delivery or pickup details'
);

assert.match(
  modal,
  /Entregador/,
  'admin sale modal must show who delivered when available'
);

assert.match(
  modal,
  /Retirada na Loja/,
  'admin sale modal must show store pickup when applicable'
);

console.log('sale admin payment and delivery static checks passed');

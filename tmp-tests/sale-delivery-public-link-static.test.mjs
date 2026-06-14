import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('services/customerDeliveryService.ts', 'utf8');
const modal = fs.readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');

assert.match(
  service,
  /getCustomerDeliveryJobBySaleId/,
  'customerDeliveryService must expose lookup by sale id for admin sale details',
);

assert.match(
  service,
  /\/table-data\/customer_delivery_jobs/,
  'customerDeliveryService must read existing delivery jobs from VPS table-data',
);

assert.match(
  service,
  /createDeliveryJobFromSale/,
  'customerDeliveryService must expose generation from a sale when the job is missing',
);

assert.match(
  modal,
  /getCustomerDeliveryJobBySaleId/,
  'sale details modal must load the delivery job for the current sale',
);

assert.match(
  modal,
  /\/delivery\/\$\{deliveryJob\.token\}/,
  'sale details modal must build the public delivery operation link from the job token',
);

assert.match(
  modal,
  /Copiar link/,
  'sale details modal must offer a copy action for the delivery person link',
);

assert.match(
  modal,
  /Gerar link/,
  'sale details modal must offer generation when the delivery job was not created yet',
);

console.log('sale-delivery-public-link-static.test.mjs: ok');

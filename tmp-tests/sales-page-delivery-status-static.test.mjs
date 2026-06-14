import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const saleTypes = readFileSync('types/sale.ts', 'utf8');
const saleService = readFileSync('services/saleService.ts', 'utf8');
const salesPage = readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');

assert.match(
  saleTypes,
  /interface SaleDeliveryJobSummary/,
  'sale types must define a delivery job summary for the sales list'
);
assert.match(
  saleTypes,
  /delivery_job\?: SaleDeliveryJobSummary \| null/,
  'SaleWithItems must expose delivery_job to the sales page'
);
assert.match(
  saleService,
  /loadTableRows<any>\('customer_delivery_jobs'\)/,
  'getSales must load customer_delivery_jobs rows'
);
assert.match(
  saleService,
  /deliveryJobBySaleId/,
  'getSales must map delivery jobs by sale id'
);
assert.match(
  salesPage,
  />Entrega</,
  'sales table must render the Entrega column header'
);
assert.match(
  salesPage,
  /getDeliveryStatusLabel/,
  'sales page must format delivery status labels'
);
assert.match(
  salesPage,
  /sale\.delivery_job/,
  'sales page must render each sale delivery job status'
);

console.log('sales page delivery status static checks passed');

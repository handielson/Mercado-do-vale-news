import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/saleService.ts', 'utf8');
const vpsServers = [
  readFileSync('vps_server.js', 'utf8'),
  readFileSync('vps_server.cjs', 'utf8'),
];

assert.match(
  source,
  /import\s+\{\s*vpsClient\s+\}\s+from\s+['"]\.\/vpsClient['"]/,
  'saleService must use vpsClient for the migrated PDV sale paths',
);

for (const helper of [
  'loadSaleRows',
  'loadSaleItemsBySaleId',
  'loadSaleWithItemsById',
  'loadCustomerNameById',
  'patchSale',
  'deleteSaleRow',
  'createLocalId',
  'serializeSaleRowForTable',
  'serializeSaleItemRowForTable',
  'summarizePaymentMethodForSalesTable',
]) {
  assert.match(source, new RegExp(`function\\s+${helper}|const\\s+${helper}\\s*=`), `saleService must define ${helper}`);
}

assert.match(
  source,
  /\/table-data\/sales/,
  'sale rows must be loaded or mutated through VPS table-data',
);

assert.match(
  source,
  /loadTableRows<any>\(['"]sale_items['"]\)/,
  'sale items must be loaded through VPS table-data',
);

assert.match(
  source,
  /loadTableRows<any>\(['"]customers['"]\)/,
  'customers used by sale flows must be loaded through VPS table-data',
);

function functionBody(name) {
  const start = source.indexOf(`export const ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf('\nexport const ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

for (const name of ['createSale', 'getSaleById', 'getSales', 'cancelSale', 'refundSale', 'deleteSale', 'getSalesSummary']) {
  const body = functionBody(name);
  assert.doesNotMatch(body, /supabase\s*\.\s*from\(['"]sales['"]\)/, `${name} must not read or mutate sales through Supabase`);
  assert.doesNotMatch(body, /supabase\s*\.\s*from\(['"]sale_items['"]\)/, `${name} must not read sale_items through Supabase`);
}

const createSaleBody = functionBody('createSale');
assert.match(
  createSaleBody,
  /vpsClient\.post<Sale>\([\s\S]*['"]\/table-data\/sales['"]/,
  'createSale must insert the sale through VPS table-data',
);
assert.match(
  createSaleBody,
  /vpsClient\.post\([\s\S]*['"]\/table-data\/sale_items\/bulk['"]/,
  'createSale must insert sale items through VPS table-data bulk insert',
);
for (const persistedSaleField of [
  'subtotal',
  'discount_total',
  'cost_total',
  'profit',
  'payment_methods',
  'delivery_type',
  'delivery_cost_store',
  'delivery_cost_customer',
  'delivery_total',
  'promotional_discount',
]) {
  assert.match(
    source,
    new RegExp(`${persistedSaleField}:\\s*row\\.${persistedSaleField}|${persistedSaleField}:\\s*serializeJsonValue\\(row\\.${persistedSaleField}\\)`),
    `serializeSaleRowForTable must persist ${persistedSaleField} for admin sale details`,
  );
}
for (const persistedItemField of [
  'product_sku',
  'unit_cost',
  'discount',
  'subtotal',
]) {
  assert.match(
    source,
    new RegExp(`${persistedItemField}:\\s*item\\.${persistedItemField}`),
    `serializeSaleItemRowForTable must persist ${persistedItemField} for admin sale details`,
  );
}
assert.match(
  createSaleBody,
  /discount:\s*discountTotal/,
  'createSale must map discount_total to the VPS sales.discount column',
);
assert.match(
  createSaleBody,
  /payment_method:\s*summarizePaymentMethodForSalesTable\(saleInput\.payment_methods\)/,
  'createSale must map payment_methods to the VPS sales.payment_method column',
);
assert.match(
  createSaleBody,
  /serializeSaleItemRowForTable/,
  'createSale must filter sale item fields to the VPS sale_items schema',
);
assert.doesNotMatch(
  source,
  /delete tablePatch\.(subtotal|discount_total|cost_total|profit|payment_methods|delivery_type|delivery_person_id|delivery_cost_store|delivery_cost_customer|delivery_total|promotional_discount)/,
  'patchSale must not drop financial fields that now exist in the VPS sales table',
);

for (const vpsSource of vpsServers) {
  for (const salesColumn of [
    'subtotal',
    'discount_total',
    'cost_total',
    'profit',
    'payment_methods',
    'delivery_type',
    'delivery_person_id',
    'delivery_cost_store',
    'delivery_cost_customer',
    'delivery_total',
    'promotional_discount',
  ]) {
    assert.match(
      vpsSource,
      new RegExp(`addColumnIfMissing\\(['"]sales['"],\\s*['"]${salesColumn}['"]`),
      `VPS sales table migration must include ${salesColumn}`,
    );
  }
  for (const saleItemsColumn of ['unit_cost', 'product_sku', 'discount', 'subtotal']) {
    assert.match(
      vpsSource,
      new RegExp(`addColumnIfMissing\\(['"]sale_items['"],\\s*['"]${saleItemsColumn}['"]`),
      `VPS sale_items table migration must include ${saleItemsColumn}`,
    );
  }
}
assert.doesNotMatch(
  createSaleBody,
  /supabase\s*\.\s*from\(['"]customers['"]\)/,
  'createSale must not read referral buyer name through Supabase customers',
);
assert.match(
  createSaleBody,
  /loadCustomerNameById\(/,
  'createSale must resolve referral buyer name through the VPS customer helper',
);

console.log('saleService VPS table-data static checks passed');

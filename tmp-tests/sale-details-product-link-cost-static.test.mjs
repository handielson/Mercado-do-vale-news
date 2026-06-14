import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modal = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');

assert.match(
  modal,
  /const productAdminHref = item\.product_id\s*\?\s*`\/admin\/products\/\$\{encodeURIComponent\(item\.product_id\)\}`\s*:\s*'';/,
  'sale details item name must build an admin product link from product_id',
);

assert.match(
  modal,
  /href=\{productAdminHref\}/,
  'sale details item name hyperlink must use the admin product link',
);

assert.doesNotMatch(
  modal,
  /<p className="text-sm font-medium text-slate-800">\{item\.product_name\}<\/p>\s*\{item\.is_gift/,
  'sale details item name must not regress to plain text when product_id is available',
);

assert.match(
  modal,
  /Custo un\.:/,
  'sale details must show unit cost for each item',
);

assert.match(
  modal,
  /Custo item:/,
  'sale details must show total item cost for each item',
);

assert.match(
  modal,
  /const unitCost = Number\(item\.unit_cost\) \|\| 0;/,
  'sale details must compute item cost from the sale item unit_cost saved at sale time',
);

console.log('sale-details-product-link-cost-static.test.mjs: ok');

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
  /const itemView = buildSaleItemPresentation\(item, productSpecs, realProfit\);/,
  'sale details must build item cost/profit presentation through buildSaleItemPresentation',
);

assert.match(
  modal,
  /formatCurrency\(itemView\.unitCost\)/,
  'sale details must render unit cost from the item presentation object',
);

assert.match(
  modal,
  /formatCurrency\(itemView\.itemCost\)/,
  'sale details must render item cost from the item presentation object',
);

assert.match(
  modal,
  /itemView\.itemProfit >= 0/,
  'sale details must use itemView.itemProfit when choosing profit color',
);

assert.match(
  modal,
  /formatCurrency\(itemView\.itemProfit\)/,
  'sale details must render item profit from the item presentation object',
);

assert.doesNotMatch(
  modal,
  /formatCurrency\((unitCost|itemCost|itemProfit)\)|className=\{itemProfit >= 0/,
  'sale details must not reference undeclared item cost/profit variables in JSX',
);

assert.match(
  modal,
  /const paymentView = buildPaymentPresentation\(payment\);/,
  'sale details must build payment labels through buildPaymentPresentation',
);

assert.match(
  modal,
  /\{paymentView\.labelWithInstallments\}/,
  'sale details must render the payment label from the payment presentation object',
);

assert.doesNotMatch(
  modal,
  /getPaymentLabel\(payment\.method\)/,
  'sale details must not reference an undeclared getPaymentLabel helper in JSX',
);

console.log('sale-details-product-link-cost-static.test.mjs: ok');

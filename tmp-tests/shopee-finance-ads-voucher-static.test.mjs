import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const finance = readFileSync('pages/admin/settings/components/ShopeeFinanceTab.tsx', 'utf8');
const orders = readFileSync('pages/admin/settings/components/ShopeeOrdersTab.tsx', 'utf8');

assert.match(
  finance,
  /ads_voucher_discount:\s*number/,
  'Shopee finance items must keep the Ads Smart Voucher amount returned by escrow detail.'
);

assert.match(
  finance,
  /income\?\.buyer_payment_info\?\.ads_voucher_discount\s*\|\|\s*0/,
  'Shopee finance must read buyer_payment_info.ads_voucher_discount from get_escrow_detail.'
);

assert.match(
  finance,
  /Ads Smart Voucher \(R\$\)/,
  'Shopee finance CSV must include an Ads Smart Voucher column.'
);

assert.match(
  finance,
  /Ads Smart Voucher/,
  'Shopee finance UI must show the Ads Smart Voucher amount.'
);

assert.match(
  orders,
  /buyer_payment_info\?\.ads_voucher_discount/,
  'Shopee order financial details must show buyer_payment_info.ads_voucher_discount when available.'
);

console.log('shopee finance ads voucher static checks passed');

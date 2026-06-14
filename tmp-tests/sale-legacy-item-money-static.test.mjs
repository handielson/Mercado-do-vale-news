import assert from 'node:assert/strict';
import fs from 'node:fs';

const saleService = fs.readFileSync('services/saleService.ts', 'utf8');

assert.match(saleService, /moneyReaisToCents/, 'saleService must use reais conversion for legacy decimal sale items');
assert.match(saleService, /function saleRowUsesLegacyDecimalItemMoney/, 'saleService must isolate legacy sale item money detection');
assert.match(saleService, /!hasModernSubtotal && !hasModernPaymentMethods/, 'legacy decimal detection must not affect modern PDV sales');
assert.match(saleService, /normalizeSaleItemRow\(row, saleRow\)/, 'sale details/list must normalize items with sale row context');

console.log('sale-legacy-item-money-static.test.mjs: ok');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/saleService.ts', 'utf8');

assert.match(
  source,
  /function\s+shouldScaleSaleMoneyFromReais/,
  'saleService must detect migrated sale rows stored in reais',
);

assert.match(
  source,
  /function\s+looksLikeCentStoredMoney/,
  'saleService must detect cent values stored with decimal suffixes',
);

assert.match(
  source,
  /totalLooksDecimalReais[\s\S]*!looksLikeCentStoredMoney\(saleRow\.total\)/,
  'legacy decimal detection must not treat cent-stored MySQL values like 59710.00 as reais',
);

assert.match(
  source,
  /if\s*\(itemMoneyValues\.some\(looksLikeCentStoredMoney\)\)\s*return false;/,
  'cent-stored item rows such as 19710.00 must not be multiplied by 100',
);

assert.match(
  source,
  /Math\.abs\(n - Math\.round\(n\)\) <= 0\.001 && n >= 1000/,
  'aggregate reais values such as 1221.20 must not be mistaken for cent-stored money',
);

assert.match(
  source,
  /normalizeSaleRow\(\w+,\s*moneyScale\)/,
  'getSales must pass the detected money scale into sale normalization',
);

assert.doesNotMatch(
  source,
  /normalizeSaleItemRow\(row,\s*moneyScale\)/,
  'sale item normalization must receive the sale row context, not the numeric money scale',
);

assert.match(
  source,
  /normalizeSaleItemRow\(row,\s*sale(?:Row)?\)/,
  'sale item normalization must receive sale row context so legacy decimal rows are detected',
);

assert.match(
  source,
  /paymentMethods\.map\(\(payment\)\s*=>\s*\(\{[\s\S]*amount:\s*scaleMoneyValue\(payment\.amount,\s*moneyScale\)[\s\S]*total_with_fee:\s*scaleMoneyValue\(payment\.total_with_fee\s*\?\?\s*payment\.amount,\s*moneyScale\)/,
  'payment methods must be scaled together with sale totals',
);

console.log('sale service currency normalization static checks passed');

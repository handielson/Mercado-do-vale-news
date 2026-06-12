import assert from 'node:assert/strict';
import { moneyToCents, formatMoneyCents } from '../utils/money';

assert.equal(moneyToCents(400), 400, 'integer numbers stay as cents');
assert.equal(moneyToCents('400'), 400, 'integer strings stay as cents');
assert.equal(moneyToCents('400.00'), 400, 'MySQL decimal cents stay as cents');
assert.equal(moneyToCents('253103.00'), 253103, 'MySQL decimal sale totals stay as cents');
assert.equal(moneyToCents(9.99), 999, 'decimal numbers are reais');
assert.equal(moneyToCents('9.99'), 999, 'decimal dot strings are reais');
assert.equal(moneyToCents('9,99'), 999, 'decimal comma strings are reais');
assert.equal(moneyToCents('R$ 1.500,00'), 150000, 'BRL strings with thousands are reais');
assert.match(formatMoneyCents(400), /^R\$\s?4,00$/u);
assert.match(formatMoneyCents('253103.00'), /^R\$\s?2\.531,03$/u);

console.log('money-normalization: ok');

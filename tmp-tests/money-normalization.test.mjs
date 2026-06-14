import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const source = readFileSync('utils/money.ts', 'utf8');
const { outputText } = transpileModule(source, {
  compilerOptions: {
    module: ModuleKind.ES2022,
    target: ScriptTarget.ES2022,
  },
  fileName: 'utils/money.ts',
});

const dataUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
const { moneyToCents, moneyReaisToCents, formatMoneyCents } = await import(dataUrl);

assert.equal(moneyToCents(400), 400, 'integer numbers stay as cents');
assert.equal(moneyToCents('400'), 400, 'integer strings stay as cents');
assert.equal(moneyToCents('400.00'), 400, 'MySQL decimal cents stay as cents');
assert.equal(moneyToCents('253103.00'), 253103, 'MySQL decimal sale totals stay as cents');
assert.equal(moneyToCents(9.99), 999, 'decimal numbers are reais');
assert.equal(moneyToCents('9.99'), 999, 'decimal dot strings are reais');
assert.equal(moneyToCents('9,99'), 999, 'decimal comma strings are reais');
assert.equal(moneyToCents('R$ 1.500,00'), 150000, 'BRL strings with thousands are reais');
assert.equal(moneyReaisToCents('400.00'), 40000, 'legacy sale item decimal strings are reais');
assert.equal(moneyReaisToCents('197.10'), 19710, 'legacy sale item decimal values keep cents');
assert.match(formatMoneyCents(400), /^R\$\s?4,00$/u);
assert.match(formatMoneyCents('253103.00'), /^R\$\s?2\.531,03$/u);

console.log('money-normalization: ok');

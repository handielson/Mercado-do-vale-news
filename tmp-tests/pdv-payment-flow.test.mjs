import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

async function loadTs(path) {
    const { outputText } = transpileModule(readFileSync(path, 'utf8'), {
        compilerOptions: { module: ModuleKind.ES2022, target: ScriptTarget.ES2022 }, fileName: path,
    });
    return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const calc = await loadTs('utils/saleCalculations.ts');
const money = await loadTs('utils/money.ts');
const item = (price, extra = {}) => ({ unit_price: price, quantity: 1, discount: 0, unit_cost: 5000, ...extra });
const pay = (method, amount, extra = {}) => ({ method, amount, total_with_fee: amount, ...extra });

for (const [input, expected] of [['1.500,00', 150000], ['1500', 150000], ['1500.00', 150000], ['0,01', 1]]) {
    assert.equal(money.moneyReaisToCents(input), expected);
}
const cash = [pay('money', 15000)];
assert.equal(calc.calculateSalePaymentTotals([item(10000)], cash).total, 10000);
assert.equal(calc.calculatePaymentSummary(10000, cash).change, 5000);
const settled = calc.prepareSalePayments(10000, cash);
assert.equal(settled[0].amount, 10000);
assert.equal(settled[0].total_with_fee, 10000);
assert.equal(settled[0].cash_received, 15000);
assert.equal(settled[0].change_amount, 5000);
assert.equal(cash[0].amount, 15000, 'finalization must not mutate the draft');
assert.deepEqual(calc.prepareSalePayments(10000, settled), settled, 'settlement is idempotent');
assert.throws(() => calc.prepareSalePayments(10000, [pay('pix', 15000)]), /excedem/);
assert.throws(() => calc.prepareSalePayments(10000, [pay('money', 5000)]), /Falta/);
assert.throws(() => calc.prepareSalePayments(10000, [pay('pix', 10000, { pix_status: 'pending' })]), /Pix/);
const mixed = [pay('pix', 3000), pay('money', 8000)];
assert.equal(calc.prepareSalePayments(10000, mixed)[1].total_with_fee, 7000);
const debt = calc.calculatePaymentSummary(10000, [pay('pix', 3000), pay('a_prazo', 7000)]);
assert.equal(debt.received, 3000);
assert.equal(debt.deferred, 7000);
assert.equal(debt.remaining, 0);
assert.equal(debt.isComplete, true);
assert.equal(calc.calculateSalePaymentTotals([item(10000), item(2000, { is_gift: true })], []).total, 10000, 'gift deducted once');
assert.equal(calc.calculateSalePaymentTotals([item(10000, { discount: 1000 })], [], 500, 200).total, 8700);

const card = [pay('credit', 100000, { fee_percentage: 10, fee_amount: 10000, total_with_fee: 110000, installments: 10 })];
const adjusted = calc.adjustFinalCreditPayment(100000, card, 105000);
assert.equal(calc.calculateSalePaymentTotals([item(100000)], adjusted.payments, 0, 0, adjusted.discount).total, 105000);
assert.equal(calc.calculateChange(105000, adjusted.payments), 0);
assert.equal(adjusted.payments[0].installments, 10);
const repeated = calc.adjustFinalCreditPayment(100000, adjusted.payments, 104000);
assert.equal(calc.calculateSalePaymentTotals([item(100000)], repeated.payments, 0, 0, repeated.discount).total, 104000);
assert.deepEqual(calc.restoreCreditPayments(repeated.payments), card, 'clear restores the original card');
const split = [pay('pix', 20000), pay('credit', 80000, { fee_percentage: 10, fee_amount: 8000, total_with_fee: 88000 })];
const splitAdjusted = calc.adjustFinalCreditPayment(100000, split, 105000);
assert.equal(splitAdjusted.payments[1].total_with_fee, 85000, 'target means the entire sale');
assert.equal(calc.calculateSalePaymentTotals([item(100000)], splitAdjusted.payments, 0, 0, splitAdjusted.discount).total, 105000);
assert.throws(() => calc.adjustFinalCreditPayment(100000, split, 19000), /outros pagamentos/);
console.log('PDV payment flow: currency, gifts, cash, debt, mixed payments and repeated card adjustments passed');

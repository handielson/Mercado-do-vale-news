// payment-fee-method-v1: PIX usa a taxa pix (0%), não a do crédito 1x (3,99%) — orçamento compartilhado de 21/11.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const fees = [ // ordem da API: channel, method, installments
  { channel: 'presencial', payment_method: 'credit', installments: 1, applied_fee: 3.99 },
  { channel: 'presencial', payment_method: 'credit', installments: 2, applied_fee: 5.09 },
  { channel: 'presencial', payment_method: 'credit', installments: 12, applied_fee: 11.9 },
  { channel: 'presencial', payment_method: 'debit', installments: 1, applied_fee: 0 },
  { channel: 'presencial', payment_method: 'pix', installments: 1, applied_fee: 0 },
];
function load(list) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'installmentCalculator.ts'), 'utf8')
    .replace(/import \{ paymentFeesService \} from '\.\/payment-fees';/, 'const paymentFeesService = { list: async () => globalThis.__fees };')
    .replace(/import type \{ PaymentFee \} from '\.\/payment-fees';/, 'type PaymentFee = any;');
  const { code } = esbuild.transformSync(src, { loader: 'ts', format: 'cjs' });
  globalThis.__fees = list;
  const mod = { exports: {} };
  new Function('module', 'exports', code)(mod, mod.exports);
  return mod.exports;
}

test('caso real: Poco X8 5G R$ 1.999,00 → PIX R$ 1.999,00 (antes R$ 2.078,76) e 12x igual ao robô', async () => {
  const { calculateInstallments } = load(fees);
  const plans = await calculateInstallments(199900, 12);
  assert.equal(plans[0].label, 'À VISTA (PIX)');
  assert.equal(plans[0].total, 199900);
  const p12 = plans.find((p) => p.installments === 12);
  assert.equal(p12.total, 223688);
  assert.equal(p12.value, 18641);
  assert.equal(plans.filter((p) => p.installments === 1).length, 1, 'crédito/débito 1x não viram outra linha');
});

test('taxas antigas sem forma de pagamento continuam funcionando', async () => {
  const { calculateInstallments, calculateInstallmentFromFees } = load(fees.filter((f) => f.payment_method === 'credit').map((f) => ({ ...f, payment_method: '' })));
  const plans = await calculateInstallments(100000, 12);
  assert.equal(plans[0].total, 103990, 'sem pix cadastrado, cai na 1x sem método (comportamento antigo)');
  assert.equal(calculateInstallmentFromFees(100000, globalThis.__fees, 2).total, 105090);
});

test('crédito 1x em calculateInstallmentFromFees usa a taxa de crédito, não a do pix', () => {
  const { calculateInstallmentFromFees, findPixFee } = load(fees);
  assert.equal(calculateInstallmentFromFees(100000, fees, 1).total, 103990);
  assert.equal(findPixFee(fees).payment_method, 'pix');
});

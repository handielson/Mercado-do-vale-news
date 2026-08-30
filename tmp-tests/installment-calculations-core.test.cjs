'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  isLeapYear,
  getDaysInMonth,
  parseCivilDate,
  calculateCivilMonthlyDueDate,
  toSafeIntegerCents,
  generatePaymentInstallmentSchedule,
  validatePaymentInstallmentSchedule,
} = require(path.join(__dirname, '..', 'utils', 'installmentCalculations.cjs'));

test('isLeapYear & getDaysInMonth: anos bissextos e dias por mes', () => {
  assert.equal(isLeapYear(2024), true, '2024 deve ser bissexto');
  assert.equal(isLeapYear(2027), false, '2027 nao deve ser bissexto');
  assert.equal(isLeapYear(2000), true, '2000 deve ser bissexto (divisivel por 400)');
  assert.equal(isLeapYear(1900), false, '1900 nao deve ser bissexto (divisivel por 100 mas nao 400)');

  assert.equal(getDaysInMonth(2024, 2), 29, 'Fevereiro 2024 deve ter 29 dias');
  assert.equal(getDaysInMonth(2027, 2), 28, 'Fevereiro 2027 deve ter 28 dias');
  assert.equal(getDaysInMonth(2027, 4), 30, 'Abril deve ter 30 dias');
  assert.equal(getDaysInMonth(2027, 1), 31, 'Janeiro deve ter 31 dias');
});

test('calculateCivilMonthlyDueDate: primeira data exatamente preservada e clamp de fim de mes', () => {
  // Teste com firstDueDate = 2027-01-31
  const d1 = calculateCivilMonthlyDueDate('2027-01-31', 1);
  const d2 = calculateCivilMonthlyDueDate('2027-01-31', 2);
  const d3 = calculateCivilMonthlyDueDate('2027-01-31', 3);
  const d4 = calculateCivilMonthlyDueDate('2027-01-31', 4);

  assert.equal(d1, '2027-01-31', 'Parcela 1 deve ser exatamente firstDueDate');
  assert.equal(d2, '2027-02-28', 'Parcela 2 em ano nao-bissexto deve fazer clamp para 28/02');
  assert.equal(d3, '2027-03-31', 'Parcela 3 deve restaurar a ancora dia 31 em marco');
  assert.equal(d4, '2027-04-30', 'Parcela 4 em abril deve fazer clamp para 30/04');

  // Teste em ano bissexto (2028)
  const b1 = calculateCivilMonthlyDueDate('2028-01-31', 1);
  const b2 = calculateCivilMonthlyDueDate('2028-01-31', 2);
  const b3 = calculateCivilMonthlyDueDate('2028-01-31', 3);

  assert.equal(b1, '2028-01-31');
  assert.equal(b2, '2028-02-29', 'Fevereiro 2028 deve fazer clamp para 29/02');
  assert.equal(b3, '2028-03-31');

  // Teste de virada de ano (Dezembro para Janeiro)
  const y1 = calculateCivilMonthlyDueDate('2026-11-15', 1);
  const y2 = calculateCivilMonthlyDueDate('2026-11-15', 2);
  const y3 = calculateCivilMonthlyDueDate('2026-11-15', 3);

  assert.equal(y1, '2026-11-15');
  assert.equal(y2, '2026-12-15');
  assert.equal(y3, '2027-01-15', 'Deve virar de ano corretamente');
});

test('toSafeIntegerCents: aceita inteiros e strings numericas inteiras; rejeita nao-inteiros, NaN, Infinity, null e booleans', () => {
  // Valores validos
  assert.equal(toSafeIntegerCents(100), 100);
  assert.equal(toSafeIntegerCents(0), 0);
  assert.equal(toSafeIntegerCents(-50), -50);
  assert.equal(toSafeIntegerCents('100'), 100);
  assert.equal(toSafeIntegerCents(' 3500 '), 3500);

  // Valores invalidos que devem ser estritamente rejeitados (retornar null)
  assert.equal(toSafeIntegerCents(100.6), null, '100.6 centavos deve ser rejeitado sem arredondamento');
  assert.equal(toSafeIntegerCents(2.6), null, '2.6 deve ser rejeitado sem arredondamento');
  assert.equal(toSafeIntegerCents('100.6'), null, 'string decimal deve ser rejeitada');
  assert.equal(toSafeIntegerCents(NaN), null, 'NaN deve retornar null');
  assert.equal(toSafeIntegerCents(Infinity), null, 'Infinity deve retornar null');
  assert.equal(toSafeIntegerCents(-Infinity), null, '-Infinity deve retornar null');
  assert.equal(toSafeIntegerCents(null), null, 'null deve retornar null');
  assert.equal(toSafeIntegerCents(undefined), null, 'undefined deve retornar null');
  assert.equal(toSafeIntegerCents(true), null, 'true deve retornar null');
  assert.equal(toSafeIntegerCents(false), null, 'false deve retornar null');
  assert.equal(toSafeIntegerCents({}), null, 'objeto deve retornar null');
  assert.equal(toSafeIntegerCents([]), null, 'array deve retornar null');
});

test('generatePaymentInstallmentSchedule: divisao exata de centavos e distribuicao do resto', () => {
  // 1. R$ 100,00 (10000 centavos) em 3x
  const p3 = generatePaymentInstallmentSchedule(10000, 3, '2027-01-31');
  assert.equal(p3.length, 3);
  assert.deepEqual(p3.map(x => x.amount), [3334, 3333, 3333]);
  assert.deepEqual(p3.map(x => x.due_date), ['2027-01-31', '2027-02-28', '2027-03-31']);
  assert.equal(p3.reduce((acc, x) => acc + x.amount, 0), 10000);

  // 2. R$ 10,00 (1000 centavos) em 7x (base = 142, resto = 6 -> 6x 143 + 1x 142)
  const p7 = generatePaymentInstallmentSchedule(1000, 7, '2027-05-10');
  assert.equal(p7.length, 7);
  assert.deepEqual(p7.map(x => x.amount), [143, 143, 143, 143, 143, 143, 142]);
  assert.equal(p7.reduce((acc, x) => acc + x.amount, 0), 1000);

  // 3. R$ 10,00 (1000 centavos) em 11x (base = 90, resto = 10 -> 10x 91 + 1x 90)
  const p11 = generatePaymentInstallmentSchedule(1000, 11, '2027-01-15');
  assert.equal(p11.length, 11);
  assert.deepEqual(p11.map(x => x.amount), [91, 91, 91, 91, 91, 91, 91, 91, 91, 91, 90]);
  assert.equal(p11.reduce((acc, x) => acc + x.amount, 0), 1000);

  // 4. R$ 10,00 (1000 centavos) em 12x (base = 83, resto = 4 -> 4x 84 + 8x 83)
  const p12 = generatePaymentInstallmentSchedule(1000, 12, '2027-01-15');
  assert.equal(p12.length, 12);
  assert.deepEqual(p12.map(x => x.amount), [84, 84, 84, 84, 83, 83, 83, 83, 83, 83, 83, 83]);
  assert.equal(p12.reduce((acc, x) => acc + x.amount, 0), 1000);

  // 5. Divisao exata sem resto: R$ 300,00 em 3x
  const pExact = generatePaymentInstallmentSchedule(30000, 3, '2027-02-10');
  assert.deepEqual(pExact.map(x => x.amount), [10000, 10000, 10000]);
});

test('generatePaymentInstallmentSchedule: rejeicao de parametros invalidos', () => {
  assert.throws(() => generatePaymentInstallmentSchedule(0, 3, '2027-01-31'), /Valor total invalido/);
  assert.throws(() => generatePaymentInstallmentSchedule(100.6, 3, '2027-01-31'), /Valor total invalido/);
  assert.throws(() => generatePaymentInstallmentSchedule(1000, 2.6, '2027-01-31'), /Quantidade de parcelas/);
  assert.throws(() => generatePaymentInstallmentSchedule(1000, 0, '2027-01-31'), /Quantidade de parcelas/);
  assert.throws(() => generatePaymentInstallmentSchedule(1000, 13, '2027-01-31'), /Quantidade de parcelas/);
  assert.throws(() => generatePaymentInstallmentSchedule(5, 10, '2027-01-31'), /excede o total de centavos/);
  assert.throws(() => generatePaymentInstallmentSchedule(1000, 3, 'data-invalida'), /Data de primeiro vencimento invalida/);
});

test('validatePaymentInstallmentSchedule: validacao de integridade e rejeicao de parcelas decimais', () => {
  const valid = [
    { installment_number: 1, installment_count: 3, amount: 3334, due_date: '2027-01-31' },
    { installment_number: 2, installment_count: 3, amount: 3333, due_date: '2027-02-28' },
    { installment_number: 3, installment_count: 3, amount: 3333, due_date: '2027-03-31' },
  ];
  assert.deepEqual(validatePaymentInstallmentSchedule(10000, valid), { valid: true });

  // Divergencia de soma
  assert.equal(validatePaymentInstallmentSchedule(9999, valid).valid, false);

  // Parcela com valor decimal (ex: 3333.33) deve ser rejeitada
  const decimalInstallments = [
    { installment_number: 1, installment_count: 3, amount: 3333.34, due_date: '2027-01-31' },
    { installment_number: 2, installment_count: 3, amount: 3333.33, due_date: '2027-02-28' },
    { installment_number: 3, installment_count: 3, amount: 3333.33, due_date: '2027-03-31' },
  ];
  assert.equal(validatePaymentInstallmentSchedule(10000, decimalInstallments).valid, false);

  // Sequencia incorreta
  const badSeq = [
    { installment_number: 1, installment_count: 2, amount: 50, due_date: '2027-01-10' },
    { installment_number: 3, installment_count: 2, amount: 50, due_date: '2027-02-10' },
  ];
  assert.equal(validatePaymentInstallmentSchedule(100, badSeq).valid, false);

  // Datas fora de ordem
  const badDates = [
    { installment_number: 1, installment_count: 2, amount: 50, due_date: '2027-02-10' },
    { installment_number: 2, installment_count: 2, amount: 50, due_date: '2027-01-10' },
  ];
  assert.equal(validatePaymentInstallmentSchedule(100, badDates).valid, false);
});

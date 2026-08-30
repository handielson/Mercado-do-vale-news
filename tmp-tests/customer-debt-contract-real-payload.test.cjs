'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generatePaymentInstallmentSchedule,
  validatePaymentInstallmentSchedule,
} = require('../utils/installmentCalculations.cjs');

// Simula a validação e criação atômica do endpoint /financial/customer-debts/from-sale na VPS
function simulateFromSaleEndpoint(body, mockDb) {
  const { customer_id, sale_id, valor_total, descricao, data_vencimento, installments } = body || {};

  if (!customer_id) return { status: 400, body: { error: 'customer_id obrigatorio' } };
  if (!sale_id) return { status: 400, body: { error: 'sale_id obrigatorio' } };
  if (!valor_total || isNaN(Number(valor_total)) || Number(valor_total) <= 0) {
    return { status: 400, body: { error: 'valor_total invalido' } };
  }
  if (!descricao || typeof descricao !== 'string' || !descricao.trim()) {
    return { status: 400, body: { error: 'descricao obrigatoria' } };
  }

  const valor = Math.round(Number(valor_total));

  let installmentList = [];
  if (Array.isArray(installments) && installments.length > 0) {
    installmentList = installments.map((inst, idx) => ({
      installment_number: Number(inst.installment_number) || (idx + 1),
      installment_count: Number(inst.installment_count) || installments.length,
      amount: Math.round(Number(inst.amount || inst.valor_total || 0)),
      due_date: String(inst.due_date || inst.data_vencimento || '').trim(),
    }));

    const validation = validatePaymentInstallmentSchedule(valor, installmentList);
    if (!validation.valid) {
      return { status: 400, body: { error: validation.error || 'Plano de parcelamento invalido' } };
    }
  } else {
    if (!data_vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(data_vencimento)) {
      return { status: 400, body: { error: 'data_vencimento invalida (YYYY-MM-DD)' } };
    }
    installmentList = [{
      installment_number: 1,
      installment_count: 1,
      amount: valor,
      due_date: data_vencimento,
    }];
  }

  const createdDebts = [];
  const createdReminders = [];

  for (const inst of installmentList) {
    const debtId = `debt-${sale_id}-${inst.installment_number}`;
    const reminderId = `rem-${debtId}`;
    const instDesc = installmentList.length > 1
      ? `${descricao.trim()} (Parcela ${inst.installment_number}/${inst.installment_count})`
      : descricao.trim();

    mockDb.customer_debts.push({
      id: debtId,
      customer_id,
      sale_id,
      installment_number: inst.installment_number,
      installment_count: inst.installment_count,
      valor_total: inst.amount,
      saldo_devedor: inst.amount,
      descricao: instDesc,
      data_vencimento: inst.due_date,
      status: 'pending',
    });

    mockDb.customer_debt_reminders.push({
      id: reminderId,
      debt_id: debtId,
      status: 'pending',
      scheduled_date: inst.due_date,
      attempts: 0,
      last_error: null,
      provider_message_id: null,
    });

    createdDebts.push({
      id: debtId,
      customer_id,
      sale_id,
      installment_number: inst.installment_number,
      installment_count: inst.installment_count,
      valor_total: inst.amount,
      saldo_devedor: inst.amount,
      descricao: instDesc,
      data_vencimento: inst.due_date,
      status: 'pending',
    });
  }

  if (createdDebts.length === 1) {
    return { status: 201, body: createdDebts[0] };
  }

  return {
    status: 201,
    body: {
      success: true,
      sale_id,
      customer_id,
      debts: createdDebts,
    },
  };
}

// Simula a serializacao real de saleService.ts
function buildRealSaleServicePayload({ customerId, saleId, amountCents, installmentCount, firstDueDate }) {
  const saleCode = saleId.slice(0, 8).toUpperCase();
  if (installmentCount > 1) {
    const schedule = generatePaymentInstallmentSchedule(amountCents, installmentCount, firstDueDate);
    return {
      customer_id: customerId,
      sale_id: saleId,
      valor_total: amountCents,
      descricao: `Venda PDV #${saleCode}`,
      data_vencimento: schedule[0]?.due_date || firstDueDate,
      installments: schedule.map(item => ({
        installment_number: item.installment_number,
        installment_count: item.installment_count,
        amount: item.amount,
        due_date: item.due_date,
        descricao: `Venda PDV #${saleCode} — Parcela ${item.installment_number}/${item.installment_count}`,
      })),
    };
  } else {
    return {
      customer_id: customerId,
      sale_id: saleId,
      valor_total: amountCents,
      descricao: `Venda PDV #${saleCode}`,
      data_vencimento: firstDueDate,
    };
  }
}

test('Contrato Real: Venda 1x a prazo gera payload com valor_total raiz e cria 1 debito e 1 reminder', () => {
  const mockDb = { customer_debts: [], customer_debt_reminders: [] };
  const payload = buildRealSaleServicePayload({
    customerId: 'cust-123',
    saleId: 'sale-0001-uuid',
    amountCents: 10000, // R$ 100,00
    installmentCount: 1,
    firstDueDate: '2027-01-31',
  });

  assert.equal(payload.valor_total, 10000);
  assert.equal(payload.descricao, 'Venda PDV #SALE-000');
  assert.equal(payload.data_vencimento, '2027-01-31');

  const response = simulateFromSaleEndpoint(payload, mockDb);
  assert.equal(response.status, 201);
  assert.equal(mockDb.customer_debts.length, 1);
  assert.equal(mockDb.customer_debt_reminders.length, 1);
  assert.equal(mockDb.customer_debt_reminders[0].scheduled_date, '2027-01-31');
  assert.equal(mockDb.customer_debts[0].valor_total, 10000);
});

test('Contrato Real: Venda 3x a prazo distribui centavos (3334, 3333, 3333) e cria 3 debitos com reminders', () => {
  const mockDb = { customer_debts: [], customer_debt_reminders: [] };
  const payload = buildRealSaleServicePayload({
    customerId: 'cust-456',
    saleId: 'sale-0003-uuid',
    amountCents: 10000, // R$ 100,00 -> 3334 + 3333 + 3333
    installmentCount: 3,
    firstDueDate: '2027-01-31',
  });

  assert.equal(payload.valor_total, 10000);
  assert.equal(payload.descricao, 'Venda PDV #SALE-000');
  assert.equal(payload.installments.length, 3);
  assert.equal(payload.installments[0].amount, 3334);
  assert.equal(payload.installments[1].amount, 3333);
  assert.equal(payload.installments[2].amount, 3333);
  assert.equal(payload.installments[0].due_date, '2027-01-31');
  assert.equal(payload.installments[1].due_date, '2027-02-28');
  assert.equal(payload.installments[2].due_date, '2027-03-31');

  const response = simulateFromSaleEndpoint(payload, mockDb);
  assert.equal(response.status, 201);
  assert.equal(mockDb.customer_debts.length, 3);
  assert.equal(mockDb.customer_debt_reminders.length, 3);

  const sumDebts = mockDb.customer_debts.reduce((sum, d) => sum + d.valor_total, 0);
  assert.equal(sumDebts, 10000);
  assert.equal(mockDb.customer_debt_reminders[1].scheduled_date, '2027-02-28');
});

test('Contrato Real: Venda 12x a prazo distribui centavos com exatidao e calcula 12 meses civis com clamp', () => {
  const mockDb = { customer_debts: [], customer_debt_reminders: [] };
  const payload = buildRealSaleServicePayload({
    customerId: 'cust-789',
    saleId: 'sale-0012-uuid',
    amountCents: 10000, // R$ 100,00 -> 837 nas primeiras 4 parcelas, 833 nas restantes 8 parcelas
    installmentCount: 12,
    firstDueDate: '2027-01-31',
  });

  assert.equal(payload.valor_total, 10000);
  assert.equal(payload.installments.length, 12);

  const response = simulateFromSaleEndpoint(payload, mockDb);
  assert.equal(response.status, 201);
  assert.equal(mockDb.customer_debts.length, 12);
  assert.equal(mockDb.customer_debt_reminders.length, 12);

  const totalSum = mockDb.customer_debts.reduce((sum, d) => sum + d.valor_total, 0);
  assert.equal(totalSum, 10000);

  // Verificar cortes de mes civil nas parcelas
  assert.equal(mockDb.customer_debts[0].data_vencimento, '2027-01-31');
  assert.equal(mockDb.customer_debts[1].data_vencimento, '2027-02-28');
  assert.equal(mockDb.customer_debts[2].data_vencimento, '2027-03-31');
  assert.equal(mockDb.customer_debts[3].data_vencimento, '2027-04-30');
  assert.equal(mockDb.customer_debts[4].data_vencimento, '2027-05-31');
  assert.equal(mockDb.customer_debts[5].data_vencimento, '2027-06-30');
  assert.equal(mockDb.customer_debts[6].data_vencimento, '2027-07-31');
  assert.equal(mockDb.customer_debts[7].data_vencimento, '2027-08-31');
  assert.equal(mockDb.customer_debts[8].data_vencimento, '2027-09-30');
  assert.equal(mockDb.customer_debts[9].data_vencimento, '2027-10-31');
  assert.equal(mockDb.customer_debts[10].data_vencimento, '2027-11-30');
  assert.equal(mockDb.customer_debts[11].data_vencimento, '2027-12-31');
});

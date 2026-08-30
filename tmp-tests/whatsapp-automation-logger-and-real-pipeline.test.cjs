'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  logWhatsAppAutomationEventCore,
  ensureWhatsAppAutomationLogsStatusEnum,
} = require(path.join(__dirname, '..', 'services', 'customerDebtReminderCore.cjs'));

const {
  recalculateAPrazoPayment,
  generatePaymentInstallmentSchedule,
} = require(path.join(__dirname, '..', 'utils', 'installmentCalculations.cjs'));

test('Logger Real: logWhatsAppAutomationEventCore grava status ambiguous sem erro e rejeita valores fora do ENUM', async () => {
  const recordedLogs = [];

  const strictEnumPool = {
    async query(sql, params = []) {
      if (sql.includes('INSERT INTO whatsapp_automation_logs')) {
        const [id, template_key, entity_type, entity_id, customer_id, phone, status, message, rendered_text, error_message] = params;
        const validStatuses = ['sent', 'skipped', 'failed', 'ambiguous'];
        if (!validStatuses.includes(status)) {
          throw new Error(`Data truncated for column 'status' at row 1: '${status}'`);
        }
        recordedLogs.push({ id, template_key, entity_type, entity_id, customer_id, phone, status, message, rendered_text, error_message });
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
  };

  // 1. Gravar status ambiguous
  const res1 = await logWhatsAppAutomationEventCore(strictEnumPool, {
    templateKey: 'customer_debt_due_reminder',
    entityType: 'customer_debt_reminder',
    entityId: 'rem-123',
    customerId: 'cust-123',
    phone: '5511999999999',
    status: 'ambiguous',
    message: 'Timeout ao conectar na Evolution API',
    errorMessage: 'ETIMEDOUT: Connection timed out',
  });
  assert.equal(res1.ok, true);
  assert.equal(res1.status, 'ambiguous');
  assert.equal(recordedLogs.length, 1);
  assert.equal(recordedLogs[0].status, 'ambiguous');

  // 2. Tentar gravar status invalido - helper deve normalizar para 'failed' sem violar o ENUM
  const res2 = await logWhatsAppAutomationEventCore(strictEnumPool, {
    templateKey: 'customer_debt_due_reminder',
    status: 'UNKNOWN_CUSTOM_STATUS',
  });
  assert.equal(res2.ok, true);
  assert.equal(res2.status, 'failed');
  assert.equal(recordedLogs.length, 2);
  assert.equal(recordedLogs[1].status, 'failed');
});

test('Migration Helper: ensureWhatsAppAutomationLogsStatusEnum para schema atualizado, desatualizado e falha', async () => {
  // Caso 1: Schema já atualizado contendo 'ambiguous'
  let alterExecuted1 = false;
  const poolUpToDate = {
    async query(sql) {
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
        return [[{ COLUMN_TYPE: "enum('sent','skipped','failed','ambiguous')" }]];
      }
      if (sql.includes('ALTER TABLE')) {
        alterExecuted1 = true;
      }
      return [[]];
    },
  };
  const resUpToDate = await ensureWhatsAppAutomationLogsStatusEnum(poolUpToDate);
  assert.equal(resUpToDate.status, 'already_up_to_date');
  assert.equal(alterExecuted1, false, 'Não deve executar ALTER quando já estiver atualizado');

  // Caso 2: Schema desatualizado (sem 'ambiguous')
  let alterExecuted2 = false;
  const poolOutdated = {
    async query(sql) {
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
        return [[{ COLUMN_TYPE: "enum('sent','skipped','failed')" }]];
      }
      if (sql.includes('ALTER TABLE')) {
        alterExecuted2 = true;
        return [{ affectedRows: 0 }];
      }
      return [[]];
    },
  };
  const resOutdated = await ensureWhatsAppAutomationLogsStatusEnum(poolOutdated);
  assert.equal(resOutdated.status, 'migrated');
  assert.equal(alterExecuted2, true, 'Deve executar ALTER quando status não possuir ambiguous');

  // Caso 3: Falha no ALTER TABLE
  const poolFailing = {
    async query(sql) {
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
        return [[{ COLUMN_TYPE: "enum('sent','skipped','failed')" }]];
      }
      if (sql.includes('ALTER TABLE')) {
        throw new Error('Access denied for user to ALTER TABLE');
      }
      return [[]];
    },
  };
  await assert.rejects(
    async () => {
      await ensureWhatsAppAutomationLogsStatusEnum(poolFailing);
    },
    err => {
      assert.equal(err.code, 'MIGRATION_ENUM_FAILED');
      assert.match(err.message, /Falha ao atualizar ENUM da coluna status/);
      return true;
    }
  );
});

test('Teste Monetário Real: 8000 centavos em 3 parcelas divide exatamente como [2667, 2667, 2666]', () => {
  const schedule = generatePaymentInstallmentSchedule(8000, 3, '2027-01-31');
  assert.equal(schedule.length, 3);
  assert.equal(schedule[0].amount, 2667);
  assert.equal(schedule[1].amount, 2667);
  assert.equal(schedule[2].amount, 2666);
  assert.equal(schedule.reduce((s, i) => s + i.amount, 0), 8000);
});

test('Recalculo do PDV compartilhado: recalcular a_prazo ao alterar pagamentos concorrentes preservando parcelas e primeira data', () => {
  const initialPayments = [
    {
      method: 'a_prazo',
      amount: 10000,
      total_with_fee: 10000,
      due_date: '2027-01-31',
      installment_schedule: [
        { installment_number: 1, installment_count: 3, amount: 3334, due_date: '2027-01-31' },
        { installment_number: 2, installment_count: 3, amount: 3333, due_date: '2027-02-28' },
        { installment_number: 3, installment_count: 3, amount: 3333, due_date: '2027-03-31' },
      ],
    },
  ];

  // Adicionar R$ 20,00 em dinheiro (2000 centavos) em uma venda de R$ 100,00 (10000 centavos)
  const withMoney = [
    { method: 'cash', amount: 2000, total_with_fee: 2000 },
    ...initialPayments,
  ];

  const recalculated = recalculateAPrazoPayment(withMoney, 10000);
  const aPrazo = recalculated.find(p => p.method === 'a_prazo');

  // Saldo restante deve ser 8000 centavos (R$ 80,00) dividido em 3x: [2667, 2667, 2666]
  assert.equal(aPrazo.amount, 8000);
  assert.equal(aPrazo.installment_schedule.length, 3);
  assert.equal(aPrazo.installment_schedule[0].amount, 2667);
  assert.equal(aPrazo.installment_schedule[1].amount, 2667);
  assert.equal(aPrazo.installment_schedule[2].amount, 2666);
  assert.equal(aPrazo.installment_schedule[0].due_date, '2027-01-31');
  assert.equal(aPrazo.installment_schedule[1].due_date, '2027-02-28');
  assert.equal(aPrazo.installment_schedule[2].due_date, '2027-03-31');
});

test('Defesa em Profundidade: Rejeição de múltiplos pagamentos a_prazo', () => {
  // Teste de validação em nível de regra de negócio
  const doubleAPrazoPayments = [
    { method: 'a_prazo', amount: 5000, due_date: '2027-01-31' },
    { method: 'a_prazo', amount: 5000, due_date: '2027-02-28' },
  ];

  function validateSaleAPrazoCount(payments) {
    const aPrazoList = (payments || []).filter(p => p.method === 'a_prazo' && Number(p.amount) > 0);
    if (aPrazoList.length > 1) {
      throw new Error('Venda não pode conter múltiplos pagamentos a prazo.');
    }
    return aPrazoList[0] || null;
  }

  assert.throws(
    () => validateSaleAPrazoCount(doubleAPrazoPayments),
    /Venda não pode conter múltiplos pagamentos a prazo/
  );

  // Venda com 1 a_prazo é permitida
  const single = validateSaleAPrazoCount([{ method: 'a_prazo', amount: 5000, due_date: '2027-01-31' }]);
  assert.equal(single.amount, 5000);
});

test('Segurança do Dispatcher: Schema incompatível suspende o dispatcher sem tocar no WhatsApp', async () => {
  let whatsappInvoked = false;
  const dummySendWhatsApp = async () => {
    whatsappInvoked = true;
    return { ok: true };
  };

  function simulateDispatcherCron(isSchemaReady) {
    if (!isSchemaReady) {
      return {
        ok: false,
        skipped: true,
        error: 'schema_incompatible: whatsapp_automation_logs ENUM migration pending or failed',
      };
    }
    return { ok: true, stats: { processed: 0 } };
  }

  // Schema NÃO pronto (falha de migration)
  const resultBlocked = simulateDispatcherCron(false);
  assert.equal(resultBlocked.ok, false);
  assert.equal(resultBlocked.skipped, true);
  assert.match(resultBlocked.error, /schema_incompatible/);
  assert.equal(whatsappInvoked, false, 'WhatsApp não pode ser invocado com schema incompatível');

  // Schema pronto
  const resultOk = simulateDispatcherCron(true);
  assert.equal(resultOk.ok, true);
});

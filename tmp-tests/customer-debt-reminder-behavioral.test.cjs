'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  processCustomerDebtReminders,
  cancelPendingRemindersForDebt,
  extractEvolutionProviderMessageId,
  buildDebtReminderTemplateVariables,
} = require(path.join(__dirname, '..', 'services', 'customerDebtReminderCore.cjs'));

const {
  generatePaymentInstallmentSchedule,
  validatePaymentInstallmentSchedule,
} = require(path.join(__dirname, '..', 'utils', 'installmentCalculations.cjs'));

// Mock de Pool e Conexão Transacional para testes comportamentais isolados
function createMockDb(initialData = {}) {
  const debts = new Map((initialData.debts || []).map(d => [d.id, { ...d }]));
  const reminders = new Map((initialData.reminders || []).map(r => [r.id, { ...r }]));
  const customers = new Map((initialData.customers || []).map(c => [c.id, { ...c }]));

  const pool = {
    async query(sql, params = []) {
      // 1. Stale processing locks update
      if (sql.includes("UPDATE customer_debt_reminders") && sql.includes("status = 'ambiguous'") && sql.includes("NOW() - INTERVAL 10 MINUTE")) {
        let affectedRows = 0;
        for (const [id, r] of reminders.entries()) {
          if (r.status === 'processing' && r.is_stale) {
            r.status = 'ambiguous';
            r.last_error = 'stale_processing_lock_timeout_needs_reconciliation';
            affectedRows++;
          }
        }
        return [{ affectedRows }];
      }

      // 2. Select eligible reminders
      if (sql.includes("FROM customer_debt_reminders r") && sql.includes("JOIN customer_debts d")) {
        const rows = [];
        for (const r of reminders.values()) {
          if (['pending', 'failed'].includes(r.status) && (r.attempts || 0) < 3) {
            const d = debts.get(r.debt_id);
            if (d) {
              rows.push({
                ...r,
                customer_id: d.customer_id,
                sale_id: d.sale_id,
                valor_total: d.valor_total,
                saldo_devedor: d.saldo_devedor,
                descricao: d.descricao,
                data_vencimento: d.data_vencimento,
                debt_status: d.status,
                installment_number: d.installment_number,
                installment_count: d.installment_count,
              });
            }
          }
        }
        return [rows];
      }

      // 3. Atomic lock on reminder
      if (sql.includes("UPDATE customer_debt_reminders") && sql.includes("status = 'processing'")) {
        const [id] = params;
        const r = reminders.get(id);
        if (r && ['pending', 'failed'].includes(r.status)) {
          r.status = 'processing';
          r.attempts = (r.attempts || 0) + 1;
          return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
      }

      // 4. Update reminder status
      if (sql.includes("UPDATE customer_debt_reminders")) {
        const id = params[params.length - 1];
        const r = reminders.get(id);
        if (r) {
          if (sql.includes("status = 'sent'")) {
            r.status = 'sent';
            r.provider_message_id = params[0];
          } else if (sql.includes("status = 'skipped'")) {
            r.status = 'skipped';
            r.last_error = params[0];
          } else if (sql.includes("status = 'ambiguous'")) {
            r.status = 'ambiguous';
            r.last_error = params[0];
          } else if (sql.includes("status = 'failed'")) {
            r.status = 'failed';
            r.last_error = params[0];
          }
        }
        return [{ affectedRows: 1 }];
      }

      return [{ affectedRows: 1 }];
    },

    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        async query(sql, params = []) {
          if (sql.includes("SELECT * FROM customer_debts WHERE id = ? FOR UPDATE")) {
            const [id] = params;
            const d = debts.get(id);
            return [[d ? { ...d } : null]];
          }
          if (sql.includes("SELECT id, name, phone, phone_country, cpf_cnpj FROM customers WHERE id = ?")) {
            const [id] = params;
            const c = customers.get(id);
            return [[c ? { ...c } : null]];
          }
          if (sql.includes("SELECT * FROM customer_debts WHERE sale_id = ?")) {
            const [saleId] = params;
            const rows = Array.from(debts.values()).filter(d => d.sale_id === saleId);
            return [rows];
          }
          if (sql.includes("WHERE debt_id = ?")) {
            const [debtId] = params;
            let affectedRows = 0;
            for (const r of reminders.values()) {
              if (r.debt_id === debtId && ['pending', 'failed', 'processing'].includes(r.status)) {
                r.status = 'skipped';
                affectedRows++;
              }
            }
            return [{ affectedRows }];
          }
          if (sql.includes("WHERE id = ?")) {
            const [id] = params;
            const r = reminders.get(id);
            if (r) {
              r.status = 'skipped';
              r.last_error = 'debt_already_paid_or_cancelled';
            }
            return [{ affectedRows: 1 }];
          }
          return [{ affectedRows: 1 }];
        },
      };
    },
  };

  return { pool, debts, reminders, customers };
}

test('Dispatcher: Parcela paga previamente nao chama o enviador e marca skipped', async () => {
  let sendCalls = 0;
  const db = createMockDb({
    customers: [{ id: 'c1', name: 'Maria', phone: '11999998888' }],
    debts: [{ id: 'd1', customer_id: 'c1', valor_total: 3334, saldo_devedor: 0, status: 'paid', installment_number: 1, installment_count: 3 }],
    reminders: [{ id: 'r1', debt_id: 'd1', scheduled_date: '2027-01-31', status: 'pending', attempts: 0 }],
  });

  const res = await processCustomerDebtReminders({
    pool: db.pool,
    dryRun: false,
    sendWhatsAppMessage: async () => {
      sendCalls++;
      return { status: 'sent' };
    },
  });

  assert.equal(sendCalls, 0, 'Nao deve chamar o enviador para parcela com saldo 0');
  assert.equal(db.reminders.get('r1').status, 'skipped');
  assert.equal(res.stats.skipped, 1);
  assert.equal(res.stats.sent, 0);
});

test('Dispatcher: Parcela cancelada nao chama o enviador e marca skipped', async () => {
  let sendCalls = 0;
  const db = createMockDb({
    customers: [{ id: 'c1', name: 'Maria', phone: '11999998888' }],
    debts: [{ id: 'd1', customer_id: 'c1', valor_total: 3334, saldo_devedor: 3334, status: 'cancelled', installment_number: 1, installment_count: 3 }],
    reminders: [{ id: 'r1', debt_id: 'd1', scheduled_date: '2027-01-31', status: 'pending', attempts: 0 }],
  });

  await processCustomerDebtReminders({
    pool: db.pool,
    dryRun: false,
    sendWhatsAppMessage: async () => {
      sendCalls++;
      return { status: 'sent' };
    },
  });

  assert.equal(sendCalls, 0, 'Nao deve chamar o enviador para parcela cancelada');
  assert.equal(db.reminders.get('r1').status, 'skipped');
});

test('Dispatcher: Parcela com baixa parcial envia saldo e historico recalculados', async () => {
  let capturedPayload = null;
  const db = createMockDb({
    customers: [{ id: 'c1', name: 'Maria', phone: '11999998888' }],
    debts: [
      { id: 'd1', customer_id: 'c1', sale_id: 'venda-123', valor_total: 3334, saldo_devedor: 1500, status: 'partial', installment_number: 1, installment_count: 2 },
      { id: 'd2', customer_id: 'c1', sale_id: 'venda-123', valor_total: 3333, saldo_devedor: 3333, status: 'pending', installment_number: 2, installment_count: 2 },
    ],
    reminders: [{ id: 'r1', debt_id: 'd1', scheduled_date: '2027-01-31', status: 'pending', attempts: 0 }],
  });

  await processCustomerDebtReminders({
    pool: db.pool,
    dryRun: false,
    sendWhatsAppMessage: async (payload) => {
      capturedPayload = payload;
      return { status: 'sent', result: { body: { key: { id: 'EVO-MSG-123' } } } };
    },
  });

  assert.ok(capturedPayload, 'Deve ter chamado o enviador');
  assert.equal(capturedPayload.phone, '11999998888');
  assert.equal(capturedPayload.variables.saldo_parcela, 'R$\xa015,00');
  assert.equal(capturedPayload.variables.valor_pago_parcela, 'R$\xa018,34');
  assert.match(capturedPayload.variables.historico_compra, /Parcela 1\/2/);
  assert.match(capturedPayload.variables.historico_compra, /Parcela 2\/2/);
  assert.equal(db.reminders.get('r1').status, 'sent');
  assert.equal(db.reminders.get('r1').provider_message_id, 'EVO-MSG-123');
});

test('Dispatcher: dry_run faz zero chamadas ao WhatsApp', async () => {
  let sendCalls = 0;
  const db = createMockDb({
    customers: [{ id: 'c1', name: 'Maria', phone: '11999998888' }],
    debts: [{ id: 'd1', customer_id: 'c1', valor_total: 3334, saldo_devedor: 3334, status: 'pending', installment_number: 1, installment_count: 3 }],
    reminders: [{ id: 'r1', debt_id: 'd1', scheduled_date: '2027-01-31', status: 'pending', attempts: 0 }],
  });

  const res = await processCustomerDebtReminders({
    pool: db.pool,
    dryRun: true,
    sendWhatsAppMessage: async () => {
      sendCalls++;
      return { status: 'sent' };
    },
  });

  assert.equal(sendCalls, 0, 'dry_run nunca deve chamar o enviador');
  assert.equal(res.stats.sent, 1);
  assert.equal(db.reminders.get('r1').status, 'pending', 'dry_run nao altera status no banco');
});

test('Dispatcher: Timeout ou erro de rede incerto classifica como ambiguous sem retry automatico', async () => {
  const db = createMockDb({
    customers: [{ id: 'c1', name: 'Maria', phone: '11999998888' }],
    debts: [{ id: 'd1', customer_id: 'c1', valor_total: 3334, saldo_devedor: 3334, status: 'pending', installment_number: 1, installment_count: 3 }],
    reminders: [{ id: 'r1', debt_id: 'd1', scheduled_date: '2027-01-31', status: 'pending', attempts: 0 }],
  });

  const res = await processCustomerDebtReminders({
    pool: db.pool,
    dryRun: false,
    sendWhatsAppMessage: async () => {
      const err = new Error('connect ETIMEDOUT 127.0.0.1:8080');
      err.code = 'ETIMEDOUT';
      throw err;
    },
  });

  assert.equal(res.stats.ambiguous, 1);
  assert.equal(db.reminders.get('r1').status, 'ambiguous');
  assert.match(db.reminders.get('r1').last_error, /network_timeout_or_uncertain/);
});

test('Dispatcher: Estado ambiguous nao sofre retry automatico', async () => {
  let sendCalls = 0;
  const db = createMockDb({
    customers: [{ id: 'c1', name: 'Maria', phone: '11999998888' }],
    debts: [{ id: 'd1', customer_id: 'c1', valor_total: 3334, saldo_devedor: 3334, status: 'pending', installment_number: 1, installment_count: 3 }],
    reminders: [{ id: 'r1', debt_id: 'd1', scheduled_date: '2027-01-31', status: 'processing', is_stale: true, attempts: 1 }],
  });

  const res = await processCustomerDebtReminders({
    pool: db.pool,
    dryRun: false,
    sendWhatsAppMessage: async () => {
      sendCalls++;
      return { status: 'sent' };
    },
  });

  assert.equal(sendCalls, 0, 'Lembretes em ambiguous nunca sofrem retry automatico');
  assert.equal(db.reminders.get('r1').status, 'ambiguous');
});

test('Baixa com liquidacao: cancelPendingRemindersForDebt cancela lembrete na mesma transacao', async () => {
  const db = createMockDb({
    reminders: [
      { id: 'r1', debt_id: 'd1', status: 'pending' },
      { id: 'r2', debt_id: 'd1', status: 'processing' },
      { id: 'r3', debt_id: 'd2', status: 'pending' },
    ],
  });

  const conn = await db.pool.getConnection();
  const affected = await cancelPendingRemindersForDebt(conn, 'd1');
  conn.release();

  assert.equal(affected, 2);
  assert.equal(db.reminders.get('r1').status, 'skipped');
  assert.equal(db.reminders.get('r2').status, 'skipped');
  assert.equal(db.reminders.get('r3').status, 'pending', 'Nao deve tocar lembrete de outro debito');
});

test('Conector Real: sendDeliveryWhatsappText simula timeout -> wrapper retorna ambiguous -> dispatcher grava ambiguous -> segunda execucao nao envia novamente', async () => {
  let lowLevelCalls = 0;

  // Simula o conector de baixo nivel da Evolution API
  async function mockSendDeliveryWhatsappText(phone, text) {
    lowLevelCalls++;
    const err = new Error('fetch failed: connect ETIMEDOUT 127.0.0.1:8080');
    err.code = 'ETIMEDOUT';
    throw err;
  }

  // Simula a implementacao exata de sendWhatsAppAutomationMessageVps do servidor
  async function sendWhatsAppAutomationMessageVpsSimulated(input) {
    try {
      const result = await mockSendDeliveryWhatsappText(input.phone, 'texto renderizado');
      return { status: 'sent', result };
    } catch (err) {
      const errorMessage = err?.message || 'Falha ao enviar WhatsApp automatico';
      const isTimeout = /timeout|etimedout|econnreset|socket|eai_again|gateway|502|503|504/i.test(errorMessage) || err?.code === 'ETIMEDOUT';
      const status = isTimeout ? 'ambiguous' : 'failed';
      return { status, error: errorMessage, reason: isTimeout ? 'network_timeout_or_uncertain' : 'send_failed' };
    }
  }

  const db = createMockDb({
    customers: [{ id: 'c1', name: 'Maria', phone: '11999998888' }],
    debts: [{ id: 'd1', customer_id: 'c1', valor_total: 3334, saldo_devedor: 3334, status: 'pending', installment_number: 1, installment_count: 3 }],
    reminders: [{ id: 'r1', debt_id: 'd1', scheduled_date: '2027-01-31', status: 'pending', attempts: 0 }],
  });

  // 1. Primeira execucao: conector sofre timeout
  const res1 = await processCustomerDebtReminders({
    pool: db.pool,
    dryRun: false,
    sendWhatsAppMessage: sendWhatsAppAutomationMessageVpsSimulated,
  });

  assert.equal(lowLevelCalls, 1, 'Primeira execucao deve ter tentado enviar 1 vez');
  assert.equal(res1.stats.ambiguous, 1, 'Resultado deve ser ambiguous');
  assert.equal(db.reminders.get('r1').status, 'ambiguous', 'Lembrete deve ser gravado como ambiguous no banco');
  assert.match(db.reminders.get('r1').last_error, /ETIMEDOUT/);

  // 2. Segunda execucao: o dispatcher NAO deve retentar o lembrete ambiguous
  const res2 = await processCustomerDebtReminders({
    pool: db.pool,
    dryRun: false,
    sendWhatsAppMessage: sendWhatsAppAutomationMessageVpsSimulated,
  });

  assert.equal(lowLevelCalls, 1, 'Segunda execucao NAO deve chamar o enviador novamente para lembrete ambiguous');
  assert.equal(res2.stats.sent, 0);
  assert.equal(res2.stats.ambiguous, 0);
  assert.equal(db.reminders.get('r1').status, 'ambiguous');
});

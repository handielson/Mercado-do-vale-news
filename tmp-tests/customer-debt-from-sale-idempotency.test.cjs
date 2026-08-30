'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createOrGetDebtsFromSale,
  evaluateDebtsIdempotency,
} = require(path.join(__dirname, '..', 'services', 'customerDebtReminderCore.cjs'));

function createMockDbConnection(initialDebts = []) {
  const debts = [...initialDebts.map(d => ({ ...d }))];
  const reminders = [];

  const connection = {
    debts,
    reminders,
    async query(sql, params = []) {
      if (sql.includes('SELECT * FROM customer_debts WHERE sale_id = ?')) {
        const [saleId] = params;
        const matching = debts.filter(d => d.sale_id === saleId);
        return [matching];
      }
      if (sql.includes('INSERT INTO customer_debts')) {
        const [id, customer_id, sale_id, installment_number, installment_count, valor_total, saldo_devedor, descricao, data_vencimento] = params;
        const newDebt = { id, customer_id, sale_id, installment_number, installment_count, valor_total, saldo_devedor, descricao, data_vencimento, status: 'pending' };
        debts.push(newDebt);
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('INSERT INTO customer_debt_reminders')) {
        const [id, debt_id, scheduled_date] = params;
        reminders.push({ id, debt_id, status: 'pending', scheduled_date, attempts: 0 });
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
  };

  return connection;
}

test('createOrGetDebtsFromSale: insercao inicial cria debitos e reminders com status 201', async () => {
  const conn = createMockDbConnection();
  const payload = {
    customer_id: 'cust-1',
    sale_id: 'sale-1',
    valor_total: 10000,
    descricao: 'Venda PDV #SALE-1',
    installments: [
      { installment_number: 1, installment_count: 2, amount: 5000, due_date: '2027-01-31' },
      { installment_number: 2, installment_count: 2, amount: 5000, due_date: '2027-02-28' },
    ],
  };

  const res = await createOrGetDebtsFromSale(conn, payload);
  assert.equal(res.status, 201);
  assert.equal(res.debts.length, 2);
  assert.equal(conn.debts.length, 2);
  assert.equal(conn.reminders.length, 2);
  assert.equal(conn.reminders[0].scheduled_date, '2027-01-31');
  assert.equal(conn.reminders[1].scheduled_date, '2027-02-28');
});

test('createOrGetDebtsFromSale: retry identico retorna registros existentes com status 200 (idempotencia)', async () => {
  const conn = createMockDbConnection();
  const payload = {
    customer_id: 'cust-1',
    sale_id: 'sale-1',
    valor_total: 10000,
    descricao: 'Venda PDV #SALE-1',
    installments: [
      { installment_number: 1, installment_count: 2, amount: 5000, due_date: '2027-01-31' },
      { installment_number: 2, installment_count: 2, amount: 5000, due_date: '2027-02-28' },
    ],
  };

  // Primeira chamada
  await createOrGetDebtsFromSale(conn, payload);
  assert.equal(conn.debts.length, 2);

  // Segunda chamada identica
  const res2 = await createOrGetDebtsFromSale(conn, payload);
  assert.equal(res2.status, 200);
  assert.equal(res2.isRetry, true);
  assert.equal(res2.debts.length, 2);
  assert.equal(conn.debts.length, 2, 'Nao deve duplicar registros no banco');
});

test('createOrGetDebtsFromSale: divergencia de cliente retorna 409', async () => {
  const conn = createMockDbConnection();
  const payload1 = {
    customer_id: 'cust-1',
    sale_id: 'sale-1',
    valor_total: 10000,
    descricao: 'Venda PDV #SALE-1',
    installments: [
      { installment_number: 1, installment_count: 2, amount: 5000, due_date: '2027-01-31' },
      { installment_number: 2, installment_count: 2, amount: 5000, due_date: '2027-02-28' },
    ],
  };
  await createOrGetDebtsFromSale(conn, payload1);

  // Divergencia de customer_id
  const payloadDiffCustomer = { ...payload1, customer_id: 'cust-2' };
  const res = await createOrGetDebtsFromSale(conn, payloadDiffCustomer);
  assert.equal(res.status, 409);
  assert.match(res.error, /Divergência detectada/);
});

test('createOrGetDebtsFromSale: divergencia de valor total retorna 409', async () => {
  const conn = createMockDbConnection();
  const payload1 = {
    customer_id: 'cust-1',
    sale_id: 'sale-1',
    valor_total: 10000,
    descricao: 'Venda PDV #SALE-1',
    installments: [
      { installment_number: 1, installment_count: 2, amount: 5000, due_date: '2027-01-31' },
      { installment_number: 2, installment_count: 2, amount: 5000, due_date: '2027-02-28' },
    ],
  };
  await createOrGetDebtsFromSale(conn, payload1);

  // Divergencia de valor_total
  const payloadDiffTotal = {
    ...payload1,
    valor_total: 8000,
    installments: [
      { installment_number: 1, installment_count: 2, amount: 4000, due_date: '2027-01-31' },
      { installment_number: 2, installment_count: 2, amount: 4000, due_date: '2027-02-28' },
    ],
  };
  const res = await createOrGetDebtsFromSale(conn, payloadDiffTotal);
  assert.equal(res.status, 409);
  assert.match(res.error, /Divergência detectada/);
});

test('createOrGetDebtsFromSale: divergencia de quantidade de parcelas retorna 409', async () => {
  const conn = createMockDbConnection();
  const payload1 = {
    customer_id: 'cust-1',
    sale_id: 'sale-1',
    valor_total: 10000,
    descricao: 'Venda PDV #SALE-1',
    installments: [
      { installment_number: 1, installment_count: 2, amount: 5000, due_date: '2027-01-31' },
      { installment_number: 2, installment_count: 2, amount: 5000, due_date: '2027-02-28' },
    ],
  };
  await createOrGetDebtsFromSale(conn, payload1);

  // Divergencia de count (3x em vez de 2x)
  const payloadDiffCount = {
    ...payload1,
    installments: [
      { installment_number: 1, installment_count: 3, amount: 3334, due_date: '2027-01-31' },
      { installment_number: 2, installment_count: 3, amount: 3333, due_date: '2027-02-28' },
      { installment_number: 3, installment_count: 3, amount: 3333, due_date: '2027-03-31' },
    ],
  };
  const res = await createOrGetDebtsFromSale(conn, payloadDiffCount);
  assert.equal(res.status, 409);
  assert.match(res.error, /Divergência detectada/);
});

test('createOrGetDebtsFromSale: divergencia de data de vencimento retorna 409', async () => {
  const conn = createMockDbConnection();
  const payload1 = {
    customer_id: 'cust-1',
    sale_id: 'sale-1',
    valor_total: 10000,
    descricao: 'Venda PDV #SALE-1',
    installments: [
      { installment_number: 1, installment_count: 2, amount: 5000, due_date: '2027-01-31' },
      { installment_number: 2, installment_count: 2, amount: 5000, due_date: '2027-02-28' },
    ],
  };
  await createOrGetDebtsFromSale(conn, payload1);

  // Divergencia de data
  const payloadDiffDate = {
    ...payload1,
    installments: [
      { installment_number: 1, installment_count: 2, amount: 5000, due_date: '2027-01-15' },
      { installment_number: 2, installment_count: 2, amount: 5000, due_date: '2027-02-15' },
    ],
  };
  const res = await createOrGetDebtsFromSale(conn, payloadDiffDate);
  assert.equal(res.status, 409);
  assert.match(res.error, /Divergência detectada/);
});

test('Concorrência da idempotência: duas requisições simultâneas sobrepostas via Promise.all criam apenas 1 conjunto e retornam 201 e 200 sem 500 ou duplicatas', async () => {
  // Simulador de Pool compartilhado com restrição de chave única por (sale_id, installment_number)
  const sharedTable = [];
  const sharedReminders = [];
  const pendingUniqueKeys = new Map();
  let initialReads = 0;
  let releaseInitialReads;
  const initialReadsReady = new Promise(resolve => { releaseInitialReads = resolve; });
  let duplicateConflictObserved = false;

  function createSharedDbConnection(connectionId) {
    let uncommittedDebts = [];
    let uncommittedReminders = [];
    let inTransaction = false;

    return {
      id: connectionId,
      async beginTransaction() {
        inTransaction = true;
        uncommittedDebts = [];
        uncommittedReminders = [];
      },
      async commit() {
        for (const d of uncommittedDebts) {
          sharedTable.push(d);
        }
        for (const r of uncommittedReminders) {
          sharedReminders.push(r);
        }
        uncommittedDebts = [];
        uncommittedReminders = [];
        inTransaction = false;
        for (const [key, owner] of pendingUniqueKeys) {
          if (owner.connectionId === connectionId) {
            owner.resolveCommit();
            pendingUniqueKeys.delete(key);
          }
        }
      },
      async rollback() {
        uncommittedDebts = [];
        uncommittedReminders = [];
        inTransaction = false;
      },
      release() {},
      async query(sql, params = []) {
        if (sql.includes('SELECT * FROM customer_debts WHERE sale_id = ?')) {
          initialReads += 1;
          if (initialReads === 2) releaseInitialReads();
          await initialReadsReady;
          const [saleId] = params;
          const matching = sharedTable.filter(d => d.sale_id === saleId);
          return [matching];
        }
        if (sql.includes('INSERT INTO customer_debts')) {
          const [id, customer_id, sale_id, installment_number, installment_count, valor_total, saldo_devedor, descricao, data_vencimento] = params;
          const uniqueKey = `${sale_id}:${installment_number}`;
          const exists = sharedTable.some(d => d.sale_id === sale_id && d.installment_number === installment_number);
          const pendingOwner = pendingUniqueKeys.get(uniqueKey);
          if (exists || (pendingOwner && pendingOwner.connectionId !== connectionId)) {
            if (pendingOwner && pendingOwner.connectionId !== connectionId) {
              duplicateConflictObserved = true;
              await pendingOwner.committed;
            }
            const err = new Error("Duplicate entry for key 'uniq_customer_debts_sale_installment'");
            err.code = 'ER_DUP_ENTRY';
            err.errno = 1062;
            throw err;
          }
          let resolveCommit;
          const committed = new Promise(resolve => { resolveCommit = resolve; });
          pendingUniqueKeys.set(uniqueKey, { connectionId, committed, resolveCommit });
          const newDebt = { id, customer_id, sale_id, installment_number, installment_count, valor_total, saldo_devedor, descricao, data_vencimento, status: 'pending' };
          uncommittedDebts.push(newDebt);
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('INSERT INTO customer_debt_reminders')) {
          const [id, debt_id, scheduled_date] = params;
          uncommittedReminders.push({ id, debt_id, status: 'pending', scheduled_date, attempts: 0 });
          return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 1 }];
      },
    };
  }

  let connSeq = 0;
  const mockPool = {
    async getConnection() {
      connSeq++;
      return createSharedDbConnection(connSeq);
    },
    async query(sql, params = []) {
      if (sql.includes('SELECT * FROM customer_debts WHERE sale_id = ?')) {
        const [saleId] = params;
        const matching = sharedTable.filter(d => d.sale_id === saleId);
        return [matching];
      }
      return [[]];
    },
  };

  // Simulação do endpoint real; a barreira força duas transações sobrepostas.
  async function simulateRealRoute(body) {
    let connection = await mockPool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await createOrGetDebtsFromSale(connection, body);
      if (result.status === 201 || result.status === 200) {
        await connection.commit();
        return { statusCode: result.status, body: result.debts ? { success: true, debts: result.debts, isRetry: result.isRetry } : result };
      } else {
        await connection.rollback();
        return { statusCode: result.status || 400, body: { error: result.error, details: result.details } };
      }
    } catch (err) {
      if (connection) {
        try { await connection.rollback(); } catch (_) {}
        try { connection.release(); } catch (_) {}
        connection = null;
      }

      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062 || /duplicate/i.test(err.message))) {
        const [freshDebts] = await mockPool.query(
          'SELECT * FROM customer_debts WHERE sale_id = ? ORDER BY installment_number ASC',
          [body.sale_id]
        );
        if (freshDebts && freshDebts.length > 0) {
          const check = evaluateDebtsIdempotency(freshDebts, body);
          if (check.isMatch) {
            return { statusCode: 200, body: { success: true, debts: freshDebts, isRetry: true } };
          } else {
            return { statusCode: 409, body: { error: 'Divergência detectada com parcelamento anterior desta venda', details: check.details } };
          }
        }
      }
      return { statusCode: 500, body: { error: 'Erro de banco', message: err?.message } };
    } finally {
      if (connection) connection.release();
    }
  }

  const payload = {
    customer_id: 'cust-concurrent',
    sale_id: 'sale-concurrent-1',
    valor_total: 10000,
    descricao: 'Venda Concorrente',
    installments: [
      { installment_number: 1, installment_count: 2, amount: 5000, due_date: '2027-01-31' },
      { installment_number: 2, installment_count: 2, amount: 5000, due_date: '2027-02-28' },
    ],
  };

  // Disparo simultâneo sobreposto via Promise.all
  const [resA, resB] = await Promise.all([
    simulateRealRoute(payload),
    simulateRealRoute(payload),
  ]);

  const statuses = [resA.statusCode, resB.statusCode].sort();
  assert.deepEqual(statuses, [200, 201], 'Uma requisição deve retornar 201 e a outra 200 (idempotente)');

  const res200 = resA.statusCode === 200 ? resA : resB;
  assert.equal(res200.body.isRetry, true, 'Resposta 200 deve indicar isRetry');
  assert.equal(duplicateConflictObserved, true, 'A segunda transação deve atravessar ER_DUP_ENTRY realista');

  // Requisição divergente contra o mesmo sale_id
  const resDivergent = await simulateRealRoute({
    ...payload,
    valor_total: 9000,
    installments: [
      { installment_number: 1, installment_count: 2, amount: 4500, due_date: '2027-01-31' },
      { installment_number: 2, installment_count: 2, amount: 4500, due_date: '2027-02-28' },
    ],
  });
  assert.equal(resDivergent.statusCode, 409, 'Requisição divergente deve receber 409 Conflict');

  // Nenhuma requisição deve ter retornado 500
  assert.notEqual(resA.statusCode, 500, 'Requisição A não pode retornar 500');
  assert.notEqual(resB.statusCode, 500, 'Requisição B não pode retornar 500');
  assert.notEqual(resDivergent.statusCode, 500, 'Requisição divergente não pode retornar 500');

  // Garantias no banco
  assert.equal(sharedTable.length, 2, 'Exatamente 2 parcelas criadas no banco');
  assert.equal(sharedReminders.length, 2, 'Exatamente 2 lembretes criados no banco, sem duplicações');
  assert.equal(sharedTable.filter(d => d.installment_number === 1).length, 1, 'Exatamente 1 registro para parcela 1');
  assert.equal(sharedTable.filter(d => d.installment_number === 2).length, 1, 'Exatamente 1 registro para parcela 2');
  const debtIds = sharedTable.map(d => d.id);
  for (const id of debtIds) {
    assert.equal(sharedReminders.filter(r => r.debt_id === id).length, 1, `Exatamente 1 reminder para o debito ${id}`);
  }
});

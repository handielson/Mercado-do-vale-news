'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Implementação isolada do helper para validação exata do comportamento e do SQL gerado
function createMockPool({ existingIndexes = [], existingColumns = [], duplicates = [] } = {}) {
  const executedQueries = [];
  return {
    executedQueries,
    async query(sql, params) {
      executedQueries.push({ sql, params });
      if (sql.includes('FROM INFORMATION_SCHEMA.STATISTICS')) {
        const [table, indexName] = params;
        const exists = existingIndexes.includes(`${table}.${indexName}`);
        return [[{ cnt: exists ? 1 : 0 }]];
      }
      if (sql.includes('FROM INFORMATION_SCHEMA.COLUMNS')) {
        const [table, colName] = params || [];
        const exists = existingColumns.includes(`${table}.${colName}`);
        return [[{ cnt: exists ? 1 : 0 }]];
      }
      if (sql.includes('GROUP BY sale_id, installment_number')) {
        return [duplicates];
      }
      return [{ affectedRows: 1 }];
    },
  };
}

async function addUniqueIndexIfMissing(pool, table, indexName, columnList) {
  const identPattern = /^[a-zA-Z0-9_]+$/;
  if (!identPattern.test(table) || !identPattern.test(indexName)) {
    throw new Error(`Identificador de tabela ou indice invalido: table=${table}, index=${indexName}`);
  }

  const columns = String(columnList)
    .split(',')
    .map(col => col.trim().replace(/`/g, ''))
    .filter(Boolean);

  if (columns.length === 0 || !columns.every(col => identPattern.test(col))) {
    throw new Error(`Lista de colunas invalida para indice unico ${indexName}: ${columnList}`);
  }

  const [[row]] = await pool.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );

  if (Number(row.cnt) === 0) {
    const escapedCols = columns.map(col => `\`${col}\``).join(', ');
    await pool.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${indexName}\` (${escapedCols})`);
    return { added: true, escapedCols };
  } else {
    return { added: false, skipped: true };
  }
}

async function runCustomerDebtsMigration(pool) {
  // 1. Auditoria read-only de duplicidades antes de criar UNIQUE index
  const [duplicates] = await pool.query(`
    SELECT sale_id, installment_number, COUNT(*) as cnt
      FROM customer_debts
     WHERE sale_id IS NOT NULL
     GROUP BY sale_id, installment_number
    HAVING cnt > 1
  `);

  let uniqueIndexResult = { added: false, skipped: false, reason: null };
  if (duplicates && duplicates.length > 0) {
    uniqueIndexResult = { added: false, skipped: true, reason: 'duplicates_found' };
  } else {
    uniqueIndexResult = await addUniqueIndexIfMissing(pool, 'customer_debts', 'uniq_customer_debts_sale_installment', 'sale_id, installment_number');
  }

  // 2. Tabela de lembretes e compatibilidade de schemas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_debt_reminders (
      id CHAR(36) PRIMARY KEY,
      debt_id CHAR(36) NOT NULL,
      status ENUM('pending', 'processing', 'sent', 'failed', 'skipped', 'ambiguous') NOT NULL DEFAULT 'pending',
      scheduled_date DATE NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      last_error TEXT NULL,
      provider_message_id VARCHAR(160) NULL,
      sent_at DATETIME NULL,
      reference_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customer_debt_reminders_debt (debt_id),
      INDEX idx_customer_debt_reminders_status_sched (status, scheduled_date),
      INDEX idx_customer_debt_reminders_ref (reference_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  return { uniqueIndexResult };
}

test('addUniqueIndexIfMissing: suporte a coluna simples existente', async () => {
  const pool = createMockPool();
  const res = await addUniqueIndexIfMissing(pool, 'customer_debt_payments', 'uniq_customer_debt_payments_mp_id', 'mercado_pago_id');
  assert.equal(res.added, true);
  assert.equal(res.escapedCols, '`mercado_pago_id`');
  assert.match(pool.executedQueries[1].sql, /ADD UNIQUE KEY `uniq_customer_debt_payments_mp_id` \(`mercado_pago_id`\)/);
});

test('addUniqueIndexIfMissing: suporte a colunas compostas', async () => {
  const pool = createMockPool();
  const res = await addUniqueIndexIfMissing(pool, 'customer_debts', 'uniq_customer_debts_sale_installment', 'sale_id, installment_number');
  assert.equal(res.added, true);
  assert.equal(res.escapedCols, '`sale_id`, `installment_number`');
  assert.match(pool.executedQueries[1].sql, /ADD UNIQUE KEY `uniq_customer_debts_sale_installment` \(`sale_id`, `installment_number`\)/);
});

test('addUniqueIndexIfMissing: pula criacao quando indice ja existe', async () => {
  const pool = createMockPool({ existingIndexes: ['customer_debts.uniq_customer_debts_sale_installment'] });
  const res = await addUniqueIndexIfMissing(pool, 'customer_debts', 'uniq_customer_debts_sale_installment', 'sale_id, installment_number');
  assert.equal(res.added, false);
  assert.equal(res.skipped, true);
});

test('addUniqueIndexIfMissing: rejeita identificadores com caracteres invalidos', async () => {
  const pool = createMockPool();
  await assert.rejects(
    () => addUniqueIndexIfMissing(pool, 'customer_debts; DROP TABLE', 'idx_test', 'col1'),
    /Identificador de tabela ou indice invalido/
  );
  await assert.rejects(
    () => addUniqueIndexIfMissing(pool, 'customer_debts', 'idx_test; DROP TABLE', 'col1'),
    /Identificador de tabela ou indice invalido/
  );
});

test('Migration: Schema vazio cria tabela customer_debt_reminders e indice unico normalmente', async () => {
  const pool = createMockPool({ duplicates: [] });
  const result = await runCustomerDebtsMigration(pool);
  assert.equal(result.uniqueIndexResult.added, true);
  assert(pool.executedQueries.some(q => q.sql.includes('CREATE TABLE IF NOT EXISTS customer_debt_reminders')));
});

test('Migration: Detecta duplicidades em schema legado e pula indice unico para nao derrubar a VPS', async () => {
  const pool = createMockPool({
    duplicates: [{ sale_id: 'sale-dup-1', installment_number: 1, cnt: 2 }],
  });
  const result = await runCustomerDebtsMigration(pool);
  assert.equal(result.uniqueIndexResult.added, false);
  assert.equal(result.uniqueIndexResult.skipped, true);
  assert.equal(result.uniqueIndexResult.reason, 'duplicates_found');
  // Garante que o ALTER TABLE ADD UNIQUE KEY nao foi executado
  assert(!pool.executedQueries.some(q => q.sql.includes('ADD UNIQUE KEY `uniq_customer_debts_sale_installment`')));
});

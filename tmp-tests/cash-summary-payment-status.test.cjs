'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  test(`${file}: cash summary uses real sale status and avoids same-session double refund`, async () => {
    const source = fs.readFileSync(file, 'utf8');
    const start = source.indexOf('async function computeCashSessionSummary(');
    const end = source.indexOf('function parseCashJsonColumn(', start);
    assert.ok(start > 0 && end > start);
    const queries = [];
    const db = {
      query: async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('FROM pdv_cash_sessions')) return [[{ opening_amount_cents: 1000 }]];
        if (sql.includes('FROM sales s')) return [[
          { id: 'paid', total: 10000, payment_method: 'money', status: 'completed' },
          { id: 'cancelled', total: 3000, payment_method: 'money', status: 'cancelled' },
        ]];
        if (sql.includes('FROM sales') && sql.includes('refund_cash_session_id')) return [[
          { id: 'cancelled', total: 3000, payment_method: 'money', status: 'cancelled', cash_session_id: 'session-a' },
          { id: 'older', total: 2000, payment_method: 'money', status: 'cancelled', cash_session_id: 'session-before' },
        ]];
        return [[]];
      },
    };
    const summary = await vm.runInNewContext(source.slice(start, end) + '\ncomputeCashSessionSummary(db, sessionId)', {
      db, sessionId: 'session-a', Number, String, Date, JSON, Math, Object, Array,
      normalizeCashAmountCents: Number,
      normalizeSalePaymentsForCash: row => [{ method: row.payment_method, amount_cents: Number(row.total) }],
      normalizeCashMethodKey: value => value,
    });
    assert.equal(summary.expected_cash_cents, 9000);
    assert.equal(summary.by_method.money, 8000);
    assert.equal(summary.counts.sales, 1);
    assert.equal(summary.counts.refunds, 2);
    const salesSql = queries.find(q => q.sql.includes('FROM sales s')).sql;
    const refundSql = queries.find(q => q.sql.includes('refund_cash_session_id')).sql;
    assert.match(salesSql, /s\.payment_status = 'paid'/);
    assert.match(refundSql, /payment_status IN \('cancelled', 'refunded'\)/);
    assert.doesNotMatch(salesSql, /s\.status/);
  });
}

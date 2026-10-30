'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Fastify = require('fastify');
const crypto = require('node:crypto');

const source = fs.readFileSync(require.resolve('../vps_server.cjs'), 'utf8');
const start = source.indexOf("fastify.post('/pdv/cash-sessions/:id/close'");
const end = source.indexOf("fastify.post('/pdv/cash-sessions/:id/reopen'", start);
assert.ok(start > 0 && end > start);
assert.match(source.slice(start, end), /COALESCE\(p\.is_gift, 0\) AS is_gift[\s\S]*?FROM sale_items si LEFT JOIN products p ON p\.id = si\.product_id/);

function fixture(t) {
  const app = Fastify();
  t.after(() => app.close());
  const state = {
    session: { id: 'test-session', session_number: 42, status: 'open', operator_user_id: 'test-user', opened_at: new Date('2026-10-29T12:00:00Z'), opening_amount_cents: 10000 },
    closings: [], documents: [], events: [], committed: false,
  };
  const db = {
    beginTransaction: async () => {}, rollback: async () => {}, commit: async () => { state.committed = true; }, release: () => {},
    query: async (sql, params) => {
      if (sql.includes('FROM pdv_cash_sessions')) return [[state.session]];
      if (sql.includes('MAX(version)')) return [[{ max_version: state.closings.length }]];
      if (sql.includes('FROM sale_items')) return [[{ sale_id: 'test-sale', product_name: 'Produto de teste', quantity: 1, unit_price: 3000, total: 3000, is_gift: 0 }]];
      if (sql.includes('INSERT INTO pdv_cash_closings')) { state.closings.push(params); return [{ affectedRows: 1 }]; }
      if (sql.includes("UPDATE pdv_cash_sessions SET status = 'closed'")) { state.session.status = 'closed'; return [{ affectedRows: 1 }]; }
      if (sql.includes('INSERT INTO pdv_cash_documents')) { state.documents.push(params); return [{ affectedRows: 1 }]; }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  vm.runInNewContext(source.slice(start, end), {
    fastify: app, requireAdminBearerToken: async () => {}, getCashAuthContext: async () => ({ userId: 'test-user', name: 'Operador de teste' }),
    normalizeCashCountJson: value => value || null,
    normalizeCashAmountCents: value => Math.round(Number(value || 0)),
    computeCashCountTotalCents: value => Object.entries(value).reduce((sum, [denom, count]) => sum + Number(denom) * Number(count), 0),
    limitText: value => String(value || '').trim() || null,
    pool: { getConnection: async () => db },
    computeCashSessionSummary: async () => ({ expected_cash_cents: 10000, by_method: { money: 3000 }, total_in_cents: 3000, movements_in_cents: 0, movements_out_cents: 0,
      sales: [{ id: 'test-sale' }], refunds: [], pix_avulso: [], debt_payments: [], delivery_settlements: [], delivery_ledger: [], movements: [], counts: { sales: 1 } }),
    mapCashSessionRow: session => ({ ...session }),
    recordCashEvent: async (_db, _req, event) => { state.events.push(event); },
    buildCashDocumentFileName: () => 'fechamento-caixa-teste.pdf', crypto, console,
  });
  return { app, state };
}

test('test cashier can close with a counted amount and receives an immutable report', async t => {
  const { app, state } = fixture(t);
  const url = '/pdv/cash-sessions/test-session/close';
  const missingReason = await app.inject({ method: 'POST', url, payload: { counted_cash_cents: 9000 } });
  assert.equal(missingReason.statusCode, 400);
  assert.equal(state.session.status, 'open');
  assert.equal(state.closings.length, 0);

  const closed = await app.inject({ method: 'POST', url, payload: { counted_cash_cents: 10000, counted_count_json: { 10000: 1 } } });
  assert.equal(closed.statusCode, 201, closed.body);
  const result = closed.json();
  assert.equal(result.closing.expected_cash_cents, 10000);
  assert.equal(result.closing.counted_cash_cents, 10000);
  assert.equal(result.closing.difference_cents, 0);
  assert.equal(result.report_snapshot.sales[0].items[0].product_name, 'Produto de teste');
  assert.equal(state.closings.length, 1);
  assert.equal(state.documents.length, 1);
  assert.equal(state.events[0].eventType, 'closing');
  assert.equal(state.session.status, 'closed');
  assert.equal(state.committed, true);

  const duplicate = await app.inject({ method: 'POST', url, payload: { counted_cash_cents: 10000 } });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(state.closings.length, 1);
});

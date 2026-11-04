// tiktok-finance-fees-v1: extrato dos pedidos concluídos do TikTok → totais por campo (só leitura, sem dados do comprador).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { summarizeOrderStatements, createTikTokFinanceFeesService } = require('../services/tiktokFinanceFees.cjs');

test('soma cada campo *_amount pelo caminho e calcula % sobre a receita', () => {
  const out = summarizeOrderStatements([
    { statement_transactions: [{ currency: 'BRL', revenue_amount: '100.00', platform_commission_amount: '-6.00', buyer_name: 'X', sku_statement_transactions: [{ platform_commission_amount: '-6.00' }] }] },
    { statement_transactions: [{ currency: 'BRL', revenue_amount: '50.00', platform_commission_amount: '-3.00' }] },
  ]);
  assert.equal(out.revenue_cents, 15000);
  assert.equal(out.currency, 'BRL');
  const commission = out.fields.find(f => f.path === 'statement_transactions[].platform_commission_amount');
  assert.equal(commission.total_cents, -900);
  assert.equal(commission.orders, 2);
  assert.equal(commission.pct_of_revenue, 6);
  assert.ok(!out.fields.some(f => /buyer/.test(f.path)), 'não expõe dados do comprador');
});

test('consulta só pedidos concluídos/entregues e não para em erro de um pedido', async () => {
  const queries = []; const calls = [];
  const service = createTikTokFinanceFeesService({
    pool: { query: async (sql, params) => { queries.push({ sql, params }); return [[{ external_id: '111' }, { external_id: 'bad id!' }, { external_id: '222' }]]; } },
    loadSettings: async () => ({}),
    callApi: async (_s, req) => { calls.push(req); if (req.pathname.includes('222')) { const e = new Error('scope'); e.tiktokCode = 105005; throw e; } return { payload: { data: { statement_transactions: [{ revenue_amount: '10', fee_amount: '-1' }] } } }; },
  });
  const out = await service.feeSummary({ limit: 999 });
  assert.match(queries[0].sql, /status IN \('COMPLETED', 'DELIVERED'\)/);
  assert.equal(queries[0].params[0], 30, 'limite máximo');
  assert.deepEqual(calls.map(c => c.pathname), ['/finance/202309/orders/111/statement_transactions', '/finance/202309/orders/222/statement_transactions']);
  assert.equal(calls[0].method, 'GET');
  assert.equal(out.orders_with_statement, 1);
  assert.equal(out.error_count, 1);
  assert.equal(out.errors[0].code, 105005);
});

test('rota protegida e módulo publicado pelo deploy', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    assert.match(fs.readFileSync(file, 'utf8'), /fastify\.get\('\/tiktok-shop\/finance\/fee-summary', \{ preHandler: requireSyncKeyOrAdmin \}/);
  }
  const deploy = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
  assert.match(deploy, /tiktokFinanceFeesPath = 'services\/tiktokFinanceFees\.cjs'/);
  assert.ok((deploy.match(/upload\(path\.join\(__dirname, tiktokFinanceFeesPath\)/g) || []).length + (deploy.match(/path\.join\(__dirname, tiktokFinanceFeesPath\),/g) || []).length >= 2, 'deploy seletivo e completo enviam o módulo');
});

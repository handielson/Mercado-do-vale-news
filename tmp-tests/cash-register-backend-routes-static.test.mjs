import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const server = readFileSync('vps_server.js', 'utf8');
const serverCjs = readFileSync('vps_server.cjs', 'utf8');

function assertRoutes(source, label) {
  for (const snippet of [
    "fastify.post('/pdv/cash-sessions/open', { preHandler: requireAdminBearerToken }",
    "fastify.get('/pdv/cash-sessions/current', { preHandler: requireAdminBearerToken }",
    "fastify.get('/pdv/cash-sessions', { preHandler: requireAdminBearerToken }",
    "fastify.get('/pdv/cash-sessions/:id', { preHandler: requireAdminBearerToken }",
    "fastify.get('/pdv/cash-sessions/:id/summary', { preHandler: requireAdminBearerToken }",
    "fastify.post('/pdv/cash-sessions/:id/close', { preHandler: requireAdminBearerToken }",
    "fastify.post('/pdv/cash-sessions/:id/reopen', { preHandler: requireAdminBearerToken }",
    "fastify.post('/pdv/cash-sessions/:id/rectify', { preHandler: requireAdminBearerToken }",
    "fastify.post('/pdv/cash-sessions/:id/movements', { preHandler: requireAdminBearerToken }",
    "fastify.post('/pdv/cash-documents/:id/upload', { preHandler: requireAdminBearerToken }",
    "fastify.get('/pdv/cash-documents/:id/file', { preHandler: requireAdminBearerToken }",
    "fastify.post('/pdv/cash-documents/:id/reprint', { preHandler: requireAdminBearerToken }",
    'function computeCashSessionSummary',
    'function recordCashEvent',
    'function normalizeSalePaymentsForCash',
    'function normalizeCashCountJson',
    'function computeCashCountTotalCents',
    'Justificativa obrigatoria quando ha diferenca entre valor esperado e encontrado',
    'Ja existe um caixa aberto para este operador',
    'Motivo da reabertura obrigatorio',
    'Motivo da retificacao obrigatorio',
    "WHERE operator_user_id = ? AND status = 'open' LIMIT 1 FOR UPDATE",
    'SELECT * FROM pdv_cash_sessions WHERE id = ? LIMIT 1 FOR UPDATE',
    'report_snapshot_json',
    'COALESCE(MAX(version), 0) AS max_version',
  ]) {
    assert.ok(source.includes(snippet), `${label} must include ${snippet}`);
  }

  // Denominacoes brasileiras completas em centavos.
  assert.ok(
    source.includes('CASH_DENOMINATIONS_CENTS = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5]'),
    `${label} must declare all BRL denominations in cents`
  );

  // Vinculo dos fluxos existentes ao caixa.
  assert.match(
    source,
    /INSERT INTO customer_debt_payments \(id, debt_id, valor_pago, data_pagamento, metodo_pagamento, observacoes, cash_session_id\)/,
    `${label} debt payment insert must persist cash_session_id`
  );
  assert.match(
    source,
    /INSERT INTO customer_delivery_settlements[\s\S]{0,200}cash_session_id/,
    `${label} delivery settlement insert must persist cash_session_id`
  );
  assert.match(
    source,
    /INSERT INTO customer_delivery_ledger[\s\S]{0,300}cash_session_id/,
    `${label} delivery ledger insert must persist cash_session_id`
  );
  assert.match(
    source,
    /INSERT INTO pdv_pix_payments[\s\S]{0,400}cash_session_id/,
    `${label} standalone pix insert must persist cash_session_id`
  );
}

assertRoutes(server, 'vps_server.js');
assertRoutes(serverCjs, 'vps_server.cjs');

console.log('cash register backend routes static checks passed');

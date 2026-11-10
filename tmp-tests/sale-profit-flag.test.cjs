// sale-profit-flag-v1: venda com lucro negativo fica com fundo vermelho na lista de Vendas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const financials = require('../services/marketplaceSaleFinancials.cjs');

test('registro do lucro do pedido valida canal, ids e valor', () => {
  assert.deepEqual(financials.normalizeSaleProfitInput({ channel: 'mercado_livre', connection_id: '', external_id: '2000019453301150', profit_cents: -1234, origin: 'marketplace' }),
    { channel: 'mercado_livre', connection_id: '', external_id: '2000019453301150', profit_cents: -1234, origin: 'marketplace' });
  assert.equal(financials.normalizeSaleProfitInput({ channel: 'tiktok', external_id: '1', profit_cents: 10, origin: 'xyz' }).origin, 'marketplace');
  assert.throws(() => financials.normalizeSaleProfitInput({ channel: 'pdv', external_id: '1', profit_cents: 1 }), /Canal inválido/);
  assert.throws(() => financials.normalizeSaleProfitInput({ channel: 'tiktok', external_id: "1' OR 1=1", profit_cents: 1 }), /Pedido inválido/);
  assert.throws(() => financials.normalizeSaleProfitInput({ channel: 'tiktok', external_id: '1', profit_cents: 1.5 }), /Lucro inválido/);
});

test('rotas registradas na API atrás do token de admin, nos dois servidores', () => {
  for (const file of ['vps_server.cjs', 'vps_server.js']) {
    assert.match(fs.readFileSync(file, 'utf8'), /registerMarketplaceSaleProfitRoutes\(fastify, \{ pool, guard: \{ preHandler: requireAdminBearerToken \} \}\)/, file);
  }
  const source = fs.readFileSync('services/marketplaceSaleFinancials.cjs', 'utf8');
  assert.match(source, /CREATE TABLE IF NOT EXISTS marketplace_sale_profit/);
  assert.match(source, /fastify\.put\('\/admin\/marketplace-sale-profits'/);
  assert.match(source, /fastify\.post\('\/admin\/marketplace-sale-profits\/lookup'/);
});

test('o detalhe do pedido grava o lucro que o Financeiro da venda mostrou (sem recalcular)', () => {
  const service = fs.readFileSync('services/adminMarketplaceSalesService.ts', 'utf8');
  assert.match(service, /const detailed = await withEstimatedFinancial\(refreshed\);\s*void recordMarketplaceSaleProfit\(detailed\);/);
  assert.match(service, /financial\?\.profit_cents/);
  assert.match(service, /\['cancelled', 'refunded'\]\.includes/);
});

test('lista de Vendas: fundo vermelho, valor do prejuízo e filtro "Só prejuízo"', () => {
  const page = fs.readFileSync('pages/admin/sales/SalesPage.tsx', 'utf8');
  assert.match(page, /row\.profitCents !== null && row\.profitCents < 0\s*\? 'bg-red-50/);
  assert.match(page, /Prejuízo \{formatCurrency\(row\.profitCents\)\}/);
  assert.match(page, /profitCents: \['cancelled', 'refunded'\]\.includes\(String\(sale\.status\)\) \? null : getSaleRealProfit\(sale\)/, 'PDV usa o mesmo lucro do resumo e do detalhe');
  assert.match(page, /storedProfits\[saleProfitKey\(sale\)\]\?\.profit_cents/);
  assert.match(page, /Só prejuízo/);
  assert.match(page, /Verificar lucro dos marketplaces/);
});

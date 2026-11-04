'use strict';

// tiktok-finance-fees-v1: taxas reais do TikTok Shop a partir do extrato de pedidos concluídos
// (GET /finance/202309/orders/{order_id}/statement_transactions). Só leitura; devolve apenas valores
// agregados por campo (sem dados do comprador). Os nomes dos campos não são fixados aqui: todo campo
// "*_amount" é somado pelo caminho em que aparece, e a tela sugere a tabela de taxas a partir deles.

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

function collectAmounts(node, path, out) {
  if (Array.isArray(node)) {
    for (const item of node) collectAmounts(item, `${path}[]`, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    const next = path ? `${path}.${key}` : key;
    if (value && typeof value === 'object') { collectAmounts(value, next, out); continue; }
    if (!/_amount$/.test(key)) continue;
    const amount = toNumber(value);
    if (amount === null) continue;
    out.set(next, (out.get(next) || 0) + amount);
  }
}

function summarizeOrderStatements(statements) {
  const totals = new Map();
  const orderCounts = new Map();
  let revenue = 0;
  let currency = null;
  for (const data of statements) {
    const perOrder = new Map();
    collectAmounts(data, '', perOrder);
    for (const [path, amount] of perOrder) {
      totals.set(path, (totals.get(path) || 0) + amount);
      orderCounts.set(path, (orderCounts.get(path) || 0) + 1);
    }
    const transactions = Array.isArray(data?.statement_transactions) ? data.statement_transactions : [];
    for (const transaction of transactions) {
      const value = toNumber(transaction?.revenue_amount);
      if (value !== null) revenue += value;
      if (!currency && transaction?.currency) currency = String(transaction.currency);
    }
  }
  const revenueCents = Math.round(revenue * 100);
  const fields = [...totals.entries()].map(([path, total]) => ({
    path,
    total_cents: Math.round(total * 100),
    orders: orderCounts.get(path) || 0,
    pct_of_revenue: revenueCents ? Math.round((Math.abs(total * 100) / revenueCents) * 10000) / 100 : null,
  })).sort((a, b) => a.path.localeCompare(b.path));
  return { revenue_cents: revenueCents, currency, fields };
}

function createTikTokFinanceFeesService({ pool, loadSettings, callApi, maxOrders = 30 }) {
  async function feeSummary({ limit } = {}) {
    const take = Math.min(Math.max(Number(limit) || 20, 1), maxOrders);
    const [rows] = await pool.query(
      `SELECT external_id FROM marketplace_sales_cache
        WHERE channel = 'tiktok' AND status IN ('COMPLETED', 'DELIVERED')
        ORDER BY occurred_at DESC LIMIT ?`,
      [take],
    );
    const settings = await loadSettings();
    const statements = [];
    const errors = [];
    for (const row of rows) {
      const orderId = String(row.external_id || '').trim();
      if (!/^[0-9A-Za-z_-]{1,64}$/.test(orderId)) continue;
      try {
        const result = await callApi(settings, { method: 'GET', pathname: `/finance/202309/orders/${encodeURIComponent(orderId)}/statement_transactions` });
        const data = result?.payload?.data;
        if (data && typeof data === 'object') statements.push(data);
      } catch (error) {
        errors.push({ code: error?.tiktokCode || null, message: String(error?.message || 'erro').slice(0, 200) });
      }
    }
    return { orders_considered: rows.length, orders_with_statement: statements.length, errors: errors.slice(0, 5), error_count: errors.length, ...summarizeOrderStatements(statements) };
  }
  return { feeSummary };
}

module.exports = { collectAmounts, summarizeOrderStatements, createTikTokFinanceFeesService };

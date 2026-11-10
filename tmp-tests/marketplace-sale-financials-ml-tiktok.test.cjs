// marketplace-sale-financials-ml-tiktok-v1: financeiro da venda (taxas e lucro) do Mercado Livre e do TikTok Shop.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  buildShopeeSaleFinancials,
  buildMercadoLivreSaleFinancials,
  buildTikTokSaleFinancials,
  createMercadoLivreSaleFinancialsLoader,
  createTikTokSaleFinancialsLoader,
  createShopeeSaleFinancialsLoader,
} = require('../services/marketplaceSaleFinancials.cjs');

// Pedido no formato lido por mercadoLivreOrderToAdminSale / mercadoLivreOrderToErpReview.
const mlOrder = {
  id: 2000001234567890,
  status: 'paid',
  tags: ['paid', 'delivered'],
  seller: { id: 999 },
  pack_id: null,
  shipping: { id: 44001 },
  currency_id: 'BRL',
  total_amount: 150,
  order_items: [
    { item: { id: 'MLB111', title: 'Capinha Redmi', seller_sku: 'CAP-RN13', variation_id: 777 }, quantity: 2, unit_price: 50, sale_fee: 7.5 },
    { item: { id: 'MLB222', title: 'Película', seller_sku: 'PEL-1', variation_id: null }, quantity: 1, unit_price: 50, sale_fee: 9 },
  ],
  payments: [
    { id: 1, status: 'approved', transaction_amount: 150, total_paid_amount: 168.9, marketplace_fee: 24, shipping_cost: 18.9, taxes_amount: 0 },
  ],
};
const mlShipmentCosts = { receiver: { cost: 18.9 }, senders: [{ user_id: 999, cost: 21.45, compensation: 0 }] };

test('ML: mapeia tarifa (sale_fee × qtd.), frete do vendedor e lucro', () => {
  const result = buildMercadoLivreSaleFinancials({
    order: mlOrder,
    shipmentCosts: mlShipmentCosts,
    costItems: [
      { name: 'Capinha', quantity: 2, unit_cost_cents: 1000, total_cost_cents: 2000 },
      { name: 'Película', quantity: 1, unit_cost_cents: 500, total_cost_cents: 500 },
    ],
  });
  assert.equal(result.source, 'mercado_livre_order');
  assert.equal(result.origin, 'marketplace');
  assert.equal(result.state, 'final', 'pedido entregue = valores finais');
  assert.equal(result.payout_label, 'Valor recebido do Mercado Livre');
  assert.equal(result.product_revenue_cents, 15000);
  assert.deepEqual(result.fee_lines.map((line) => [line.key, line.amount_cents]), [['sale_fee', -2400], ['seller_shipping', -2145]]);
  assert.equal(result.payout_cents, 15000 - 2400 - 2145);
  assert.equal(result.marketplace_deductions_cents, 4545);
  assert.equal(result.cost.total_cents, 2500);
  assert.equal(result.profit_cents, 10455 - 2500);
  assert.equal(Math.round(result.margin_pct * 100) / 100, Math.round(((10455 - 2500) / 15000) * 10000) / 100);
  assert.equal(result.buyer_paid_cents, 16890, 'frete pago pelo comprador não entra no valor da venda');
  assert.equal(result.estimate_basis, null);
  assert.ok(result.raw_fields.some((field) => field.key === 'marketplace_fee' && field.amount_cents === 2400));
});

test('ML: sem sale_fee nos itens usa marketplace_fee dos pagamentos; impostos e pedido não entregue', () => {
  const order = {
    ...mlOrder,
    tags: ['paid'],
    order_items: mlOrder.order_items.map(({ sale_fee, ...entry }) => entry),
    payments: [{ ...mlOrder.payments[0], marketplace_fee: '24.00', taxes_amount: 1.5 }, { id: 2, status: 'rejected', marketplace_fee: 99 }],
  };
  const result = buildMercadoLivreSaleFinancials({ order, shipmentCosts: mlShipmentCosts, costItems: [] });
  assert.equal(result.state, 'estimated');
  assert.match(result.note, /podem mudar até a entrega/);
  assert.deepEqual(result.fee_lines.map((line) => [line.key, line.amount_cents]), [['sale_fee', -2400], ['seller_shipping', -2145], ['taxes', -150]]);
  assert.equal(result.payout_cents, 15000 - 2400 - 2145 - 150);
  assert.equal(result.cost.complete, false);
});

test('ML: falha no custo do envio deixa o valor provisório com aviso', () => {
  const result = buildMercadoLivreSaleFinancials({ order: mlOrder, shipmentCosts: null, shipmentCostsError: 'HTTP 403', costItems: [] });
  assert.equal(result.state, 'estimated');
  assert.match(result.note, /Frete do vendedor não informado \(HTTP 403\)/);
  assert.equal(result.fee_lines.some((line) => line.key === 'seller_shipping'), false);
});

test('ML: sem dados reais devolve base para estimativa; cancelado não estima', () => {
  const saleItems = [{ name: 'Capinha', sku: 'CAP-RN13', quantity: 2, unit_price_cents: 5000 }];
  const unavailable = buildMercadoLivreSaleFinancials({ order: null, saleItems, costItems: [{ unit_cost_cents: 1000, total_cost_cents: 2000, quantity: 2 }], error: 'boom' });
  assert.equal(unavailable.state, 'unavailable');
  assert.equal(unavailable.payout_cents, null);
  assert.equal(unavailable.profit_cents, null);
  assert.equal(unavailable.note, 'boom');
  assert.deepEqual(unavailable.estimate_basis, {
    channel_fee_id: 'mercado_livre', reason: 'boom',
    items: [{ name: 'Capinha', quantity: 2, unit_price_cents: 5000, unit_cost_cents: 1000 }],
  });
  const noFee = buildMercadoLivreSaleFinancials({ order: { ...mlOrder, order_items: [{ ...mlOrder.order_items[0], sale_fee: null }], payments: [] } });
  assert.equal(noFee.state, 'unavailable');
  assert.match(noFee.note, /não informou a tarifa/);
  assert.equal(noFee.estimate_basis.items[0].unit_price_cents, 5000);
  const cancelled = buildMercadoLivreSaleFinancials({ order: { ...mlOrder, status: 'cancelled' } });
  assert.equal(cancelled.state, 'cancelled');
  assert.equal(cancelled.estimate_basis, null);
});

test('ML loader: busca pedido bruto + custo do envio e resolve custo pelo vínculo do anúncio', async () => {
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/FROM mercado_livre_products/.test(sql)) return [[{ product_id: 'p-cap', item_id: 'MLB111', variation_id: '777' }]];
      if (/FROM units/.test(sql)) return [[]];
      return [[{ id: 'p-cap', name: 'Capinha', sku: 'CAP-RN13', price_cost: 1000 }, { id: 'p-pel', name: 'Película', sku: 'PEL-1', price_cost: 300 }]];
    },
  };
  const calls = [];
  const load = createMercadoLivreSaleFinancialsLoader({ pool, fetchSource: async (id) => { calls.push(id); return { order: mlOrder, shipmentCosts: mlShipmentCosts }; } });
  const result = await load({ external_id: '2000001234567890', status: 'paid', details: { items: [] } });
  assert.deepEqual(calls, ['2000001234567890']);
  assert.deepEqual(queries[0].params, ['MLB111', 'MLB222']);
  assert.deepEqual(result.cost.items.map((item) => [item.product_id, item.matched_by, item.total_cost_cents]), [['p-cap', 'marketplace_link', 2000], ['p-pel', 'sku', 300]]);
  assert.equal(result.profit_cents, 10455 - 2300);
  assert.equal(await load({ external_id: 'abc' }), null, 'id inválido não consulta a API');
});

test('ML loader: erro da API vira base de estimativa com os itens da venda', async () => {
  const pool = { async query() { return [[]]; } };
  const load = createMercadoLivreSaleFinancialsLoader({ pool, fetchSource: async () => { throw new Error('Mercado Livre API 500: x'); } });
  const result = await load({ external_id: '123', details: { items: [{ name: 'Item', sku: '', quantity: 1, unit_price_cents: 9990 }] } });
  assert.equal(result.state, 'unavailable');
  assert.match(result.note, /Não foi possível consultar as tarifas no Mercado Livre/);
  assert.equal(result.estimate_basis.items[0].unit_price_cents, 9990);
});

const tiktokStatement = {
  statement_transactions: [{
    currency: 'BRL',
    revenue_amount: '100.00',
    settlement_amount: '72.00',
    fee_amount: '-20.00',
    platform_commission_amount: '-12.00',
    transaction_fee_amount: '-3.00',
    shipping_cost_amount: '-5.00',
    buyer_name: 'não expor',
    sku_statement_transactions: [{ platform_commission_amount: '-12.00' }],
  }],
};

test('TikTok: extrato real reconcilia com o settlement e ignora totais/SKU', () => {
  const result = buildTikTokSaleFinancials({ statement: tiktokStatement, orderStatus: 'COMPLETED', costItems: [{ unit_cost_cents: 3000, total_cost_cents: 3000, quantity: 1 }] });
  assert.equal(result.source, 'tiktok_statement');
  assert.equal(result.origin, 'marketplace');
  assert.equal(result.state, 'final');
  assert.equal(result.product_revenue_cents, 10000);
  assert.equal(result.payout_cents, 7200);
  const keys = result.fee_lines.map((line) => line.key);
  assert.ok(!keys.includes('fee_amount'), 'total agregado não conta duas vezes');
  assert.equal(result.fee_lines.find((line) => line.key === 'shipping_cost_amount').label, 'Frete pago pelo vendedor');
  assert.equal(result.fee_lines.find((line) => line.key === 'other_adjustments').amount_cents, -800);
  assert.equal(result.product_revenue_cents + result.fee_lines.reduce((sum, line) => sum + line.amount_cents, 0), result.payout_cents);
  assert.equal(result.profit_cents, 4200);
  assert.ok(!result.raw_fields.some((field) => /buyer/.test(field.key)));
});

test('TikTok: código 105005 (sem escopo de Finanças) cai para base de estimativa', async () => {
  const pool = {
    async query(sql) {
      if (/FROM tiktok_shop_products/.test(sql)) return [[{ product_id: 'p1', tiktok_product_id: 'tp1', tiktok_sku_id: 'ts1' }]];
      if (/FROM units/.test(sql)) return [[]];
      return [[{ id: 'p1', name: 'Fone', sku: 'FONE1', price_cost: 2500 }]];
    },
  };
  const load = createTikTokSaleFinancialsLoader({
    pool,
    fetchStatement: async () => { const error = new Error('Access denied'); error.tiktokCode = 105005; throw error; },
    fetchOrder: async () => ({ id: '5770', status: 'AWAITING_SHIPMENT', line_items: [{ product_id: 'tp1', sku_id: 'ts1', product_name: 'Fone', seller_sku: 'FONE1', sale_price: '89.90' }] }),
  });
  const result = await load({ external_id: '5770', status: 'AWAITING_SHIPMENT', details: { items: [] } });
  assert.equal(result.state, 'unavailable');
  assert.match(result.note, /105005/);
  assert.equal(result.estimate_basis.channel_fee_id, 'tiktok');
  assert.deepEqual(result.estimate_basis.items, [{ name: 'Fone', quantity: 1, unit_price_cents: 8990, unit_cost_cents: 2500 }]);
  assert.equal(result.cost.items[0].matched_by, 'marketplace_link');
});

test('TikTok: sem extrato ainda e pedido cancelado', () => {
  const pending = buildTikTokSaleFinancials({ statement: { statement_transactions: [] }, orderStatus: 'IN_TRANSIT', saleItems: [{ name: 'X', quantity: 1, unit_price_cents: 1000 }] });
  assert.equal(pending.state, 'unavailable');
  assert.match(pending.note, /ainda não gerou o extrato/);
  assert.equal(pending.estimate_basis.items[0].unit_price_cents, 1000);
  const cancelled = buildTikTokSaleFinancials({ statement: null, orderStatus: 'CANCELLED' });
  assert.equal(cancelled.state, 'cancelled');
  assert.equal(cancelled.estimate_basis, null);
});

test('Shopee inalterada: sem origin/payout_label e vínculo shopee_link', async () => {
  const result = buildShopeeSaleFinancials({ escrowResponse: { order_income: { original_price: 100, commission_fee: 17, escrow_amount: 80 } }, orderStatus: 'COMPLETED' });
  assert.equal(result.source, 'shopee_escrow');
  assert.equal(result.origin, undefined);
  assert.equal(result.payout_label, undefined);
  assert.equal(result.estimate_basis, undefined);
  assert.equal(result.payout_cents, 8000);
  const pool = {
    async query(sql) {
      if (/FROM shopee_products/.test(sql)) return [[{ product_id: 'p1', shopee_item_id: 1, shopee_model_id: 0 }]];
      if (/FROM units/.test(sql)) return [[]];
      return [[{ id: 'p1', name: 'A', sku: 'A', price_cost: 100 }]];
    },
  };
  const load = createShopeeSaleFinancialsLoader({ pool, fetchEscrow: async () => ({ response: { order_income: { original_price: 10, escrow_amount: 8, items: [{ item_id: 1, model_id: 0, item_name: 'A', quantity_purchased: 1 }] } } }) });
  const shopee = await load({ external_id: 'SN1', status: 'COMPLETED' });
  assert.equal(shopee.cost.items[0].matched_by, 'shopee_link');
  assert.equal(shopee.profit_cents, 700);
});

test('rota de detalhe anexa o financeiro de ML/TikTok nos dois servidores e o deploy publica o módulo', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /createMercadoLivreSaleFinancialsLoader, createTikTokSaleFinancialsLoader \} = require\('\.\/services\/marketplaceSaleFinancials\.cjs'\)/);
    assert.match(source, /fetchSource: \(orderId\) => loadMercadoLivreOrderFinancialSource\(pool, orderId\)/);
    assert.match(source, /pathname: `\/finance\/202309\/orders\/\$\{encodeURIComponent\(orderId\)\}\/statement_transactions`/);
    assert.match(source, /channel === 'mercado_livre' \|\| channel === 'tiktok'/);
  }
  const ml = fs.readFileSync('services/mercadoLivreServer.cjs', 'utf8');
  assert.match(ml, /mlRequest\(pool, `\/shipments\/\$\{shipmentId\}\/costs`\)/);
  const deploy = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
  const start = deploy.indexOf("if (process.argv.includes('--sales-marketplaces-only'))");
  const block = deploy.slice(start, deploy.indexOf('Sales marketplaces backup', start));
  assert.match(block, /marketplaceSaleFinancialsPath\), `\$\{marketplaceSaleFinancialsTarget\}\.next\.cjs`/);
  assert.match(block, /node --check \$\{marketplaceSaleFinancialsTarget\}\.next\.cjs/);
  assert.match(block, /tiktokFinanceFeesPath, marketplaceSaleFinancialsPath\]/, 'guarda de arquivos commitados inclui o módulo');
});

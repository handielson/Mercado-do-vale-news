import assert from 'node:assert/strict';
import { buildDashboardSalesDigest } from './dashboardSalesDigestService.js';

const digest = buildDashboardSalesDigest({
  now: new Date('2026-04-19T18:00:00-03:00'),
  pdvSales: [
    {
      id: 'sale-1',
      created_at: '2026-04-19T10:00:00-03:00',
      status: 'completed',
      items: [
        {
          product_id: 'prod-1',
          product_name: 'Capinha iPhone 13 Azul',
          product_model: 'Capinha iPhone 13',
          product_sku: 'CAP-IP13-AZ',
          quantity: 2,
          total: 6000,
          unit_price: 3000,
          unit_cost: 1200,
        },
      ],
    },
  ],
  shopeeOrders: [
    {
      order_sn: 'SP-1',
      create_time: Math.floor(new Date('2026-04-19T12:00:00-03:00').getTime() / 1000),
      order_status: 'PROCESSED',
      item_list: [
        {
          item_name: 'Pelicula iPhone 13',
          model_name: 'Pelicula iPhone 13',
          model_sku: 'PEL-IP13',
          item_sku: 'PEL-IP13',
          model_quantity_purchased: 1,
          model_discounted_price: 25,
        },
      ],
    },
  ],
  blingInvoices: [
    {
      id: 99,
      numero: '99',
      tipo: 'nfe',
      dataEmissao: '2026-04-19',
      contato: { nome: 'Cliente Nota' },
      items: [
        {
          descricao: 'Carregador Turbo USB-C',
          codigo: 'CAR-USB-C',
          quantidade: 3,
          valor: 40,
        },
      ],
    },
  ],
  productCatalog: [
    {
      id: 'prod-1',
      sku: 'CAP-IP13-AZ',
      name: 'Capinha iPhone 13 Azul',
      stock_quantity: 5,
      price_cost: 1200,
      price_retail: 3500,
    },
    {
      id: 'prod-2',
      sku: 'PEL-IP13',
      name: 'Pelicula iPhone 13',
      stock_quantity: 8,
      price_cost: 900,
      price_retail: 2500,
    },
    {
      id: 'prod-3',
      sku: 'CAR-USB-C',
      name: 'Carregador Turbo USB-C',
      stock_quantity: 2,
      price_cost: 2100,
      price_retail: 4500,
    },
  ],
});

assert.equal(digest.detailedRows.length, 3);
assert.deepEqual(
  digest.detailedRows.map((row) => ({
    channel: row.channel,
    model: row.model,
    sku: row.sku,
    quantity: row.quantity,
    stock: row.currentStock,
    lastPurchase: row.lastPurchasePriceCents,
    lastSale: row.lastSalePriceCents,
  })),
  [
    {
      channel: 'Bling',
      model: 'Carregador Turbo USB-C',
      sku: 'CAR-USB-C',
      quantity: 3,
      stock: 2,
      lastPurchase: 2100,
      lastSale: 4500,
    },
    {
      channel: 'Shopee',
      model: 'Pelicula iPhone 13',
      sku: 'PEL-IP13',
      quantity: 1,
      stock: 8,
      lastPurchase: 900,
      lastSale: 2500,
    },
    {
      channel: 'PDV',
      model: 'Capinha iPhone 13',
      sku: 'CAP-IP13-AZ',
      quantity: 2,
      stock: 5,
      lastPurchase: 1200,
      lastSale: 3500,
    },
  ],
);

assert.deepEqual(
  digest.summaryRows.map((row) => ({
    model: row.model,
    sku: row.sku,
    quantity: row.totalQuantity,
    channels: row.channels,
  })),
  [
    {
      model: 'Carregador Turbo USB-C',
      sku: 'CAR-USB-C',
      quantity: 3,
      channels: 'Bling',
    },
    {
      model: 'Pelicula iPhone 13',
      sku: 'PEL-IP13',
      quantity: 1,
      channels: 'Shopee',
    },
    {
      model: 'Capinha iPhone 13',
      sku: 'CAP-IP13-AZ',
      quantity: 2,
      channels: 'PDV',
    },
  ],
);

assert.deepEqual(digest.totals, {
  lines: 3,
  quantity: 6,
  revenueCents: 20500,
});

assert.equal(digest.referenceDate, '2026-04-19');
assert.equal(digest.periodMode, 'today');

const fallbackDigest = buildDashboardSalesDigest({
  now: new Date('2026-04-19T18:00:00-03:00'),
  pdvSales: [
    {
      id: 'sale-old',
      created_at: '2026-04-17T10:00:00-03:00',
      status: 'completed',
      items: [
        {
          product_id: 'prod-1',
          product_name: 'Capinha iPhone 13 Azul',
          product_model: 'Capinha iPhone 13',
          product_sku: 'CAP-IP13-AZ',
          quantity: 1,
          total: 3000,
          unit_price: 3000,
          unit_cost: 1200,
        },
      ],
    },
  ],
  shopeeOrders: [],
  blingInvoices: [],
  productCatalog: [
    {
      id: 'prod-1',
      sku: 'CAP-IP13-AZ',
      name: 'Capinha iPhone 13 Azul',
      stock_quantity: 5,
      price_cost: 1200,
      price_retail: 3500,
    },
  ],
});

assert.equal(fallbackDigest.referenceDate, '2026-04-17');
assert.equal(fallbackDigest.periodMode, 'latest');
assert.equal(fallbackDigest.detailedRows.length, 1);
assert.equal(fallbackDigest.summaryRows[0].totalQuantity, 1);

console.log('dashboardSalesDigestService.test.mjs: ok');

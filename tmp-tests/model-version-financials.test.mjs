// model-version-financials-v1: custo, preço praticado e lucro por versão (RAM + armazenamento) na Página do Produto.
// Nada pode ser somado entre versões, e preço/custo vêm só do grupo de preço do celular.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { aggregateModelProducts } from '../services/modelProductAggregator.js';
import { buildVersionFinancials, tierProfit, validateSalePrices } from '../utils/modelVersionFinancials.js';

const group = (id, ram, storage, products, extra = {}) => ({
  id, model_id: 'm1', model_name: 'Poco C81 Pro', company_id: null, ram, storage, version: 'global', network: '', condition: 'new',
  revision: `rev-${id}`, confirmed: true, divergent: false, cost_min: null, cost_max: null, cost_average_in_stock: null, moving_average_cost: null,
  prices: { price_retail: 99900, price_reseller: 94900, price_wholesale: 89900 }, products, ...extra,
});
const product = (id, color, unitCosts) => ({ id, sku: id, name: id, color, stock_quantity: unitCosts.length, price_cost: null, unit_costs: unitCosts, available_unit_count: unitCosts.length, price_retail: 0, price_reseller: 0, price_wholesale: 0 });

test('cada versão tem o seu custo médio; o resumo não mistura 4/128 com 8/256', () => {
  const groups = [
    group('g256', '8GB', '256GB', [product('p3', 'Preto', [110000, 112000])], { cost_average_in_stock: 111000, moving_average_cost: 111500, prices: { price_retail: 149900, price_reseller: 144900, price_wholesale: 139900 } }),
    group('g128', '4GB', '128GB', [product('p1', 'Dourado', [76000, 76000]), product('p2', 'Preto', [78000])], { cost_average_in_stock: 76667, moving_average_cost: 76000 }),
  ];
  const rows = buildVersionFinancials(groups, []);
  assert.deepEqual(rows.map(r => r.label), ['4GB · 128GB · global', '8GB · 256GB · global'], 'ordenado por memória');
  const [small, big] = rows;
  assert.equal(small.stockQuantity, 3);
  assert.equal(small.stockValueCents, 230000);
  assert.equal(small.averageStockCostCents, 76667, 'custo médio do servidor, só desta versão');
  assert.equal(big.stockQuantity, 2);
  assert.equal(big.averageStockCostCents, 111000);
  assert.equal(small.costBaseCents, 76000, 'lucro previsto usa a média móvel (custo que a venda registra)');
  assert.deepEqual(small.tiers.map(t => t.profitCents), [23900, 18900, 13900]);
  assert.equal(small.tiers[0].marginPct, 23.9);
  assert.deepEqual(big.tiers.map(t => t.priceCents), [149900, 144900, 139900], 'preço da própria versão');
  assert.deepEqual(small.colors, ['Dourado', 'Preto']);
});

test('preço praticado e lucro realizado vêm das vendas da própria versão', () => {
  const data = aggregateModelProducts({
    model: { id: 'm1', name: 'Poco C81 Pro' },
    categoriesById: { c1: { id: 'c1', name: 'Smartphones', config: {} } },
    products: [
      { id: 'p1', model_id: 'm1', category_id: 'c1', sku: 'A', name: 'A', price_cost: 76000, price_retail: 99900, specs: { ram: '4GB', storage: '128GB', color: 'Dourado' } },
      { id: 'p3', model_id: 'm1', category_id: 'c1', sku: 'B', name: 'B', price_cost: 110000, price_retail: 149900, specs: { ram: '8GB', storage: '256GB', color: 'Preto' } },
    ],
    units: [
      { id: 'u1', product_id: 'p1', status: 'sold', cost_price: 75000 },
      { id: 'u2', product_id: 'p1', status: 'sold', cost_price: 77000 },
      { id: 'u3', product_id: 'p3', status: 'sold', cost_price: 110000 },
      { id: 'u4', product_id: 'p1', status: 'available', cost_price: 76000 },
    ],
    saleReturnByUnitId: { u1: 95000, u2: 99000, u3: 150000 },
    sales: [], saleItems: [], customers: [],
  });
  const rows = buildVersionFinancials([
    group('g128', '4GB', '128GB', [product('p1', 'Dourado', [76000])]),
    group('g256', '8GB', '256GB', [product('p3', 'Preto', [])]),
  ], data.memoryGroups);
  assert.equal(rows[0].soldCount, 2);
  assert.equal(rows[0].practicedAverageCents, 97000, 'média de 950 e 990, sem a venda do 8/256');
  assert.equal(rows[0].realizedProfitAverageCents, 21000);
  assert.equal(rows[1].soldCount, 1);
  assert.equal(rows[1].practicedAverageCents, 150000);
});

test('venda sem valor registrado não entra no preço praticado', () => {
  const memoryGroups = [{ colors: [{ units: [
    { productId: 'p1', status: 'sold', returnedValue: 99900, returnedValueEstimated: true, costValue: 70000 },
    { productId: 'p1', status: 'sold', returnedValue: 90000, returnedValueEstimated: false, costValue: 70000 },
  ] }] }];
  const [row] = buildVersionFinancials([group('g', '4GB', '128GB', [product('p1', 'Preto', [])])], memoryGroups);
  assert.equal(row.soldCount, 2);
  assert.equal(row.soldWithPriceCount, 1);
  assert.equal(row.practicedAverageCents, 90000);
});

test('sem custo não inventa lucro; versão divergente fica sem preço', () => {
  const [row] = buildVersionFinancials([group('g', '4GB', '128GB', [product('p1', 'Preto', [])], { prices: null, divergent: true })], []);
  assert.equal(row.costBaseCents, null);
  assert.equal(row.divergent, true);
  assert.ok(row.tiers.every(t => t.priceCents === null && t.profitCents === undefined));
  assert.equal(tierProfit(100000, null), null);
});

test('validação igual ao cadastro da família', () => {
  assert.equal(validateSalePrices({ price_retail: 100, price_reseller: 90, price_wholesale: 80 }), '');
  assert.match(validateSalePrices({ price_retail: 100, price_reseller: 0, price_wholesale: 80 }), /acima de zero/);
  assert.match(validateSalePrices({ price_retail: 90, price_reseller: 100, price_wholesale: 80 }), /varejo ≥ revenda ≥ atacado/);
});

test('fonte única: o bloco por versão edita só pelo grupo de preço, nunca direto no produto', () => {
  const source = fs.readFileSync('components/products/ModelVersionFinancials.tsx', 'utf8');
  assert.match(source, /smartphonePriceGroups\.save\(row\.group, draft\)/);
  assert.doesNotMatch(source, /updateProductManualCost|vpsClient\.(patch|put)|price_cost\s*:/, 'não grava custo nem preço por outro caminho');
  const page = fs.readFileSync('pages/admin/products/ModelProductAggregatorPage.tsx', 'utf8');
  assert.match(page, /moving_average_cost \?\? versionGroup\.cost_average_in_stock/, 'lucro por canal usa o mesmo custo da versão');
});

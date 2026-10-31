const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  normalizeCostInput,
  manualCostLockReason,
  costBasisOf,
  createProductManualCostService,
} = require('../services/productManualCost.cjs');

function fakePool({ product, units = 0 }) {
  const calls = [];
  const state = { committed: false, rolledBack: false, released: false };
  const connection = {
    async beginTransaction() { calls.push(['begin']); },
    async commit() { state.committed = true; },
    async rollback() { state.rolledBack = true; },
    release() { state.released = true; },
    async query(sql, params) {
      calls.push([sql.replace(/\s+/g, ' ').trim(), params]);
      if (/FROM products WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) return [[product].filter(Boolean)];
      if (/FROM units/.test(sql)) return [[{ total: units }]];
      return [{ affectedRows: 1 }];
    },
  };
  return { pool: { getConnection: async () => connection }, calls, state };
}

const baseProduct = {
  id: 'p1', sku: 'ADV8PRE', name: 'Adaptador', is_parent: 0, price_cost: 1290,
  price_retail: 1290, price_reseller: 1100, price_wholesale: 1000,
  specs: JSON.stringify({ color: 'Preto' }), custom_fields: null,
};

test('validates cost input and requires the cost shown on screen', () => {
  assert.throws(() => normalizeCostInput({ cost_cents: -1, expected_cost_cents: 0 }), /custo válido/);
  assert.throws(() => normalizeCostInput({ cost_cents: 12.5, expected_cost_cents: 0 }), /custo válido/);
  assert.throws(() => normalizeCostInput({ cost_cents: 300 }), /custo anterior/);
  assert.deepEqual(normalizeCostInput({ cost_cents: 0, expected_cost_cents: null }), { costCents: 0, expectedCostCents: null, note: '' });
});

test('locks costs owned by other controls', () => {
  assert.match(manualCostLockReason({ ...baseProduct, is_parent: 1 }), /pai de família/);
  assert.match(manualCostLockReason(baseProduct, 2), /IMEI/);
  assert.match(manualCostLockReason({ ...baseProduct, custom_fields: '{"inherit_parent_cost":true}' }), /herda o custo/);
  assert.equal(manualCostLockReason(baseProduct, 0), null);
  assert.equal(costBasisOf({ specs: { _acquisition_cost: { basis: 'manual_operator' } } }), 'manual_operator');
  assert.equal(costBasisOf({ specs: '{}' }), null);
});

test('updates cost with evidence and price history in one transaction', async () => {
  const { pool, calls, state } = fakePool({ product: baseProduct });
  const service = createProductManualCostService({ pool, randomUUID: () => 'hist-1' });
  const result = await service.updateCost('p1', { cost_cents: 300, expected_cost_cents: 1290, note: 'nota 55', context: 'marketplace_sale:shopee_mv:X' }, { customerId: 'admin-1' });
  assert.equal(result.product.price_cost, 300);
  assert.equal(result.product.previous_price_cost, 1290);
  const update = calls.find(([sql]) => sql.startsWith('UPDATE products'));
  assert.ok(update, 'product cost update');
  assert.equal(update[1][0], 300);
  const evidence = JSON.parse(update[1][1]);
  assert.equal(evidence.basis, 'manual_operator');
  assert.equal(evidence.previousCostCents, 1290);
  assert.equal(evidence.changedBy, 'admin-1');
  assert.equal(evidence.note, 'nota 55');
  assert.match(update[0], /\$\._acquisition_cost/);
  assert.doesNotMatch(update[0], /price_retail|stock_quantity/, 'only cost and evidence change');
  const history = calls.find(([sql]) => sql.startsWith('INSERT INTO product_price_history'));
  assert.deepEqual(history[1], ['hist-1', 'p1', 300, 1290, 1100, 1000]);
  assert.equal(calls.some(([sql]) => /\bsales\b|sale_items/.test(sql)), false, 'recorded sales are never touched');
  assert.ok(state.committed && state.released && !state.rolledBack);
});

test('rejects stale screens, serialized and inherited costs without writing', async () => {
  for (const [scenario, body, expected] of [
    [{ product: baseProduct }, { cost_cents: 300, expected_cost_cents: 999 }, 'cost_changed'],
    [{ product: baseProduct, units: 1 }, { cost_cents: 300, expected_cost_cents: 1290 }, 'cost_locked'],
    [{ product: null }, { cost_cents: 300, expected_cost_cents: 1290 }, 'product_not_found'],
  ]) {
    const { pool, calls, state } = fakePool(scenario);
    const service = createProductManualCostService({ pool });
    await assert.rejects(service.updateCost('p1', body, {}), (error) => error.code === expected);
    assert.equal(calls.some(([sql]) => /^UPDATE|^INSERT/.test(sql)), false, expected);
    assert.ok(state.rolledBack && state.released && !state.committed);
  }
});

test('both API entrypoints expose the admin-only cost route and the deploy ships the module', () => {
  for (const file of ['vps_server.cjs', 'vps_server.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /fastify\.patch\('\/admin\/products\/:id\/cost', \{ preHandler: requireAdminBearerToken \}/, file);
    assert.match(source, /require\('\.\/services\/productManualCost\.cjs'\)/, file);
  }
  assert.match(fs.readFileSync('deploy-vps-server-only.cjs', 'utf8'), /services\/productManualCost\.cjs/);
  const row = fs.readFileSync('components/admin/sales/ProductCostItemRow.tsx', 'utf8');
  assert.match(row, /expected_cost_cents: item\.current_cost_cents \?\? null/);
  assert.match(row, /Alterar custo/);
});

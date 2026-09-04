import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerSmartphonePhotoIntakeRoutes } from '../services/smartphonePhotoIntakeServer.cjs';
import { buildBlingFamily, saveIntakeBlingMapping, intakeMappingKey } from '../services/modelBlingMapping.mjs';

async function fixture(t, options = {}) {
  const app = Fastify();
  t.after(() => app.close());
  const intake = { id: 'intake', company_id: 'company', matched_model_id: 'model', matched_color_id: 'purple', detected_color: 'Roxo',
    detected_ram: '8GB', detected_storage: '256GB', status: 'ready_to_finalize', prices_confirmed: 1,
    price_cost: 10000, price_retail: 15000, price_reseller: 14000, price_wholesale: 13000, validation_errors: '[]' };
  let family = buildBlingFamily({ id: 100, codigo: 'PAI', nome: 'Modelo' }, [{ id: 101, codigo: 'FILHO', nome: 'Roxo' }]);
  if (options.mapped !== false) family = saveIntakeBlingMapping(family, intake, 101);
  let state = { intake, model: { id: 'model', name: 'Modelo', template_values: JSON.stringify({ unrelated: true, ...(options.legacy ? {} : { bling_family: family }) }) },
    products: options.products || [], units: [] };
  let snapshot;
  const query = async (sql, params = []) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (/^(CREATE|ALTER|SHOW)/.test(q)) return [[]];
    if (q.includes('FROM smartphone_photo_intakes') && q.includes('WHERE status IN')) return [[]];
    if (q.startsWith('SELECT * FROM smartphone_photo_intakes')) return [[structuredClone(state.intake)]];
    if (q.includes('FROM models')) return [[structuredClone(state.model)]];
    if (q.startsWith('UPDATE models SET template_values')) { state.model.template_values = params[0]; return [{}]; }
    if (q.startsWith('SELECT') && q.includes('FROM products')) {
      if (q.includes('stock_quantity > 0')) return [[]];
      if (q.includes('WHERE bling_id=? OR sku=?')) return [state.products.filter(p => p.bling_id === params[0] || p.sku === params[1])];
      if (q.includes('COALESCE(is_parent,0)=1')) return [[]];
      if (q.includes('WHERE model_id=?')) return [state.products.filter(p => p.model_id === params[0])];
      if (q.includes('WHERE sku=?')) return [state.products.filter(p => p.sku === params[0])];
      if (q.includes('WHERE id=?')) return [state.products.filter(p => p.id === params[0])];
    }
    if (q.startsWith('SELECT') && q.includes('FROM model_color_images')) return [[]];
    if (q.startsWith('INSERT INTO products')) {
      state.products.push({ id: params[0], name: params[1], sku: params[3], model_id: params[12], specs: JSON.parse(params[14]), company_id: params[15] }); return [{}];
    }
    if (q.startsWith('UPDATE products SET bling_id')) {
      Object.assign(state.products.find(p => p.id === params[3]), { bling_id: params[0], bling_parent_id: params[1], parent_id: params[2] }); return [{}];
    }
    if (q.startsWith('INSERT INTO units')) { state.units.push({ id: params[0], product_id: params[1] }); return [{}]; }
    if (q.startsWith('UPDATE products SET price_cost')) return [{}];
    if (q.startsWith('UPDATE smartphone_photo_intakes SET status')) {
      Object.assign(state.intake, { status: params[0], matched_product_id: params[1], unit_id: params[2] }); return [{}];
    }
    throw new Error(`Unexpected test query: ${q}`);
  };
  const connection = { query, beginTransaction: async () => { snapshot = structuredClone(state); }, commit: async () => {},
    rollback: async () => { state = snapshot; }, release() {} };
  registerSmartphonePhotoIntakeRoutes(app, { pool: { query, getConnection: async () => connection }, requireSyncKey: async () => {}, baseDir: mkdtempSync(join(tmpdir(), 'mdv-bling-test-')) });
  app.get('/api/bling', async (request, reply) => {
    assert.equal(request.headers.authorization, undefined, 'app session token must not be sent as a Bling token');
    return options.outage ? reply.code(503).send({ error: 'unavailable' }) :
      { id: 101, codigo: 'FILHO', situacao: 'A', variacao: { produtoPai: { id: options.stale ? 999 : 100 } } };
  });
  await app.ready();
  return { app, state: () => state, intake, finalize: () => app.inject({ method: 'POST', url: '/smartphone-photo-intakes/intake/finalize', headers: { authorization: 'Bearer test-app-session' }, payload: {} }) };
}

test('save one mapping then finalize uses exact child and parent; retry does not duplicate unit', async t => {
  const f = await fixture(t, { mapped: false });
  assert.equal((await f.finalize()).statusCode, 409);
  const saved = await f.app.inject({ method: 'PUT', url: '/smartphone-photo-intakes/intake/bling-mapping', payload: { child_id: 101, configuration_key: intakeMappingKey(f.intake) } });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(JSON.parse(f.state().model.template_values).unrelated, true);
  const response = await f.finalize();
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(f.state().products[0].sku, 'FILHO');
  assert.equal(f.state().products[0].bling_id, 101);
  assert.equal(f.state().products[0].bling_parent_id, 100);
  assert.equal(f.state().products[0].specs.bling_family, undefined);
  assert.equal((await f.finalize()).json().idempotent, true);
  assert.equal(f.state().units.length, 1);
});

test('existing exact product keeps local SKU and receives link without a duplicate product', async t => {
  const f = await fixture(t, { products: [{ id: 'existing', model_id: 'model', sku: 'LOCAL', specs: { ram: '8GB', storage: '256GB', color_id: 'purple' } }] });
  const response = await f.finalize();
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(f.state().products.length, 1);
  assert.equal(f.state().products[0].sku, 'LOCAL');
  assert.equal(f.state().products[0].bling_id, 101);
});

for (const options of [{ stale: true }, { outage: true }, { products: [{ id: 'other', sku: 'FILHO', model_id: 'another' }] },
  { products: [{ id: 'existing', model_id: 'model', sku: 'LOCAL', bling_id: 999, specs: { ram: '8GB', storage: '256GB', color_id: 'purple' } }] }]) {
  test(`invalid or unavailable link rolls back without adding units: ${JSON.stringify(options)}`, async t => {
    const f = await fixture(t, options);
    assert.equal((await f.finalize()).statusCode, 409);
    assert.equal(f.state().units.length, 0);
    assert.equal(f.state().intake.status, 'ready_to_finalize');
  });
}

test('mapping rejects stale configuration and unknown child', async t => {
  const f = await fixture(t, { mapped: false });
  for (const payload of [{ child_id: 101, configuration_key: 'old' }, { child_id: 999, configuration_key: intakeMappingKey(f.intake) }]) {
    assert.equal((await f.app.inject({ method: 'PUT', url: '/smartphone-photo-intakes/intake/bling-mapping', payload })).statusCode, 409);
  }
  assert.equal(JSON.parse(f.state().model.template_values).bling_family.mappings.length, 0);
});

test('models without Bling family retain normal photo intake behavior', async t => {
  const f = await fixture(t, { legacy: true });
  const response = await f.finalize();
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(f.state().units.length, 1);
  assert.equal(f.state().products[0].bling_id, undefined);
});

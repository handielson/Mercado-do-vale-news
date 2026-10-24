import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerSmartphonePhotoIntakeRoutes } from '../services/smartphonePhotoIntakeServer.cjs';
import { buildBlingFamily, saveIntakeBlingMapping, intakeMappingKey } from '../services/modelBlingMapping.mjs';
import priceCore from '../services/smartphonePriceGroupsCore.cjs';

async function fixture(t, options = {}) {
  const app = Fastify();
  if (options.upload) app.addHook('onRequest', async req => {
    req.file = async () => ({ filename:'fixture.jpg',mimetype:'image/jpeg',fields:{company_id:{value:'company'}},toBuffer:async()=>Buffer.from('fixture-photo') });
  });
  t.after(() => app.close());
  const intake = { id: 'intake', company_id: 'company', matched_model_id: 'model', matched_color_id: 'purple', detected_color: 'Roxo',
    detected_ram: '8GB', detected_storage: '256GB', detected_ean: options.detectedEan || null, status: 'ready_to_finalize', prices_confirmed: 1,
    price_cost: 10000, price_retail: 15000, price_reseller: 14000, price_wholesale: 13000, validation_errors: '[]',
    ...(!options.missingVersion ? { extracted_data: JSON.stringify({ commercial_version: options.version || 'Global' }) } : {}) };
  let family = buildBlingFamily({ id: 100, codigo: 'PAI', nome: 'Modelo' }, [{ id: 101, codigo: 'FILHO', nome: 'Roxo' }]);
  if (options.mapped !== false) family = saveIntakeBlingMapping(family, intake, 101);
  let state = { intake, model: { id: 'model', name: 'Modelo', template_values: JSON.stringify({ unrelated: true, ...(options.legacy ? {} : { bling_family: family }) }) },
    products: options.products || [], units: [] };
  state.products.forEach(product => { product.company_id ||= 'company'; });
  state.products.forEach(product => { if (product.specs && !product.specs.version) product.specs.version = 'Global'; });
  let snapshot;
  const query = async (sql, params = []) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (/^(CREATE|ALTER|SHOW)/.test(q)) return [[]];
    if (q.startsWith('INSERT INTO smartphone_photo_intakes')) {
      state.intake = {id:params[0],company_id:params[1],status:'uploaded',extracted_data:params[5]}; return [{}];
    }
    if (q.startsWith('SELECT name FROM versions')) return [[...(['Global', 'India'].includes(params[0]) ? [{ name: params[0] }] : [])]];
    if (q.includes('FROM smartphone_price_groups')) return [(options.priceGroups || []).filter(g => g.id === params[0])];
    if (q.includes('FROM smartphone_photo_intakes') && q.includes('WHERE status IN')) return [[]];
    if (q.startsWith('SELECT * FROM smartphone_photo_intakes')) return [[structuredClone(state.intake)]];
    if (q.startsWith('SELECT id,matched_model_id,price_cost')) return [[structuredClone(state.intake), ...(options.queuePeers || [])]];
    if (q.includes('FROM models')) return [[{ ...structuredClone(state.model), ...(options.priceGroups || q.includes('SELECT m.id,m.name,m.category_id') ? { category_name: 'Smartphones', category_id: 'category', company_id: 'company' } : {}) }]];
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
      if (q.startsWith('INSERT INTO products (id,name,sku,model_id')) {
        state.products.push({ id: params[0], name: params[1], sku: params[2], model_id: params[3], company_id: params[4], is_parent: 1 });
        return [{}];
      }
      state.products.push({ id: params[0], name: params[1], sku: params[3], ean: params[4], alternative_eans: params[5], price_retail: params[6], price_wholesale: params[7], price_reseller: params[9], model_id: params[12], specs: JSON.parse(params[14]), company_id: params[15] }); return [{}];
    }
    if (q.startsWith('UPDATE products SET bling_id')) {
      Object.assign(state.products.find(p => p.id === params[2]), { bling_id: params[0], bling_parent_id: params[1] }); return [{}];
    }
    if (q.startsWith('UPDATE products SET parent_id')) {
      state.products.find(p => p.id === params[1]).parent_id = params[0]; return [{ affectedRows: 1 }];
    }
    if (q.startsWith('UPDATE products SET ean=')) {
      Object.assign(state.products.find(p => p.id === params[2]), { ean: params[0], alternative_eans: params[1] }); return [{ affectedRows: 1 }];
    }
    if (q.startsWith('INSERT INTO units')) { state.units.push({ id: params[0], product_id: params[1] }); return [{}]; }
    if (q.startsWith('UPDATE products SET price_cost')) return [{}];
    if (q.startsWith('UPDATE smartphone_photo_intakes SET status')) {
      Object.assign(state.intake, { status: params[0], matched_product_id: params[1], unit_id: params[2] }); return [{}];
    }
    if (q.startsWith('UPDATE smartphone_photo_intakes SET price_cost=CASE')) return [{ affectedRows: 1 }];
    if (q.startsWith('UPDATE smartphone_photo_intakes SET')) {
      q.split(' SET ')[1].split(' WHERE ')[0].split(', ').forEach((set, index) => {
        state.intake[set.split('=')[0]] = params[index];
      });
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected test query: ${q}`);
  };
  const connection = { query, beginTransaction: async () => { snapshot = structuredClone(state); }, commit: async () => {},
    rollback: async () => { state = snapshot; }, release() {} };
  registerSmartphonePhotoIntakeRoutes(app, { pool: { query, getConnection: async () => connection }, inventoryCostSync: async () => {}, requireSyncKey: async () => {}, baseDir: mkdtempSync(join(tmpdir(), 'mdv-bling-test-')) });
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

test('photo upload persists Global before AI extraction or price confirmation', async t => {
  const f = await fixture(t,{upload:true});
  const response=await f.app.inject({method:'POST',url:'/smartphone-photo-intakes'});
  assert.equal(response.statusCode,201,response.body);
  assert.equal(response.json().detected_version,'Global');
  assert.equal(JSON.parse(f.state().intake.extracted_data).commercial_version,'Global');
  assert.equal(response.json().prices_confirmed,false);
});

test('existing exact product keeps local SKU and receives link without a duplicate product', async t => {
  const f = await fixture(t, { products: [{ id: 'existing', model_id: 'model', sku: 'LOCAL', specs: { ram: '8GB', storage: '256GB', color_id: 'purple' } }] });
  const response = await f.finalize();
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(f.state().products.filter(p => !p.is_parent).length, 1);
  assert.equal(f.state().products.filter(p => p.is_parent).length, 1);
  assert.equal(f.state().products[0].parent_id, response.json().parent_id);
  assert.equal(f.state().products[0].sku, 'LOCAL');
  assert.equal(f.state().products[0].bling_id, 101);
});

test('cadastro por imagem acrescenta EAN de outra fabricação na mesma variação sem apagar os anteriores', async t => {
  const f = await fixture(t, { detectedEan: '7890000000031', products: [{ id: 'existing', model_id: 'model', sku: 'LOCAL',
    ean: '7890000000017', alternative_eans: JSON.stringify(['7890000000017', '7890000000024']),
    specs: { ram: '8GB', storage: '256GB', color_id: 'purple' } }] });
  const response = await f.finalize();
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().product_id, 'existing');
  assert.equal(f.state().products[0].ean, '7890000000017');
  assert.deepEqual(JSON.parse(f.state().products[0].alternative_eans), ['7890000000017', '7890000000024', '7890000000031']);
  assert.equal((await f.finalize()).json().idempotent, true);
  assert.deepEqual(JSON.parse(f.state().products[0].alternative_eans), ['7890000000017', '7890000000024', '7890000000031']);
});

test('EAN já conhecido não é duplicado na variação encontrada por foto', async t => {
  const f = await fixture(t, { detectedEan: '7890000000024', products: [{ id: 'existing', model_id: 'model', sku: 'LOCAL',
    ean: '7890000000017', alternative_eans: JSON.stringify(['7890000000017', '7890000000024']),
    specs: { ram: '8GB', storage: '256GB', color_id: 'purple' } }] });
  const response = await f.finalize();
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(JSON.parse(f.state().products[0].alternative_eans), ['7890000000017', '7890000000024']);
});

test('falha no vínculo da variação preserva seus EANs e não conclui o aparelho', async t => {
  const f = await fixture(t, { detectedEan: '7890000000031', products: [{ id: 'existing', model_id: 'model', sku: 'LOCAL',
    bling_id: 999, ean: '7890000000017', alternative_eans: JSON.stringify(['7890000000017']),
    specs: { ram: '8GB', storage: '256GB', color_id: 'purple' } }] });
  assert.equal((await f.finalize()).statusCode, 409);
  assert.deepEqual(JSON.parse(f.state().products[0].alternative_eans), ['7890000000017']);
  assert.equal(f.state().intake.status, 'ready_to_finalize');
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

test('finalizacao herda o preco Global e persiste a versao no produto, sem usar grupo sem versao', async t => {
  const config = priceCore.configuration({ model_id: 'model', company_id: 'company', specs: { ram: '8GB', storage: '256GB', version: 'Global' } });
  const global = { ...config, price_retail: 286000, price_reseller: 282000, price_wholesale: 276000 };
  const f = await fixture(t, { legacy: true, version: 'Global', priceGroups: [global] });
  const response = await f.finalize();
  assert.equal(response.statusCode, 200, response.body);
  const child = f.state().products.find(p => !p.is_parent);
  assert.equal(child.specs.version, 'Global');
  assert.equal(child.price_retail, 286000);
  assert.equal(child.price_reseller, 282000);
  assert.equal(child.price_wholesale, 276000);
  assert.equal(f.state().intake.price_cost, 10000);
});

test('versao escolhida e persistida no JSON, invalida confirmacao e sobrevive ao recarregar', async t => {
  const f = await fixture(t, { legacy: true, missingVersion: true });
  const saved = await f.app.inject({ method: 'PATCH', url: '/smartphone-photo-intakes/intake', payload: { detected_version: 'Global' } });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().detected_version, 'Global');
  assert.equal(saved.json().prices_confirmed, false);
  assert.equal(JSON.parse(f.state().intake.extracted_data).commercial_version, 'Global');
  const invalid = await f.app.inject({ method: 'PATCH', url: '/smartphone-photo-intakes/intake', payload: { detected_version: 'inventada' } });
  assert.equal(invalid.statusCode, 409);
  assert.equal(JSON.parse(f.state().intake.extracted_data).commercial_version, 'Global');
});

test('legacy photo entry without version cannot finalize; saving defaults to Global and resets prices', async t => {
  const f = await fixture(t, { legacy: true, missingVersion: true });
  const blocked = await f.finalize();
  assert.equal(blocked.statusCode, 409);
  assert.match(blocked.body, /versão comercial/);
  assert.equal(f.state().units.length, 0);
  const saved = await f.app.inject({ method: 'PATCH', url: '/smartphone-photo-intakes/intake', payload: { detected_version: '' } });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().detected_version, 'Global');
  assert.equal(saved.json().prices_confirmed, false);
  assert.equal(JSON.parse(f.state().intake.extracted_data).commercial_version, 'Global');
});

test('empty version cannot erase an explicitly selected India version', async t => {
  const f = await fixture(t, { legacy: true, version: 'India' });
  const saved = await f.app.inject({ method: 'PATCH', url: '/smartphone-photo-intakes/intake', payload: { detected_version: '' } });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().detected_version, 'India');
});

test('aparelho Global nao reutiliza produto de outra versao', async t => {
  const f = await fixture(t, { legacy: true, version: 'Global', products: [{ id: 'india', model_id: 'model', sku: 'INDIA',
    specs: { ram: '8GB', storage: '256GB', color: 'Roxo', color_id: 'purple', version: 'India' } }] });
  const response = await f.finalize();
  assert.equal(response.statusCode, 200, response.body);
  assert.notEqual(response.json().product_id, 'india');
  assert.equal(f.state().products.find(p => p.id === 'india').specs.version, 'India');
});

test('confirmacao de grupo nao inclui aparelho de outra versao', async t => {
  const f = await fixture(t, { legacy: true, version: 'Global', queuePeers: [
    { id: 'other', extracted_data: { commercial_version: 'India' }, price_cost: 10000 },
    { id: 'without-version', extracted_data: {}, price_cost: 10000 },
  ] });
  const response = await f.app.inject({ method: 'POST', url: '/smartphone-photo-intakes/intake/confirm-group-prices', payload: {
    price_cost: 10000, price_retail: 286000, price_reseller: 282000, price_wholesale: 276000,
  } });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().updated_count, 1);
});

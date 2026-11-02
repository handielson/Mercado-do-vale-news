const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { registerSmartphonePriceGroupRoutes } = require('../services/smartphonePriceGroupsServer.cjs');

// GET /models/price-summary: resumo de preços de vários modelos numa consulta (página de Modelos).
function app(t) {
  const models = [
    { id: 'phone', name: 'Redmi 15C', company_id: 'c1', template_values: null, category_name: 'Celulares' },
    { id: 'capa', name: 'Capa X', company_id: 'c1', template_values: null, category_name: 'Acessórios' },
    { id: 'vazio', name: 'Cabo', company_id: 'c1', template_values: null, category_name: 'Cabos' },
  ];
  const products = [
    { id: 'p1', model_id: 'capa', name: 'Capa X Preta', sku: 'CX-P', specs: '{"color":"Preta"}', stock_quantity: '3', price_cost: '800.00', price_retail: '2990.00', price_reseller: '2500', price_wholesale: '2000', status: 'active', is_parent: 0 },
  ];
  const seen = [];
  const query = async (sql, params = []) => {
    const q = sql.replace(/\s+/g, ' ').trim(); seen.push(q);
    if (q.startsWith('CREATE TABLE')) return [{}];
    if (q.includes('FROM models m')) return [models.filter(m => params.includes(m.id))];
    if (q.includes('FROM products WHERE model_id IN')) {
      assert.match(q, /status='active' AND \(is_parent = 0 OR is_parent IS NULL\)/);
      return [products.filter(p => params.includes(p.model_id))];
    }
    if (q.includes('FROM products WHERE model_id=?')) return [[]];
    if (q.startsWith('SELECT * FROM smartphone_price_groups')) return [[]];
    if (q.includes('FROM units u')) return [[]];
    throw new Error('SQL inesperado: ' + q);
  };
  const server = Fastify(); t.after(() => server.close());
  registerSmartphonePriceGroupRoutes(server, { pool: { query }, inventoryCosts: async () => ({}), requireSyncKey: async (req, reply) => { if (req.headers['x-sync-key'] !== 'k') return reply.code(401).send({}); } });
  return { server, seen };
}

test('separa celular (só avisos) e demais (produtos com preço numérico)', async t => {
  const { server, seen } = app(t);
  const res = await server.inject({ url: '/models/price-summary?ids=phone,capa,vazio,capa', headers: { 'x-sync-key': 'k' } });
  assert.equal(res.statusCode, 200, res.body);
  const { items } = res.json();
  assert.deepEqual(items.phone, { enabled: true, divergent: 0, unresolved: 0 });
  assert.deepEqual(items.vazio, { enabled: false, products: [] });
  assert.deepEqual(items.capa.products, [{ id: 'p1', name: 'Capa X Preta', sku: 'CX-P', specs: { color: 'Preta' }, stock_quantity: 3, price_cost: 800, price_retail: 2990, price_reseller: 2500, price_wholesale: 2000 }]);
  assert.equal(seen.filter(q => q.includes('FROM products WHERE model_id IN')).length, 1, 'uma consulta para todos os não-celulares');
});

test('limites e proteção', async t => {
  const { server } = app(t);
  assert.equal((await server.inject({ url: '/models/price-summary?ids=capa' })).statusCode, 401);
  const many = Array.from({ length: 51 }, (_, i) => 'm' + i).join(',');
  assert.equal((await server.inject({ url: '/models/price-summary?ids=' + many, headers: { 'x-sync-key': 'k' } })).statusCode, 400);
  assert.deepEqual((await server.inject({ url: '/models/price-summary', headers: { 'x-sync-key': 'k' } })).json(), { items: {} });
});

test('rota antiga por modelo continua igual', async t => {
  const { server } = app(t);
  const res = await server.inject({ url: '/models/capa/smartphone-price-groups', headers: { 'x-sync-key': 'k' } });
  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(res.json(), { enabled: false, groups: [], unresolved: [] });
  const phone = await server.inject({ url: '/models/phone/smartphone-price-groups', headers: { 'x-sync-key': 'k' } });
  assert.deepEqual(phone.json(), { enabled: true, unresolved: [], groups: [] });
});

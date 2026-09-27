const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { configuration, packageFor, normalizeOptions, registerPrint3dShipping } = require('../services/print3dShippingServer.cjs');
const env = { MDV_PRINT3D_SHIPPING_ENABLED: '1', MDV_PRINT3D_SHIPPING_ORIGIN_CEP: '56300000',
  MDV_PRINT3D_SHIPPING_PACKAGE_TARE_G: '100', MDV_PRINT3D_SHIPPING_PACKAGE_PADDING_CM: '2',
  MDV_PRINT3D_SHIPPING_HANDLING_DAYS: '1', MDV_PRINT3D_FRENET_TOKEN: 'private-3d' };
const rows = [{ id: 'p1', weight_kg: 0.2, dimensions: { height_cm: 4, width_cm: 8, depth_cm: 10 } }];
const settings = { origin_cep: '56300001', frenet_enabled: 1, frenet_token: 'private-3d' };
const pool = { query: async () => [[settings]] };
const items = [{ product_id: 'p1', quantity: 2 }];
const quote = { rows, items: [{ production_days: 5 }], paymentSchedule: { subtotal: 12345 } };
const response = { status: 200, body: { ShippingSevicesArray: [{ ServiceCode: '1', ShippingPrice: '19.90', DeliveryTime: '3', Carrier: 'Correios', ServiceDescription: 'PAC' }] } };
function app(overrides = {}) {
  const server = Fastify();
  registerPrint3dShipping(server, { env, pool, loadQuote: async () => quote, calculateShipping: async () => response, ...overrides });
  return server;
}
const send = (server, body = { cep: '01001-000', items }) => server.inject({ method: 'POST', url: '/storefronts/loja_3d/shipping/quote', payload: body });
test('origem e transportadoras vêm do cadastro MDV, respeitando ativação', () => {
  assert.throws(() => configuration({}), /ativado/);
  assert.throws(() => configuration({ ...env, MDV_PRINT3D_SHIPPING_PACKAGE_TARE_G: '' }), /embalagem/);
  assert.throws(() => configuration(env, { ...settings, frenet_enabled: 0 }), /Transportadoras/);
  assert.equal(configuration(env, settings).origin, '56300001');
});
test('peso em gramas, quantidades, embalagem e empilhamento', () => {
  assert.deepEqual(packageFor(rows, items, configuration(env, settings)), { weight_g: 500, height_cm: 10, width_cm: 10, length_cm: 12 });
  assert.throws(() => packageFor([{ ...rows[0], weight_kg: null }], items, configuration(env, settings)), /sem peso/);
  assert.throws(() => packageFor([{ ...rows[0], dimensions: '{}' }], items, configuration(env, settings)), /medidas/);
});
test('converte reais em centavos sem transformar erro ou campo vazio em frete grátis', () => {
  assert.equal(normalizeOptions('frenet', response)[0].price_cents, 1990);
  assert.deepEqual(normalizeOptions('frenet', { status: 500, body: response.body }), []);
  for (const bad of [{ price: '' }, { price: null }, { price: -2 }, { price: 'NaN' }, { price: 5, error: 'bad' }]) {
    assert.deepEqual(normalizeOptions('melhor-envio', { status: 200, body: [{ id: '1', delivery_time: 2, ...bad }] }), []);
  }
});
test('usa valor e dimensões do servidor, não aceita token ou preço enviado pelo cliente', async t => {
  let received;
  const server = app({ calculateShipping: async (query, body) => { received = { query, body }; return response; } });
  t.after(() => server.close());
  const res = await send(server, { cep: '01001000', items, order_value: 1, token: 'attacker', weight_g: 1 });
  assert.equal(res.statusCode, 200);
  assert.equal(received.body.order_value, 12345);
  assert.equal(received.body.token, 'private-3d');
  assert.equal(received.body.from_cep, settings.origin_cep);
  assert.equal(received.body.weight_g, 500);
  assert.equal(received.query.action, 'calculate');
  assert.equal(res.json().production_days, 5);
  assert.equal(res.json().handling_business_days, 1);
  assert.equal(res.json().options[0].transport_business_days, 3);
  assert.ok(!res.body.includes('private-3d'));
  assert.equal(res.headers['cache-control'], 'no-store');
});
test('CEP, item indisponível e embalagem ausente bloqueiam antes da transportadora', async t => {
  for (const [overrides, payload, status] of [
    [{}, { cep: '000', items }, 400],
    [{ loadQuote: async () => ({ ...quote, paymentSchedule: null }) }, { cep: '01001000', items }, 409],
    [{ loadQuote: async () => ({ ...quote, rows: [{ id: 'p1' }] }) }, { cep: '01001000', items }, 422],
  ]) {
    const server = app({ ...overrides, calculateShipping: async () => { throw new Error('não chamar'); } });
    t.after(() => server.close()); assert.equal((await send(server, payload)).statusCode, status);
  }
});
test('falha parcial mantém cotação válida; falha total nunca retorna zero', async t => {
  const server = app({ pool: { query: async () => [[{ ...settings, melhor_envio_enabled: 1, melhor_envio_token: 'other' }]] },
    calculateShipping: async q => { if (q.provider === 'melhor-envio') throw new Error('secret'); return response; } });
  t.after(() => server.close()); assert.equal((await send(server)).json().options.length, 1);
  const failed = app({ calculateShipping: async () => { throw new Error('private-3d'); } });
  t.after(() => failed.close()); const res = await send(failed);
  assert.equal(res.statusCode, 503); assert.ok(!res.body.includes('private-3d'));
});
test('limita repetição de cotação pública', async t => {
  const server = app(); t.after(() => server.close());
  for (let i = 0; i < 10; i++) assert.equal((await send(server)).statusCode, 200);
  assert.equal((await send(server)).statusCode, 429);
});
test('herda filtro de serviços e sandbox sem importar descontos MDV', async t => {
  let received;
  const server = app({
    pool: { query: async sql => {
      assert.ok(sql.startsWith('SELECT origin_cep'));
      return [[{ ...settings, frenet_enabled: 0, melhor_envio_enabled: '1', melhor_envio_token: 'shared-secret',
        melhor_envio_sandbox: '1', melhor_envio_allowed_services: 'PAC', default_subsidy_discount_percent: 100 }]];
    } },
    calculateShipping: async (query, body) => {
      received = body;
      return { status: 200, body: [
        { id: 1, name: 'PAC', price: '25.00', delivery_time: 5 },
        { id: 2, name: 'SEDEX', price: '40.00', delivery_time: 2 },
      ] };
    },
  });
  t.after(() => server.close());
  const res = await send(server);
  assert.equal(res.statusCode, 200);
  assert.equal(received.sandbox, true);
  assert.equal(res.json().options.length, 1);
  assert.equal(res.json().options[0].price_cents, 2500);
  assert.ok(!res.body.includes('shared-secret'));
});
test('falha do cadastro compartilhado bloqueia sem expor dados internos', async t => {
  const server = app({ pool: { query: async () => { throw new Error('secret SQL'); } } });
  t.after(() => server.close());
  const res = await send(server);
  assert.equal(res.statusCode, 503);
  assert.ok(!res.body.includes('secret SQL'));
});

// Ligação do local do aparelho no servidor: rotas novas e caminhos de entrada/volta/transferência.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Fastify = require('fastify');
const { registerUnitLocationRoutes } = require('../services/unitLocationServer.cjs');

function setup(t, { admin = true, sync = false, transferImpl, mismatches = [] } = {}) {
  const app = Fastify();
  const calls = { transfer: [], backfill: [] };
  const conn = { released: false, release() { this.released = true; } };
  registerUnitLocationRoutes(app, {
    pool: { getConnection: async () => conn, query: async () => [[{ name: 'Operador Teste' }]] },
    getBearerAuthContext: async () => (admin ? { isAdmin: true, userId: 'op', customerId: 'c-op' } : { isAdmin: false }),
    requireSyncKey: async (req, reply) => { if (!sync) return reply.code(401).send({ error: 'Unauthorized' }); },
    syncProductStock: async () => {},
    ensureIncomingStockLocation: async () => ({ depositId: 'D', locationId: 'L' }),
    getDefaultStockCompanyId: async () => 'company',
    impl: {
      transferUnits: transferImpl || (async args => { calls.transfer.push(args); return { moved: [{ unitId: 'u1' }] }; }),
      backfillUnitLocations: async args => { calls.backfill.push(args); return { moved: [], skipped: [] }; },
      stockMismatches: async () => mismatches,
    },
  });
  t.after(() => app.close());
  return { app, calls, conn };
}
const transferBody = { identifiers: ['868499080873669'], to_deposit_id: 'dep', to_location_id: 'loc', reason: 'vitrine' };

test('sem sessão admin → 401 em transferir e na conferência', async t => {
  const { app } = setup(t, { admin: false });
  assert.equal((await app.inject({ method: 'POST', url: '/admin/units/transfers', payload: transferBody })).statusCode, 401);
  assert.equal((await app.inject({ url: '/admin/units/stock-mismatches' })).statusCode, 401);
});

test('transferência passa IMEIs, destino, motivo e quem fez; devolve moved e libera a conexão', async t => {
  const { app, calls, conn } = setup(t);
  const r = await app.inject({ method: 'POST', url: '/admin/units/transfers', payload: transferBody });
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.deepEqual(r.json().moved, [{ unitId: 'u1' }]);
  const args = calls.transfer[0];
  assert.deepEqual(args.identifiers, ['868499080873669']);
  assert.equal(args.toDepositId, 'dep'); assert.equal(args.toLocationId, 'loc'); assert.equal(args.reason, 'vitrine');
  assert.deepEqual(args.actor, { userId: 'op', name: 'Operador Teste' });
  assert.equal(conn.released, true);
});

test('erro da regra vira o status e a mensagem dela', async t => {
  const { app, conn } = setup(t, { transferImpl: async () => { throw Object.assign(new Error('X está vendido e não pode ser transferido.'), { statusCode: 409 }); } });
  const r = await app.inject({ method: 'POST', url: '/admin/units/transfers', payload: transferBody });
  assert.equal(r.statusCode, 409);
  assert.equal(r.json().error, 'X está vendido e não pode ser transferido.');
  assert.equal(conn.released, true);
});

test('conferência devolve os produtos com saldo sem IMEI', async t => {
  const rows = [{ productId: 'p', sku: 'rail', name: 'Athomics Inspire Lite', units: 1, balance: 21 }];
  const { app } = setup(t, { mismatches: rows });
  assert.deepEqual((await app.inject({ url: '/admin/units/stock-mismatches' })).json(), { rows });
});

test('preenchimento inicial exige chave de sync e só grava com ?apply=1', async t => {
  const denied = setup(t);
  assert.equal((await denied.app.inject({ method: 'POST', url: '/admin/units/location-backfill' })).statusCode, 401);
  const { app, calls } = setup(t, { sync: true });
  assert.equal((await app.inject({ method: 'POST', url: '/admin/units/location-backfill' })).statusCode, 200);
  assert.equal(calls.backfill[0].apply, false);
  const applied = await app.inject({ method: 'POST', url: '/admin/units/location-backfill?apply=1' });
  assert.equal(calls.backfill[1].apply, true);
  assert.equal(applied.json().applied, true);
  assert.equal((await app.inject({ method: 'POST', url: '/admin/units/location-backfill' })).json().applied, false);
  assert.deepEqual(calls.backfill[1].incoming, { depositId: 'D', locationId: 'L', });
});

// Ligações no código dos servidores (os dois arquivos andam juntos).
for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const src = fs.readFileSync(file, 'utf8');
  const route = (method, path) => { const i = src.indexOf(`fastify.${method}('${path}'`); assert.ok(i >= 0, `${file} ${path}`); return src.slice(i, src.indexOf('\nfastify.', i + 10)); };
  test(`${file}: entrada de aparelho completa o local com o Depósito`, () => {
    assert.match(route('post', '/units'), /withIncomingDefault\(u, await ensureIncomingStockLocation\(unitCompanyRow/);
    assert.match(route('post', '/units/batch'), /withIncomingDefault\(u, await incomingFor\(/);
  });
  test(`${file}: aparelho que sai da venda volta para o Depósito com evento`, () => {
    const put = route('put', '/units/:id');
    assert.match(put, /isReturnFromSale\(previousUnit\?\.status, u\.status\)/);
    assert.match(put, /eventType: 'returned_to_incoming'/);
  });
  test(`${file}: falha ao gravar o evento não impede o recálculo do saldo na volta da venda`, () => {
    const put = route('put', '/units/:id');
    assert.match(put, /try \{\s*await recordUnitEvent\(pool, \{[\s\S]*?\} catch \(eventError\) \{[\s\S]*?\}\s*\}\s*await syncProductStock\(rows\[0\]\.product_id\);/);
  });
  test(`${file}: Depósito / Entrada só é regravado quando algo difere`, () => {
    const i = src.indexOf('async function ensureIncomingStockLocation');
    const body = src.slice(i, src.indexOf('\n}\n', i));
    assert.match(body, /WHERE id=\? AND NOT \(name <=> 'Deposito' AND type <=> 'warehouse' AND is_active <=> 1\)/);
    assert.match(body, /WHERE id=\? AND NOT \(name <=> 'Entrada \/ Conferencia' AND is_active <=> 1/);
  });
  test(`${file}: transferência por quantidade recusa produto com IMEI`, () => {
    assert.match(route('post', '/stock-locations/transfers'), /Produto com IMEI: transfira pelos aparelhos em Aparelhos → Transferir aparelhos\./);
  });
  test(`${file}: rotas e tabela registradas`, () => {
    assert.match(src, /unitLocationServer\.cjs'\)\.registerUnitLocationRoutes\(fastify, \{/);
    assert.match(src, /ensureUnitEventsTable\(pool\)/);
    assert.match(src, /getIncomingStockLocation: ensureIncomingStockLocation/);
  });
}

test('entrada por foto sem local usa o Depósito', () => {
  const src = fs.readFileSync('services/smartphonePhotoIntakeServer.cjs', 'utf8');
  assert.match(src, /dependencies\.getIncomingStockLocation/);
});

test('deploy da API sobe os módulos novos', () => {
  const deploy = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
  for (const mod of ['services/unitLocation.cjs', 'services/unitLocationServer.cjs']) assert.ok(deploy.includes(`'${mod}'`), mod);
});

test('transferência não fixa a empresa padrão (a regra usa a empresa do produto)', async t => {
  const { app, calls } = setup(t);
  await app.inject({ method: 'POST', url: '/admin/units/transfers', payload: transferBody });
  assert.equal(calls.transfer[0].companyId, undefined);
});

test('entrada por foto recalcula o saldo por local na mesma transação', () => {
  const src = fs.readFileSync('services/smartphonePhotoIntakeServer.cjs', 'utf8');
  assert.match(src, /dependencies\.syncProductStock\(productId, connection, \{ stockLocationInTransaction: true \}\)/);
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    assert.match(fs.readFileSync(file, 'utf8'), /getIncomingStockLocation: ensureIncomingStockLocation, syncProductStock \}/, file);
  }
});

test('servidor devolve 400 quando o local vem pela metade', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok((src.match(/err\.statusCode === 400 && err\.halfLocation/g) || []).length >= 2, file);
  }
});

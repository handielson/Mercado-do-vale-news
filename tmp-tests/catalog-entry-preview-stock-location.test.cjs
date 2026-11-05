'use strict';

// Prévia da Entrada: o local padrão (Loja Principal / Estoque Geral) é criado na conexão da transação,
// para o ROLLBACK da prévia desfazer tudo. Outros chamadores seguem usando o pool.
// Roda as funções reais de vps_server.cjs (recortadas) com banco falso.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function slice(src, start, end) {
  const from = src.indexOf(start);
  assert.ok(from >= 0, `trecho nao encontrado: ${start}`);
  const to = src.indexOf(end, from + start.length);
  assert.ok(to > from, `fim nao encontrado: ${end}`);
  return src.slice(from, to);
}
const locationBlock = src => slice(src, 'async function ensureDefaultStockLocation(', 'async function seedDefaultStockLocations(');
const syncBlock = src => slice(src, 'async function syncSerializedProductStockFromUnits(', '// ─── Recibos Avulsos');
function wiringLine(src) {
  const at = src.indexOf("require('./services/catalogEntryServer.cjs').registerCatalogEntryRoutes(fastify,");
  assert.ok(at >= 0, 'registerCatalogEntryRoutes nao encontrado');
  return src.slice(at, src.indexOf('\n', at));
}

function fakeDb(label) {
  const calls = [];
  return {
    label, calls,
    async query(sql, params = []) {
      calls.push(sql.replace(/\s+/g, ' ').trim());
      if (/FROM stock_deposits WHERE company_id/.test(sql)) return [[]];
      if (/FROM stock_locations WHERE deposit_id/.test(sql)) return [[]];
      if (/SELECT id, company_id FROM products/.test(sql)) return [[{ id: params[0], company_id: 'c1' }]];
      if (/FROM units/.test(sql)) return [[]];
      return [{ affectedRows: 1 }];
    },
  };
}
const locationWrites = db => db.calls.filter(sql => /^(INSERT INTO|UPDATE) stock_(deposits|locations)/.test(sql));

function load() {
  const src = read('vps_server.cjs');
  const pool = fakeDb('pool');
  let registered = null;
  const context = {
    pool, crypto: require('node:crypto'), console,
    fastify: {},
    requireSyncKeyOrAdmin() {}, getVpsBearerAuthContext: async () => null,
    photoIntakeRoutes: { finalizePhotoIntake() {}, ensureSchema() {} },
    getDefaultStockCompanyId: async () => 'c1',
    syncProductStockFromLocations: async () => 0, insertStockMovement: async () => {},
    upsertStockLocationBalance: async () => {},
    require: mod => {
      if (/catalogEntryServer/.test(mod)) return { registerCatalogEntryRoutes: (_f, opts) => { registered = opts; } };
      if (/smartphoneMovingAverageServer/.test(mod)) return { synchronizeProduct: async () => {} };
      throw new Error(`require inesperado: ${mod}`);
    },
  };
  vm.createContext(context);
  vm.runInContext(locationBlock(src), context);
  vm.runInContext(syncBlock(src), context);
  vm.runInContext(wiringLine(src), context);
  assert.ok(registered, 'rotas da Entrada registradas');
  return { context, pool, deps: registered.deps };
}

test('porta da Entrada: syncProductStock cria o local padrao na conexao da transacao, nunca pelo pool', async () => {
  const { pool, deps } = load();
  const conn = fakeDb('conn');
  await deps.syncProductStock('p1', conn);
  assert.deepEqual(locationWrites(pool), [], 'pool nao pode gravar local na previa');
  assert.equal(locationWrites(conn).length, 2, 'deposito e local criados na transacao');
  assert.ok(conn.calls.some(sql => sql.startsWith('INSERT INTO stock_deposits')));
  assert.ok(conn.calls.some(sql => sql.startsWith('INSERT INTO stock_locations')));
});

test('outros chamadores: syncProductStock sem conexao continua criando o local pelo pool', async () => {
  const { context, pool } = load();
  await context.syncProductStock('p1');
  assert.equal(locationWrites(pool).length, 2);
});

test('outros chamadores com conexao (ex.: venda serializada) mantem o local pelo pool', async () => {
  const { context, pool } = load();
  const conn = fakeDb('conn');
  await context.syncProductStock('p1', conn);
  assert.equal(locationWrites(pool).length, 2);
  assert.deepEqual(locationWrites(conn), []);
});

test('ensureDefaultStockLocation e ensureIncomingStockLocation aceitam db opcional; sem ele usam o pool', async () => {
  const { context, pool } = load();
  const conn = fakeDb('conn');
  await context.ensureDefaultStockLocation('c1', conn);
  await context.ensureIncomingStockLocation('c1', conn);
  assert.deepEqual(locationWrites(pool), []);
  assert.equal(locationWrites(conn).length, 4);
  await context.ensureDefaultStockLocation('c1');
  await context.ensureIncomingStockLocation('c1');
  assert.equal(locationWrites(pool).length, 4);
});

test('vps_server.js e vps_server.cjs tem o mesmo trecho', () => {
  const js = read('vps_server.js');
  const cjs = read('vps_server.cjs');
  assert.equal(locationBlock(js), locationBlock(cjs));
  assert.equal(syncBlock(js), syncBlock(cjs));
  assert.equal(wiringLine(js), wiringLine(cjs));
});

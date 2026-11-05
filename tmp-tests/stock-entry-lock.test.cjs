'use strict';

// stock-entry-lock-v1: estoque so entra pela tela Entrada.
// Roda os handlers reais de vps_server.cjs (recortados) com banco falso, como print3d-migrations-mysql.test.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const MSG = 'Entrada de estoque é feita pela tela Entrada (Admin → Entrada).';
const PARENT_MSG = 'Aparelho não pode ficar no produto pai. Use a variação (cor/memória).';
const SYNC = 'chave-teste';

function slice(src, start, end) {
  const from = src.indexOf(start);
  assert.ok(from >= 0, `trecho nao encontrado: ${start}`);
  const to = src.indexOf(end, from + start.length);
  assert.ok(to > from, `fim nao encontrado: ${end}`);
  return src.slice(from, to);
}

function lockBlock(src) {
  return slice(src, '// stock-entry-lock-v1: helpers', '// Atualiza unidade');
}
function tableInsertBlock(src) {
  return slice(src, "fastify.post('/table-data/:name',", "fastify.post('/admin/cashback/reconcile-sales'");
}
function batchBlock(src) {
  return slice(src, "fastify.post('/products/batch'", '// Price/stock sync: deliberately');
}

function fakeReply() {
  return {
    statusCode: 200, payload: undefined,
    code(c) { this.statusCode = c; return this; },
    send(p) { this.payload = p; return this; },
  };
}

function loadUnitsContext({ parents = new Set(), conflictIds = new Set() } = {}) {
  const src = read('vps_server.cjs');
  const inserts = [];
  const handlers = {};
  const pool = {
    async query(sql, params = []) {
      if (/SELECT is_parent FROM products WHERE id IN/.test(sql)) {
        return [params[0].filter(id => parents.has(id)).map(() => ({ is_parent: 1 }))];
      }
      if (/SELECT is_parent FROM products WHERE id=\?/.test(sql)) {
        return [parents.has(params[0]) ? [{ is_parent: 1 }] : [{ is_parent: 0 }]];
      }
      if (/INSERT INTO units/.test(sql)) { inserts.push(params); return [{ affectedRows: 1 }]; }
      if (/INSERT INTO/.test(sql)) { inserts.push(params); return [{ affectedRows: 1 }]; }
      if (/SELECT \* FROM units WHERE id/.test(sql)) return [[{ id: params[0] }]];
      if (/SHOW KEYS/.test(sql)) return [[{ Column_name: 'id' }]];
      return [[]];
    },
  };
  const context = {
    fastify: {
      post: (url, _opts, handler) => { handlers[url] = handler; },
      put() {}, patch() {}, delete() {}, get() {},
    },
    pool, process: { env: { SYNC_SECRET: SYNC } }, require, crypto: require('node:crypto'),
    requireSyncKey() {}, requireSyncKeyOrAdmin() {},
    findSerializedIdentifierDuplicateInBatch: () => null,
    collectUnitSerializedIdentifiers: u => [u.imei_1, u.imei_2, u.serial].filter(Boolean),
    findUnitSerializedIdentifierConflict: async ids => (ids.some(id => conflictIds.has(id))
      ? { table: 'units', field: 'imei_1', value: ids.find(id => conflictIds.has(id)) } : null),
    serializedIdentifierConflictPayload: c => ({ error: `IMEI ja cadastrado: ${c.value}`, conflict: c }),
    syncProductStock: async () => {},
    isValidTable: name => /^[a-zA-Z0-9_]+$/.test(name),
    getPrimaryKey: async () => 'id',
    normalizeTableDataValue: v => (v === undefined ? null : v),
  };
  vm.createContext(context);
  vm.runInContext(lockBlock(src), context);
  vm.runInContext(tableInsertBlock(src), context);
  return { handlers, inserts };
}

const syncReq = (body, extra = {}) => ({ body, headers: { 'x-sync-key': SYNC, 'x-stock-maintenance': '1', ...extra }, params: {} });

test('POST /units sem origin responde 409 com a mensagem da Entrada', async () => {
  const { handlers, inserts } = loadUnitsContext();
  const reply = fakeReply();
  await handlers['/units'](syncReq({ product_id: 'p1', imei_1: '111' }), reply);
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.error, MSG);
  assert.equal(inserts.length, 0);
});

test('POST /units/batch sem origin responde 409', async () => {
  const { handlers, inserts } = loadUnitsContext();
  const reply = fakeReply();
  await handlers['/units/batch'](syncReq([{ product_id: 'p1', imei_1: '111' }]), reply);
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.error, MSG);
  assert.equal(inserts.length, 0);
});

test('POST /units/batch com um item sem origin no lote inteiro responde 409', async () => {
  const { handlers, inserts } = loadUnitsContext();
  const reply = fakeReply();
  await handlers['/units/batch'](syncReq([
    { product_id: 'p1', imei_1: '111', origin: 'maintenance' },
    { product_id: 'p1', imei_1: '222' },
  ]), reply);
  assert.equal(reply.statusCode, 409);
  assert.equal(inserts.length, 0);
});

test('origin maintenance sem x-sync-key (so x-api-key) continua bloqueado', async () => {
  const { handlers } = loadUnitsContext();
  const reply = fakeReply();
  await handlers['/units']({ body: { product_id: 'p1', origin: 'maintenance' }, headers: { 'x-api-key': SYNC } }, reply);
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.error, MSG);
});

test('origin maintenance com x-sync-key errada continua bloqueado', async () => {
  const { handlers } = loadUnitsContext();
  const reply = fakeReply();
  await handlers['/units']({ body: { product_id: 'p1', origin: 'maintenance' }, headers: { 'x-sync-key': 'outra', 'x-stock-maintenance': '1' } }, reply);
  assert.equal(reply.statusCode, 409);
});

test('origin maintenance + sync key sem x-stock-maintenance continua 409 (caso do SPA via /api/vps-proxy)', async () => {
  const { handlers, inserts } = loadUnitsContext();
  for (const headers of [{ 'x-sync-key': SYNC }, { 'x-sync-key': SYNC, 'x-stock-maintenance': '0' }]) {
    let reply = fakeReply();
    await handlers['/units']({ body: { product_id: 'p1', imei_1: '111', origin: 'maintenance' }, headers }, reply);
    assert.equal(reply.statusCode, 409);
    assert.equal(reply.payload.error, MSG);
    reply = fakeReply();
    await handlers['/units/batch']({ body: [{ product_id: 'p1', imei_1: '111', origin: 'maintenance' }], headers }, reply);
    assert.equal(reply.statusCode, 409);
    assert.equal(reply.payload.error, MSG);
  }
  assert.equal(inserts.length, 0);
});

test('/api/vps-proxy remonta os cabecalhos e nao repassa x-stock-maintenance', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const proxy = slice(read(file), "fastify.all('/api/vps-proxy'", 'const response = await fastify.inject(');
    const built = proxy.slice(proxy.indexOf('const headers = {'));
    assert.doesNotMatch(built, /x-stock-maintenance/, `${file}: proxy nao pode repassar o cabecalho`);
    assert.doesNotMatch(built, /\.\.\.request\.headers/, `${file}: proxy nao pode copiar todos os cabecalhos`);
    const setKeys = [...built.matchAll(/headers\[['"]([^'"]+)['"]\]\s*=/g)].map(m => m[1]).sort();
    assert.deepEqual(setKeys, ['content-type', 'x-sync-key'], `${file}: lista fixa de cabecalhos mudou`);
  }
});

test('POST /units com origin maintenance e sync key segue e grava', async () => {
  const { handlers, inserts } = loadUnitsContext();
  const reply = fakeReply();
  await handlers['/units'](syncReq({ product_id: 'p1', imei_1: '111', origin: 'maintenance' }), reply);
  assert.equal(reply.statusCode, 201);
  assert.equal(inserts.length, 1);
});

test('manutencao: produto pai continua 409 e IMEI repetido continua conflito', async () => {
  const { handlers, inserts } = loadUnitsContext({ parents: new Set(['pai']), conflictIds: new Set(['999']) });
  let reply = fakeReply();
  await handlers['/units'](syncReq({ product_id: 'pai', imei_1: '111', origin: 'maintenance' }), reply);
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.error, PARENT_MSG);

  reply = fakeReply();
  await handlers['/units'](syncReq({ product_id: 'p1', imei_1: '999', origin: 'maintenance' }), reply);
  assert.equal(reply.statusCode, 409);
  assert.match(reply.payload.error, /999/);

  reply = fakeReply();
  await handlers['/units/batch'](syncReq([{ product_id: 'pai', imei_1: '111', origin: 'maintenance' }]), reply);
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.error, PARENT_MSG);

  reply = fakeReply();
  const result = await handlers['/units/batch'](syncReq([
    { product_id: 'p1', imei_1: '999', origin: 'maintenance' },
    { product_id: 'p1', imei_1: '123', origin: 'maintenance' },
  ]), reply);
  assert.equal(result.inserted, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(inserts.length, 1);
});

test('POST /table-data/units e /table-data/units/bulk respondem 409; outras tabelas seguem', async () => {
  const { handlers, inserts } = loadUnitsContext();
  let reply = fakeReply();
  await handlers['/table-data/:name']({ params: { name: 'units' }, body: { product_id: 'p1' }, headers: {} }, reply);
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.error, MSG);

  reply = fakeReply();
  await handlers['/table-data/:name']({ params: { name: 'UNITS' }, body: { product_id: 'p1' }, headers: {} }, reply);
  assert.equal(reply.statusCode, 409);

  reply = fakeReply();
  await handlers['/table-data/:name/bulk']({ params: { name: 'units' }, body: [{ product_id: 'p1' }], headers: {} }, reply);
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.error, MSG);
  assert.equal(inserts.length, 0);

  reply = fakeReply();
  await handlers['/table-data/:name']({ params: { name: 'feedback' }, body: { text: 'oi' }, headers: {} }, reply);
  assert.equal(reply.statusCode, 201);
  assert.equal(inserts.length, 1);
});

function loadBatch({ existingIds = new Set(), blingMatches = {}, realReconcile = null } = {}) {
  const src = read('vps_server.cjs');
  const reconciled = [];
  const inserts = [];
  let handler;
  const pool = {
    async query(sql, params = []) {
      if (/WHERE p\.bling_id=\?/.test(sql)) {
        const id = blingMatches[params[0]];
        return [id ? [{ id }] : []];
      }
      if (/SELECT id FROM products WHERE id=\? LIMIT 1/.test(sql)) {
        return [existingIds.has(params[0]) ? [{ id: params[0] }] : []];
      }
      if (/SELECT slug FROM products WHERE id=\?/.test(sql)) return [[{ slug: 'ja-tem' }]];
      if (/INSERT INTO products/.test(sql)) { inserts.push(params); return [{ affectedRows: 1, warningStatus: 0 }]; }
      return [[]];
    },
  };
  const context = {
    fastify: { post: (_url, _opts, h) => { handler = h; } },
    pool, requireSyncKey() {},
    findSerializedIdentifierDuplicateInBatch: () => null, collectProductSerializedIdentifiers: () => [],
    serializedIdentifierConflictPayload: c => c,
    normalizePrint3dProductOffer: () => {}, findProductSerializedIdentifierConflict: async () => null,
    withSmartphonePriceWrite: async (db, _p, fn) => fn(db, {}),
    require: mod => (/productSku/.test(mod)
      ? { withProductSku: async (db, _p, fn) => fn(db) }
      : { reconcileExternalStock: async (pool_, args) => { reconciled.push(args); return realReconcile ? realReconcile(pool_, args) : { ok: true }; } }),
    ensureIncomingStockLocation: async () => ({}), getDefaultStockCompanyId: async () => null,
    sanitizeDescription: v => v || null, jsonStr: v => (v == null ? null : JSON.stringify(v)),
    normalizeProductSpecsRam: v => v, optionalBool: v => (v == null ? null : Number(Boolean(v))),
    slugifyPublicProductRouteTargetVps: v => String(v).toLowerCase(),
  };
  vm.runInNewContext(batchBlock(src), context);
  return { run: body => handler({ body }, fakeReply()), reconciled, inserts };
}

test('/products/batch: produto novo sem bling_id nasce com estoque 0', async () => {
  const { run, reconciled, inserts } = loadBatch();
  const result = await run([{ id: 'novo', name: 'Novo', slug: 'novo', stock_quantity: 5 }]);
  assert.equal(result.upserted, 1, JSON.stringify(result.errors));
  assert.equal(inserts.length, 1);
  assert.equal(reconciled.length, 0, 'nenhuma gravacao de estoque');
  assert.deepEqual(JSON.parse(JSON.stringify(result.resolved)), [{ requested_id: 'novo', id: 'novo', bling_id: null, matched_existing: false, stock_ignored: true }]);
});

test('/products/batch: linha sem id tambem ignora o estoque inicial', async () => {
  const { run, reconciled, inserts } = loadBatch();
  const result = await run([{ name: 'Sem id', slug: 'sem-id', stock_quantity: 5 }]);
  assert.equal(result.upserted, 1, JSON.stringify(result.errors));
  assert.equal(inserts.length, 1);
  assert.equal(reconciled.length, 0);
  assert.equal(result.resolved[0].stock_ignored, true);
});

test('/products/batch: estoque invalido em produto novo continua com o erro antigo', async () => {
  const { reconcileExternalStock } = require('../services/externalStockReconciliation.cjs');
  for (const bad of [-1, 1.5, 2147483648, 'abc']) {
    const { run, reconciled } = loadBatch({ realReconcile: reconcileExternalStock });
    const result = await run([{ id: 'novo-ruim', name: 'Ruim', slug: 'r', stock_quantity: bad }]);
    assert.equal(result.upserted, 0, `valor ${bad}`);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].error, 'Saldo externo inválido.', `valor ${bad}`);
    assert.equal(reconciled.length, 1, 'o valor invalido segue para o conciliador');
  }
});

test('/products/batch: produto novo com bling_id grava o estoque do Bling', async () => {
  const { run, reconciled } = loadBatch();
  const result = await run([{ id: 'novo-bling', name: 'Bling', slug: 'b', bling_id: 777, stock_quantity: 5 }]);
  assert.equal(result.upserted, 1, JSON.stringify(result.errors));
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].targetQuantity, 5);
  assert.equal(reconciled[0].productId, 'novo-bling');
});

test('/products/batch: produto existente (por id ou por bling_id) concilia o estoque como hoje', async () => {
  const { run, reconciled } = loadBatch({ existingIds: new Set(['velho']), blingMatches: { 888: 'velho-bling' } });
  let result = await run([{ id: 'velho', name: 'Velho', slug: 'v', stock_quantity: 5 }]);
  assert.equal(result.upserted, 1, JSON.stringify(result.errors));
  result = await run([{ id: 'outro-id', name: 'Velho Bling', slug: 'vb', bling_id: 888, stock_quantity: 4 }]);
  assert.equal(result.upserted, 1, JSON.stringify(result.errors));
  assert.deepEqual(reconciled.map(r => [r.productId, r.targetQuantity]), [['velho', 5], ['velho-bling', 4]]);
});

test('/products/batch: stock_ignored so aparece quando o estoque foi ignorado', async () => {
  const { run } = loadBatch({ existingIds: new Set(['velho']) });
  const result = await run([
    { id: 'velho', name: 'Velho', slug: 'v', stock_quantity: 5 },
    { id: 'bling-novo', name: 'B', slug: 'b', bling_id: 1, stock_quantity: 2 },
    { id: 'sem-saldo', name: 'S', slug: 's' },
  ]);
  assert.equal(result.upserted, 3);
  assert.ok(result.resolved.every(r => !('stock_ignored' in r)));
});

test('/products/batch: produto novo sem stock_quantity nao concilia nada', async () => {
  const { run, reconciled } = loadBatch();
  const result = await run([{ id: 'sem-estoque', name: 'X', slug: 'x' }]);
  assert.equal(result.upserted, 1);
  assert.equal(reconciled.length, 0);
});

test('vps_server.js e vps_server.cjs tem o mesmo trecho da trava', () => {
  const js = read('vps_server.js');
  const cjs = read('vps_server.cjs');
  assert.equal(lockBlock(js), lockBlock(cjs));
  assert.equal(tableInsertBlock(js), tableInsertBlock(cjs));
  assert.equal(batchBlock(js), batchBlock(cjs));
  for (const src of [js, cjs]) {
    assert.ok(src.includes(MSG));
    assert.match(batchBlock(src), /stock-entry-lock-v1/);
  }
});

test('script de manutencao manda origin maintenance', () => {
  const script = read('scripts/rebuild-smartphone-serialized-units.cjs');
  assert.match(script, /origin: 'maintenance'/);
  assert.match(script, /'x-stock-maintenance': '1'/);
});

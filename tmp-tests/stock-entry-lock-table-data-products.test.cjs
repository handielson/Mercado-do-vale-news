'use strict';

// stock-entry-lock-v1: /table-data/products (MySQL Explorer) não grava stock_quantity.
// Roda os handlers reais de vps_server.cjs (recortados) com banco falso, como stock-entry-lock.test.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const MSG = 'Entrada de estoque é feita pela tela Entrada (Admin → Entrada).';

function slice(src, start, end) {
  const from = src.indexOf(start);
  assert.ok(from >= 0, `trecho nao encontrado: ${start}`);
  const to = src.indexOf(end, from + start.length);
  assert.ok(to > from, `fim nao encontrado: ${end}`);
  return src.slice(from, to);
}
const lockBlock = src => slice(src, '// stock-entry-lock-v1: helpers', '// Atualiza unidade');
const tableInsertBlock = src => slice(src, "fastify.post('/table-data/:name',", "fastify.post('/admin/cashback/reconcile-sales'");
const tablePatchBlock = src => slice(src, "fastify.patch('/table-data/:name/:pkValue'", '// DELETE por PK');

function fakeReply() {
  return {
    statusCode: 200, payload: undefined,
    code(c) { this.statusCode = c; return this; },
    send(p) { this.payload = p; return this; },
  };
}

function load() {
  const src = read('vps_server.cjs');
  const writes = [];
  const handlers = {};
  const pool = {
    async query(sql, params = []) {
      if (/^\s*(INSERT|UPDATE)/i.test(sql)) { writes.push({ sql, params }); return [{ affectedRows: 1 }]; }
      if (/SELECT \* FROM products WHERE id=\?/.test(sql)) return [[{ id: params[0] }]];
      return [[{ id: params[0] }]];
    },
  };
  const register = (method) => (url, _opts, handler) => { handlers[`${method} ${url}`] = handler; };
  const context = {
    fastify: { post: register('POST'), patch: register('PATCH'), put() {}, delete() {}, get() {} },
    pool, process: { env: {} }, require, crypto: require('node:crypto'),
    requireSyncKey() {}, requireSyncKeyOrAdmin() {},
    isValidTable: name => /^[a-zA-Z0-9_]+$/.test(name),
    getPrimaryKey: async () => 'id',
    normalizeTableDataValue: v => (v === undefined ? null : v),
    insertProductRecordsWithGroupPrices: async (_pool, rows) => {
      writes.push({ sql: 'insertProductRecordsWithGroupPrices', params: rows });
      return rows.map(row => row.id);
    },
    patchProductWithGroupPrices: async (_pool, id, body) => {
      writes.push({ sql: 'patchProductWithGroupPrices', params: [id, body] });
    },
  };
  vm.createContext(context);
  vm.runInContext(lockBlock(src), context);
  vm.runInContext(tableInsertBlock(src), context);
  vm.runInContext(tablePatchBlock(src), context);
  return { handlers, writes };
}

const req = (name, body, extra = {}) => ({ params: { name, ...extra }, body, headers: {}, query: {} });

test('POST /table-data/products com stock_quantity responde 409 e nao grava', async () => {
  const { handlers, writes } = load();
  for (const name of ['products', 'PRODUCTS']) {
    const reply = fakeReply();
    await handlers['POST /table-data/:name'](req(name, { name: 'X', stock_quantity: 5 }), reply);
    assert.equal(reply.statusCode, 409, name);
    assert.equal(reply.payload.error, MSG);
    assert.equal(reply.payload.code, 'STOCK_ENTRY_LOCKED');
  }
  // Mesmo 0 ou null: a coluna não é gravada por aqui.
  for (const value of [0, null]) {
    const reply = fakeReply();
    await handlers['POST /table-data/:name'](req('products', { name: 'X', stock_quantity: value }), reply);
    assert.equal(reply.statusCode, 409);
  }
  assert.equal(writes.length, 0);
});

test('POST /table-data/products/bulk com stock_quantity em qualquer linha responde 409', async () => {
  const { handlers, writes } = load();
  const reply = fakeReply();
  await handlers['POST /table-data/:name/bulk'](req('products', [{ name: 'A' }, { name: 'B', stock_quantity: 2 }]), reply);
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.error, MSG);
  assert.equal(writes.length, 0);
});

test('PATCH /table-data/products/:pk com stock_quantity responde 409 e nao grava', async () => {
  const { handlers, writes } = load();
  const reply = fakeReply();
  await handlers['PATCH /table-data/:name/:pkValue'](req('products', { status: 'inactive', stock_quantity: 0 }, { pkValue: 'p1' }), reply);
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.payload.error, MSG);
  assert.equal(writes.length, 0);
});

test('products sem stock_quantity segue como hoje (insert, bulk e PATCH)', async () => {
  const { handlers, writes } = load();
  let reply = fakeReply();
  const created = await handlers['POST /table-data/:name'](req('products', { id: 'n1', name: 'X', price_retail: 100 }), reply);
  assert.equal(reply.statusCode, 201);
  assert.equal(created.id, 'n1');

  reply = fakeReply();
  const bulk = await handlers['POST /table-data/:name/bulk'](req('products', [{ id: 'b1', name: 'A' }, { id: 'b2', name: 'B' }]), reply);
  assert.equal(bulk.inserted, 2);

  reply = fakeReply();
  const patched = await handlers['PATCH /table-data/:name/:pkValue'](req('products', { image_url: 'x.jpg' }, { pkValue: 'p1' }), reply);
  assert.equal(reply.statusCode, 200);
  assert.equal(patched.id, 'p1');
  assert.deepEqual(writes.map(w => w.sql), ['insertProductRecordsWithGroupPrices', 'insertProductRecordsWithGroupPrices', 'patchProductWithGroupPrices']);
});

test('outras tabelas com coluna stock_quantity nao sao afetadas', async () => {
  const { handlers, writes } = load();
  let reply = fakeReply();
  await handlers['POST /table-data/:name'](req('purchase_quotes', { id: 'q1', stock_quantity: 3 }), reply);
  assert.equal(reply.statusCode, 201);
  reply = fakeReply();
  await handlers['PATCH /table-data/:name/:pkValue'](req('purchase_quotes', { stock_quantity: 4 }, { pkValue: 'q1' }), reply);
  assert.equal(reply.statusCode, 200);
  assert.equal(writes.length, 2);
});

test('vps_server.js e vps_server.cjs tem o mesmo trecho das rotas table-data', () => {
  const js = read('vps_server.js');
  const cjs = read('vps_server.cjs');
  assert.equal(lockBlock(js), lockBlock(cjs));
  assert.equal(tableInsertBlock(js), tableInsertBlock(cjs));
  assert.equal(tablePatchBlock(js), tablePatchBlock(cjs));
});

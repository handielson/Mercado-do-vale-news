// stock-write-off-v1: baixa administrativa passa pelo Bling (saída com motivo e responsável) e baixa no MdV.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStockWriteOffs, blingNotes, validate, KINDS } = require('../services/stockWriteOffs.cjs');

function fakePool({ product, serialCount = 0, unit = null, balance = { id: 'b1', company_id: 'c1', deposit_id: 'd1', location_id: 'l1', quantity: 5, reserved_quantity: 0 } } = {}) {
  const log = [];
  const q = async (sql, params = []) => {
    log.push([sql.replace(/\s+/g, ' ').trim(), params]);
    if (/FROM products WHERE id/.test(sql)) return [[product]];
    if (/COUNT\(\*\) AS n FROM units/.test(sql)) return [[{ n: serialCount }]];
    if (/FROM units WHERE id/.test(sql)) return [[unit]];
    if (/UPDATE units/.test(sql)) return [{ affectedRows: 1 }];
    if (/FROM product_stock_locations WHERE product_id = \?/.test(sql) && /ORDER BY/.test(sql)) return [[balance]];
    if (/FROM product_stock_locations WHERE id = \? FOR UPDATE/.test(sql)) return [[balance]];
    if (/SUM\(quantity\)/.test(sql)) return [[{ q: balance.quantity - 1 }]];
    return [[]];
  };
  const conn = { query: q, beginTransaction: async () => {}, commit: async () => log.push(['COMMIT']), rollback: async () => log.push(['ROLLBACK']), release() {} };
  return { log, query: q, getConnection: async () => conn };
}
function fakeFetch(calls, { fail = false } = {}) {
  return async (url, opts = {}) => {
    calls.push([url, opts.body ? JSON.parse(opts.body) : null]);
    if (url.includes('/depositos')) return { ok: true, json: async () => ({ data: [{ id: 77, descricao: 'Depósito 01 (Loja)' }] }) };
    if (fail) return { ok: false, status: 400, text: async () => 'erro' };
    return { ok: true, json: async () => ({}) };
  };
}
const base = { product_id: 'p1', quantity: 1, kind: 'avaria', reason: 'Tela quebrada na vitrine', responsible: 'Handielson' };
const product = { id: 'p1', company_id: 'c1', name: 'Fone X', sku: 'FX1', bling_id: '123', is_combo: 0 };

test('tipos incluem avaria e uso na loja', () => { assert.ok(KINDS.avaria && KINDS.uso_loja); });
test('motivo e responsável obrigatórios', () => {
  assert.throws(() => validate({ ...base, reason: '' }), /motivo/);
  assert.throws(() => validate({ ...base, responsible: '' }), /quem/);
  assert.throws(() => validate({ ...base, kind: 'x' }), /tipo/);
});
test('observação do Bling tem tipo, motivo e responsável', () => {
  const n = blingNotes({ kind: 'uso_loja', reason: 'Carregador do balcão', responsible: 'Ana', imei: '' });
  assert.match(n, /Retirada para uso na loja/); assert.match(n, /Motivo: Carregador do balcão/); assert.match(n, /Responsável: Ana/);
});
test('baixa sem IMEI: saída no Bling e depois no MdV', async () => {
  const pool = fakePool({ product }); const calls = [];
  const w = createStockWriteOffs({ pool, getBlingAuthHeader: async () => 'Bearer t', syncProductStock: async () => {}, fetchImpl: fakeFetch(calls), env: {} });
  const r = await w.create(base);
  const mov = calls.find(([u]) => u.endsWith('/estoques'))[1];
  assert.equal(mov.operacao, 'S'); assert.equal(mov.quantidade, 1); assert.equal(mov.deposito.id, 77);
  assert.match(mov.observacoes, /Motivo: Tela quebrada na vitrine/); assert.match(mov.observacoes, /Responsável: Handielson/);
  assert.ok(pool.log.some(([s, p]) => /UPDATE product_stock_locations SET quantity/.test(s) && p[0] === 4));
  assert.ok(pool.log.some(([s]) => /INSERT INTO stock_write_offs/.test(s)));
  assert.equal(r.kind_label, KINDS.avaria);
});
test('Bling recusou: nada muda no MdV', async () => {
  const pool = fakePool({ product }); const calls = [];
  const w = createStockWriteOffs({ pool, getBlingAuthHeader: async () => 'Bearer t', fetchImpl: fakeFetch(calls, { fail: true }), env: {} });
  await assert.rejects(() => w.create(base), /Bling recusou/);
  assert.ok(!pool.log.some(([s]) => /UPDATE product_stock_locations/.test(s)));
});
test('produto sem Bling ou kit é recusado', async () => {
  for (const p of [{ ...product, bling_id: null }, { ...product, is_combo: 1 }]) {
    const w = createStockWriteOffs({ pool: fakePool({ product: p }), getBlingAuthHeader: async () => 'x', fetchImpl: fakeFetch([]), env: {} });
    await assert.rejects(() => w.create(base));
  }
});
test('produto com IMEI exige o aparelho e marca como baixado', async () => {
  const unit = { id: 'u1', product_id: 'p1', imei_1: '351234567890123', status: 'available', deposit_id: 'd1', location_id: 'l1' };
  const pool = fakePool({ product, serialCount: 2, unit }); const calls = []; let synced = false;
  const w = createStockWriteOffs({ pool, getBlingAuthHeader: async () => 'Bearer t', syncProductStock: async () => { synced = true; }, fetchImpl: fakeFetch(calls), env: {} });
  await assert.rejects(() => w.create(base), /aparelho/);
  await w.create({ ...base, unit_id: 'u1' });
  assert.ok(pool.log.some(([s]) => /UPDATE units SET status = 'written_off'/.test(s)));
  assert.match(calls.find(([u]) => u.endsWith('/estoques'))[1].observacoes, /IMEI: 351234567890123/);
  assert.ok(synced);
});
test('tela Baixa de estoque está na rota e no menu', () => {
  const fs = require('node:fs'); const path = require('node:path'); const r = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert.match(r('routes/index.tsx'), /path: "\/admin\/estoque\/baixas"/);
  assert.match(r('layouts/AdminLayout.tsx'), /'\/admin\/estoque\/baixas'.*Baixa de estoque/);
  assert.match(r('pages/admin/inventory/StockWriteOffsPage.tsx'), /'\/stock-write-offs'/);
  assert.match(r('scripts/deploy-stock-write-offs.cjs'), /requireSyncKeyOrAdmin/);
});

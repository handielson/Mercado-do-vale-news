// shopee-g-stock-v1
const test = require('node:test');
const assert = require('node:assert/strict');
const { createShopeeIndividualStock } = require('../services/shopeeIndividualStock.cjs');
const { patch } = require('../scripts/deploy-shopee-g-stock.cjs');

function world() {
  const moves = [];
  const st = { moves, sales: [], products: { 'SLNBKUG': { bling_id: '111', name: 'Suporte' }, 'KIT2': { bling_id: '900', name: 'Kit' } } };
  const key = (a) => a.slice(0, 4).join('|');
  st.pool = { query: async (sql, a = []) => {
    if (/CREATE TABLE/.test(sql)) return [{}];
    if (/FROM shopee_shop_connections/.test(sql)) return [[{ id: 'g1', display_name: 'Shopee - Gláucia' }]];
    if (/FROM marketplace_sales_cache/.test(sql)) return [st.sales];
    if (/INSERT IGNORE INTO shopee_g_stock_moves/.test(sql)) { const k = [a[0], a[1], a[2], a[4]].join('|'); if (moves.find((m) => m.k === k)) return [{ affectedRows: 0 }]; moves.push({ k, status: 'sending', attempts: 0 }); return [{ affectedRows: 1 }]; }
    if (/SELECT status, attempts FROM shopee_g_stock_moves/.test(sql)) return [[moves.find((m) => m.k === a.join('|'))]];
    if (/SELECT attempts FROM shopee_g_stock_moves/.test(sql)) return [[moves.find((m) => m.k === a.join('|'))]];
    if (/SELECT 1 FROM shopee_g_stock_moves/.test(sql)) { const m = moves.find((x) => x.k === [a[0], a[1], a[2], 'S'].join('|')); return [[m && m.status === 'ok' ? { 1: 1 } : undefined]]; }
    if (/UPDATE shopee_g_stock_moves SET status='sending'/.test(sql)) { moves.find((m) => m.k === a.join('|')).status = 'sending'; return [{}]; }
    if (/UPDATE shopee_g_stock_moves SET status='ok'/.test(sql)) { const m = moves.find((x) => x.k === a.slice(1).join('|')); m.status = 'ok'; m.attempts += 1; return [{}]; }
    if (/UPDATE shopee_g_stock_moves SET status='skipped'/.test(sql)) { const m = moves.find((x) => x.k === a.slice(1).join('|')); m.status = 'skipped'; m.attempts += 1; return [{}]; }
    if (/UPDATE shopee_g_stock_moves SET status='error'/.test(sql)) { const m = moves.find((x) => x.k === a.slice(1).join('|')); m.status = 'error'; m.attempts += 1; m.error = a[0]; return [{}]; }
    if (/FROM products WHERE sku/.test(sql)) return [[st.products[a[0]]]];
    throw new Error('sql ' + sql);
  } };
  st.bling = [];
  st.fetch = async (url, init = {}) => {
    const path = url.replace('https://api.bling.com.br/Api/v3', '');
    let body = {};
    if (path.startsWith('/depositos')) body = { data: [{ id: 5, descricao: 'Depósito 01 (Loja)' }] };
    else if (path === '/produtos/900') body = { data: { formato: 'E', estrutura: { componentes: [{ produto: { id: 111 }, quantidade: 2 }] } } };
    else if (path.startsWith('/produtos/')) body = { data: { formato: 'S' } };
    else if (path === '/estoques') st.bling.push(JSON.parse(init.body));
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
  return st;
}
const sale = (id, status, items) => ({ external_id: id, status, sale_json: JSON.stringify({ details: { items } }) });

test('venda paga da loja PF = saída no Bling, uma vez só; cancelada = entrada', async () => {
  const w = world(); const notes = [];
  const s = createShopeeIndividualStock({ pool: w.pool, fetchImpl: w.fetch, getAuthHeader: async () => 'Bearer x', notify: async (t) => notes.push(t), logger: {} });
  w.sales.push(sale('A1', 'PROCESSED', [{ sku: 'SLNBKUG', quantity: 2 }]), sale('U1', 'UNPAID', [{ sku: 'SLNBKUG', quantity: 1 }]));
  assert.deepEqual(await s.tick(), { saida: 1, entrada: 0, erro: 0, sem_sku: 0, pulado: 0 });
  assert.deepEqual(w.bling[0], { produto: { id: 111 }, deposito: { id: 5 }, operacao: 'S', quantidade: 2, observacoes: 'Venda Shopee - Gláucia pedido A1' });
  assert.equal((await s.tick()).saida, 0, 'não repete');
  w.sales[0].status = 'CANCELLED';
  assert.equal((await s.tick()).entrada, 1);
  assert.equal(w.bling[1].operacao, 'E');
  assert.equal(w.bling.length, 2);
});

test('kit baixa os componentes; cancelada sem saída não devolve; SKU desconhecido avisa', async () => {
  const w = world(); const notes = [];
  const s = createShopeeIndividualStock({ pool: w.pool, fetchImpl: w.fetch, getAuthHeader: async () => 'Bearer x', notify: async (t) => notes.push(t), logger: {} });
  w.sales.push(sale('K1', 'SHIPPED', [{ sku: 'KIT2', quantity: 3 }]), sale('C1', 'CANCELLED', [{ sku: 'SLNBKUG', quantity: 1 }]), sale('X1', 'COMPLETED', [{ sku: 'NAOEXISTE', quantity: 1 }, { sku: '', quantity: 1 }]));
  const r = await s.tick();
  assert.deepEqual(r, { saida: 1, entrada: 0, erro: 1, sem_sku: 1, pulado: 0 });
  assert.deepEqual([w.bling[0].produto.id, w.bling[0].quantidade], [111, 6]);
  assert.match(notes[0], /Estoque NÃO baixado/); assert.match(notes[0], /NAOEXISTE/);
});

test('deploy: SKU do anúncio sem variação (item_sku) e ligação no servidor', () => {
  const src = "x\nmarketplaceSalesGroupVps.start();\n  sku: String(\n      item?.product_sku\n      || item?.model_sku\n      || item?.seller_sku\n";
  const out = patch(src);
  assert.match(out, /\|\| item\?\.model_sku\n      \|\| item\?\.item_sku/);
  assert.match(out, /shopeeGStockVps\.start\(\)/);
  assert.equal(patch(out), out);
});

test('retroativo: estoque já zerado não baixa (não deixa negativo) e não avisa', async () => {
  const w = world(); const notes = [];
  w.products = w.products || {};
  const q = w.pool.query;
  w.pool.query = async (sql, a = []) => /SELECT stock_quantity FROM products/.test(sql) ? [[{ stock_quantity: a[0] === 'SLNBKUG' ? 0 : 5 }]] : q(sql, a);
  const s = createShopeeIndividualStock({ pool: w.pool, fetchImpl: w.fetch, getAuthHeader: async () => 'Bearer x', notify: async (t) => notes.push(t), logger: {}, liveSince: Date.now() });
  w.sales.push({ ...sale('OLD', 'SHIPPED', [{ sku: 'SLNBKUG', quantity: 1 }]), occurred_at: new Date(Date.now() - 86400e3) },
    { ...sale('OLD2', 'SHIPPED', [{ sku: 'NAOEXISTE', quantity: 1 }]), occurred_at: new Date(Date.now() - 86400e3) });
  const r = await s.tick();
  assert.equal(r.pulado, 1); assert.equal(r.erro, 1); assert.equal(w.bling.length, 0); assert.equal(notes.length, 0);
});

// marketplace-cancel-stock-v1
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMarketplaceCancelStock } = require('../services/marketplaceCancelStock.cjs');

function world() {
  const st = { sales: [], moves: [], cfg: {}, jobs: {}, patched: [], bling: {} };
  st.pool = { query: async (sql, a = []) => {
    if (/CREATE TABLE/.test(sql)) return [{}];
    if (/SELECT v FROM marketplace_cancel_config/.test(sql)) return [[st.cfg.baseline_done ? { v: '1' } : undefined]];
    if (/INSERT IGNORE INTO marketplace_cancel_config/.test(sql)) { st.cfg.baseline_done = '1'; return [{}]; }
    if (/FROM marketplace_sales_cache c/.test(sql)) return [st.sales.filter((s) => !st.moves.find((m) => m.ch === s.channel && m.id === s.external_id))];
    if (/INSERT IGNORE INTO marketplace_cancel_moves/.test(sql)) { st.moves.push({ ch: a[0], id: a[1], action: a[2], pedido: a[3] }); return [{}]; }
    if (/FROM mercado_livre_print_jobs/.test(sql)) return [[st.jobs[a[0]]]];
    throw new Error('sql ' + sql);
  } };
  st.fetch = async (url, init = {}) => {
    const path = url.replace('https://api.bling.com.br/Api/v3', '');
    let body = {};
    if (path.startsWith('/pedidos/vendas?')) { const n = decodeURIComponent(path.split('=')[1]); body = { data: st.bling[n] ? [st.bling[n]] : [] }; }
    else if (/\/situacoes\/12$/.test(path)) { st.patched.push(path); return { ok: true, status: 204, text: async () => '' }; }
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  };
  return st;
}
const sale = (channel, id) => ({ channel, connection_id: channel === 'shopee' ? 'primary' : '', external_id: id, status: 'cancelled',
  sale_json: JSON.stringify({ details: { items: [{ name: 'Fone', sku: 'SG8P', quantity: 1 }] } }) });

test('1ª rodada só marca; depois: cancela no Bling, respeita já cancelado, não mexe em enviado, ignora fora do Bling', async () => {
  const w = world(); const notes = [];
  const c = createMarketplaceCancelStock({ pool: w.pool, fetchImpl: w.fetch, getAuthHeader: async () => 'Bearer x', notify: async (t) => notes.push(t), logger: {}, gapMs: 0 });
  w.sales.push(sale('mercado_livre', 'OLD'));
  w.bling.OLD = { id: 1, numero: 11000, situacao: { id: 9 } };
  assert.equal((await c.tick()).baseline, 1);
  assert.equal(w.patched.length, 0, 'antigo não é mexido');
  w.sales.push(sale('mercado_livre', 'A'), sale('tiktok', 'B'), sale('mercado_livre', 'C'), sale('shopee', 'D'));
  w.bling.A = { id: 2, numero: 11613, situacao: { id: 9 } };
  w.bling.B = { id: 3, numero: 11700, situacao: { id: 12 } };
  w.bling.C = { id: 4, numero: 11701, situacao: { id: 9 } };
  w.jobs.C = { shipment_status: 'shipped' };
  const r = await c.tick();
  assert.deepEqual(r, { cancelado: 1, ja_cancelado: 1, nao_no_bling: 1, enviado: 1, erro: 0, baseline: 0 });
  assert.deepEqual(w.patched, ['/pedidos/vendas/2/situacoes/12']);
  assert.ok(notes.some((n) => /Cancelei o pedido 11613/.test(n)));
  assert.ok(notes.some((n) => /depois de enviada/.test(n) && /11701/.test(n)));
  assert.equal((await c.tick()).cancelado, 0, 'não repete');
});

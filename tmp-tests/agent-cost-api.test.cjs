const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createAgentCostApi, isDeviceCategory } = require('../services/agentCostApi.cjs');

function fakePool(rows) {
  const sqls = [];
  return { sqls, pool: { async query(sql, params) { sqls.push([sql.replace(/\s+/g, ' '), params]); return [rows]; } } };
}
const KEY = 'k'.repeat(40);

test('agente: chave obrigatória, comparada sem vazar tempo; sem chave configurada fica desligado', () => {
  const api = createAgentCostApi({ pool: {}, manualCost: {}, key: KEY });
  assert.equal(api.authorize({ 'x-agent-key': KEY }), true);
  assert.equal(api.authorize({ 'x-agent-key': 'errada' }), false);
  assert.equal(api.authorize({}), false);
  const off = createAgentCostApi({ pool: {}, manualCost: {}, key: '' });
  assert.equal(off.authorize({ 'x-agent-key': '' }), false, 'sem MDV_AGENT_KEY nada passa');
  const curta = createAgentCostApi({ pool: {}, manualCost: {}, key: 'curta' });
  assert.equal(curta.authorize({ 'x-agent-key': 'curta' }), false, 'chave curta demais é recusada');
});

test('celular e tablet ficam de fora (cadastro e estoque vêm do MdV)', () => {
  for (const n of ['Smartphones', 'Celulares', 'Tablets', 'iPad']) assert.equal(isDeviceCategory(n), true, n);
  for (const n of ['Acessórios', 'Controles', null]) assert.equal(isDeviceCategory(n), false, String(n));
});

test('lista só produtos ativos, sem custo, com SKU e Bling, sem IMEI, sem pai, e tira celular/tablet', async () => {
  const { pool, sqls } = fakePool([
    { id: 'a', sku: 'CLV01', name: 'Controle', bling_id: '16734992811', price_cost: null, category_name: 'Controles', custom_fields: null },
    { id: 'b', sku: 'RN13', name: 'Redmi Note 13', bling_id: '1', price_cost: 0, category_name: 'Smartphones', custom_fields: null },
    { id: 'c', sku: 'VAR1', name: 'Variação', bling_id: '2', price_cost: 0, category_name: 'Capas', custom_fields: '{"inherit_parent_cost":true}' },
  ]);
  const api = createAgentCostApi({ pool, manualCost: {}, key: KEY });
  const r = await api.pending({ limit: '3' });
  assert.deepEqual(r.products.map((p) => p.sku), ['CLV01']);
  assert.deepEqual(r.products[0], { id: 'a', sku: 'CLV01', name: 'Controle', bling_id: '16734992811', price_cost: null, category: 'Controles' });
  const sql = sqls[0][0];
  for (const trecho of ["status = 'active'", '(p.price_cost IS NULL OR p.price_cost = 0)', 'bling_id', 'is_parent', 'FROM units']) assert.ok(sql.includes(trecho), trecho);
  assert.equal(sqls[0][1].at(-1) >= 3, true, 'busca folga para compensar os filtrados');
});

test('limite vai de 1 a 50', async () => {
  const { pool, sqls } = fakePool([]);
  const api = createAgentCostApi({ pool, manualCost: {}, key: KEY });
  await api.pending({ limit: '999' });
  await api.pending({ limit: 'x' });
  assert.deepEqual(sqls.map((s) => s[1].at(-1)), [200, 40]);
});

test('salvar usa o custo manual do admin, marca como agente e recusa celular/tablet', async () => {
  const chamadas = [];
  const manualCost = { async updateCost(id, body, actor) { chamadas.push({ id, body, actor }); return { ok: true, product: { id, price_cost: body.cost_cents } }; } };
  const { pool } = fakePool([{ id: 'a', category_name: 'Controles' }]);
  const api = createAgentCostApi({ pool, manualCost, key: KEY });
  const r = await api.save('a', { cost_cents: 1000, expected_cost_cents: null, note: 'último lançamento Bling 13/11/2026', source: { bling_id: '16734992811' } });
  assert.equal(r.ok, true);
  assert.equal(chamadas[0].actor.context, 'agente_openbot');
  assert.match(chamadas[0].body.note, /^Agente OpenBot: último lançamento Bling/);

  const cel = createAgentCostApi({ pool: fakePool([{ id: 'b', category_name: 'Smartphones' }]).pool, manualCost, key: KEY });
  await assert.rejects(() => cel.save('b', { cost_cents: 1, expected_cost_cents: null }), (e) => e.statusCode === 409);
  const sumiu = createAgentCostApi({ pool: fakePool([]).pool, manualCost, key: KEY });
  await assert.rejects(() => sumiu.save('z', { cost_cents: 1, expected_cost_cents: null }), (e) => e.statusCode === 404);
});

test('as rotas do agente estão ligadas nos dois servidores e no deploy', () => {
  const raiz = path.join(__dirname, '..');
  for (const f of ['vps_server.js', 'vps_server.cjs']) assert.match(fs.readFileSync(path.join(raiz, f), 'utf8'), /registerAgentCostRoutes\(fastify/, f);
  assert.match(fs.readFileSync(path.join(raiz, 'deploy-vps-server-only.cjs'), 'utf8'), /services\/agentCostApi\.cjs/);
});

test('cascata: cursor pelo nome+id, pulados não voltam e a lista acaba', async () => {
  const linhas = [
    { id: '1', sku: 'A', name: 'Alfa', bling_id: '1', price_cost: null, category_name: 'X' },
    { id: '2', sku: 'B', name: 'Beta', bling_id: '2', price_cost: null, category_name: 'Smartphones' },
    { id: '3', sku: 'C', name: 'Gama', bling_id: '3', price_cost: null, category_name: 'X' },
  ];
  const sqls = [];
  const pool = { async query(sql, params) { sqls.push([sql.replace(/\s+/g, ' '), params]); return [params.length > 1 ? [] : linhas]; } };
  const api = createAgentCostApi({ pool, manualCost: {}, key: KEY });
  const r1 = await api.pending({ limit: '1' });
  assert.deepEqual(r1.products.map((p) => p.sku), ['A']);
  assert.ok(r1.next, 'tem próxima página');
  const c = JSON.parse(Buffer.from(r1.next, 'base64url').toString());
  assert.deepEqual(c, { name: 'Alfa', id: '1' }, 'cursor no último item entregue');
  const r2 = await api.pending({ limit: '1', after: r1.next });
  assert.ok(sqls[1][0].includes('(p.name > ? OR (p.name = ? AND p.id > ?))'), 'filtra depois do cursor');
  assert.deepEqual(sqls[1][1].slice(0, 3), ['Alfa', 'Alfa', '1']);
  assert.deepEqual(r2, { products: [], next: null }, 'acabou');
  await assert.rejects(() => api.pending({ after: 'lixo!!' }), (e) => e.statusCode === 400);
});

test('cascata: quando todos do bloco são filtrados, o cursor anda pelo último lido', async () => {
  const bloco = Array.from({ length: 4 }, (_, i) => ({ id: String(i), sku: 'S' + i, name: 'Cel ' + i, bling_id: '9', price_cost: null, category_name: 'Smartphones' }));
  const pool = { async query() { return [bloco]; } };
  const api = createAgentCostApi({ pool, manualCost: {}, key: KEY });
  const r = await api.pending({ limit: '1' });
  assert.deepEqual(r.products, []);
  assert.deepEqual(JSON.parse(Buffer.from(r.next, 'base64url').toString()), { name: 'Cel 3', id: '3' });
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../services/productFamilyInheritance.cjs');
const parent = { id: '11111111-1111-1111-1111-111111111111', is_parent: 1, price_cost: 1000 };
const child = { id: '22222222-2222-2222-2222-222222222222', parent_id: parent.id, price_cost: 2000, price_retail: 2500, stock_quantity: 3, custom_fields: { other: 'preservar' } };
const selections = [{ child_id: child.id, fields: ['price_cost'], inherit_cost: true }];
test('herança preserva venda, estoque e metadados e acompanha novo custo do pai', () => {
 const plan = core.buildFamilyInheritancePlan(parent, [child], selections);
 assert.deepEqual(Object.keys(plan.changes[0].changed).sort(), ['custom_fields', 'price_cost']);
 assert.equal(plan.changes[0].changed.custom_fields.to.other, 'preservar');
 const inherited = { ...child, custom_fields: plan.changes[0].changed.custom_fields.to };
 assert.deepEqual(core.inheritedCostPatch({ ...parent, price_cost: 1700 }, inherited), { price_cost: 1700 });
 assert.equal(core.buildFamilyInheritancePlan(parent, [inherited], [{ child_id: child.id, fields: [], inherit_cost: false }]).changes[0].changed.price_cost, undefined);
});
test('prévia detecta edição concorrente e rejeita filho de outra família', () => {
 const first = core.buildFamilyInheritancePlan(parent, [child], selections);
 assert.notEqual(first.fingerprint, core.buildFamilyInheritancePlan({ ...parent, price_cost: 1100 }, [child], selections).fingerprint);
 assert.throws(() => core.buildFamilyInheritancePlan(parent, [{ ...child, parent_id: 'outro' }], selections), /família/);
});
test('rota MySQL grava JSON da opção com transação e rejeita prévia vencida', async () => {
 const source = fs.readFileSync(require.resolve('../vps_server.cjs'), 'utf8');
 const begin = source.indexOf("fastify.post('/products/:id/family-inheritance'");
 const end = source.indexOf('// Single product update', begin);
 assert.ok(begin >= 0 && end > begin, 'rota de herança disponível');
 let handler;
 const writes = [];
 const lifecycle = [];
 const db = {
  beginTransaction: async () => lifecycle.push('begin'),
  commit: async () => lifecycle.push('commit'),
  rollback: async () => lifecycle.push('rollback'),
  release: () => lifecycle.push('release'),
  query: async (sql, values) => {
   if (sql.startsWith('SELECT')) return [[sql.includes('id IN') ? child : parent]];
   writes.push({ sql, values }); return [{ affectedRows: 1 }];
  },
 };
 vm.runInNewContext(source.slice(begin, end), { fastify: { post: (url, options, fn) => { handler = fn; } }, require: path => { assert.equal(path, './services/productFamilyInheritance.cjs'); return core; }, requireSyncKey() {}, pool: { getConnection: async () => db }, sanitizeDescription: value => value });
 const reply = { code(status) { this.status = status; return this; }, send(value) { return value; } };
 const preview = await handler({ params: { id: parent.id }, body: { selections } }, reply);
 assert.equal(writes.length, 0);
 await handler({ params: { id: parent.id }, body: { selections, apply: true, fingerprint: preview.fingerprint } }, reply);
 assert.equal(writes.length, 1);
 const json = writes[0].values.find(value => typeof value === 'string' && value.startsWith('{'));
 assert.equal(JSON.parse(json).inherit_parent_cost, true);
 assert.equal(JSON.parse(json).other, 'preservar');
 assert.ok(lifecycle.includes('commit'));
 await handler({ params: { id: parent.id }, body: { selections, apply: true, fingerprint: 'vencida' } }, reply);
 assert.equal(reply.status, 409);
 assert.equal(writes.length, 1);
});

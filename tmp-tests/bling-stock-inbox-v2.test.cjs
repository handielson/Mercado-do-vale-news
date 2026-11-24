// bling-stock-inbox-v2
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createBlingStockWebhookQueue } = require('../services/blingStockWebhookQueue.cjs');
const { patch } = require('../scripts/deploy-bling-stock-inbox.cjs');

function fakePool(rows) {
  const conn = {
    async query(sql, args = []) {
      if (/GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
      if (/RELEASE_LOCK/.test(sql)) return [[]];
      if (/WHERE status='processing'/.test(sql)) return [[]];
      if (/WHERE status='pending' AND next_attempt_at/.test(sql)) return [rows.filter((r) => r.status === 'pending').slice(0, 1)];
      if (/SET status='processing'/.test(sql)) { const r = rows.find((x) => x.id === args[0]); r.status = 'processing'; r.attempts += 1; return [[]]; }
      if (/SET status='done'/.test(sql)) { rows.find((x) => x.id === args[0]).status = 'done'; return [[]]; }
      if (/SET status=\?,last_error/.test(sql)) { const r = rows.find((x) => x.id === args[3]); r.status = args[0]; r.last_error = args[1]; return [[]]; }
      throw new Error('sql inesperado: ' + sql);
    },
    release() {},
  };
  return {
    async getConnection() { return conn; },
    async query(sql, args = []) {
      if (/CREATE TABLE/.test(sql)) return [[]];
      if (/WHERE status='failed' ORDER BY/.test(sql)) return [rows.filter((r) => r.status === 'failed')];
      if (/SET status='failed_notified'/.test(sql)) { rows.filter((r) => args.includes(r.id)).forEach((r) => { r.status = 'failed_notified'; }); return [[]]; }
      if (/SET status='pending',attempts=0/.test(sql)) { let n = 0; rows.filter((r) => /failed/.test(r.status)).forEach((r) => { r.status = 'pending'; r.attempts = 0; n += 1; }); return [{ affectedRows: n }]; }
      return conn.query(sql, args);
    },
  };
}
const row = (id, attempts) => ({ id, attempts, status: 'pending', payload: JSON.stringify({ data: { produto: { id: 16697256815 } } }), request_context: '{}' });

test('desiste na tentativa máxima, grava o motivo e avisa uma vez agrupado', async () => {
  const rows = [row('a', 39), row('b', 5)];
  const sent = [];
  const q = createBlingStockWebhookQueue({ pool: fakePool(rows), maxAttempts: 40, logger: { warn() {}, error() {} },
    processEvent: async () => ({ ok: false, error: 'MdV: produto do Bling 16697256815 não está cadastrado no MdV' }), notify: async (t) => sent.push(t) });
  await q.tick();
  assert.equal(rows[0].status, 'failed'); assert.match(rows[0].last_error, /não está cadastrado/);
  await q.tick();
  assert.equal(rows[1].status, 'pending');
  await q.report(); await q.report();
  assert.equal(sent.length, 1); assert.match(sent[0], /Bling 16697256815 \(1x\): MdV: produto/);
  assert.equal(rows[0].status, 'failed_notified');
  assert.deepEqual(await q.requeue({}), { requeued: 1 });
  assert.equal(rows[0].status, 'pending');
});

test('patch do servidor: motivo real e limite', { skip: !process.env.MDV_VPS_SNAPSHOT && 'sem cópia do vps_server' }, () => {
  const out = patch(fs.readFileSync(process.env.MDV_VPS_SNAPSHOT, 'utf8'));
  assert.match(out, /error: \(vpsStockResult\.ok && marketplaceStockSync\.ok\) \? undefined : describeBlingStockFailureVps/);
  assert.match(out, /maxAttempts: 40/);
  assert.match(out, /blingStockWebhookQueue\.register\(fastify/);
  const src = out.match(/function describeBlingStockFailureVps[\s\S]*?\n}\n/)[0];
  const fn = new Function(src + 'return describeBlingStockFailureVps;')();
  assert.equal(fn({ ok: false, stockTargets: [] }, { ok: true, shopee: { ok: true } }, 99), 'MdV: produto do Bling 99 não está cadastrado no MdV');
  assert.match(fn({ ok: true }, { ok: false, shopee: { ok: false, errors: [{ connection_id: '9e06ff3a-x', item_id: 5, error: 'error_param', message: 'item deleted' }] }, tiktok: { ok: true }, mercadoLivre: { ok: true } }, 1), /^Shopee: loja 9e06ff3a 5 error_param item deleted$/);
});

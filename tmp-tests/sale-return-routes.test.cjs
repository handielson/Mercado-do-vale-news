// Parte 3: devolução de itens no servidor (transação, estornos, estoque, aparelho, arquivos, status).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Fastify = require('fastify');
const fixture = require('./fixtures/unit-timeline-868499080873669.json');
const { registerSaleReturnRoutes, createSaleReturn, saveReturnFile } = require('../services/saleReturnServer.cjs');

const SALE = fixture.sales[0].id;
const poco = fixture.saleItems.find(i => i.product_sku === 'POCO0001-03');
const cup = fixture.saleItems.find(i => i.product_sku === 'CTT473B');
const UNIT = poco.serialized_unit_id;

function fakeDb(overrides = {}) {
  const s = {
    sale: { ...fixture.sales[0], payment_status: 'paid', return_status: null, profit_before_returns: null, ...overrides.sale },
    items: structuredClone(fixture.saleItems), unit: { ...fixture.unit, status: 'sold', sale_id: SALE },
    returns: [], returnItems: [], refunds: [], files: [], partial: overrides.partial || [], cashOpen: overrides.cashOpen ?? true,
    committed: false, rolledBack: false, saleUpdates: [],
  };
  const db = {
    s,
    async beginTransaction() {}, async commit() { s.committed = true; }, async rollback() { s.rolledBack = true; }, release() {},
    async query(sql, p = []) {
      if (/^SELECT \* FROM sales WHERE id = \? FOR UPDATE/.test(sql)) return [[s.sale]];
      if (/^SELECT \* FROM sale_items WHERE sale_id = \?/.test(sql)) return [s.items];
      if (/^SELECT sale_item_id, quantity, value_cents, suggested_cents FROM sale_return_items WHERE sale_id = \?/.test(sql)) return [s.returnItems];
      if (/^SELECT payment_index, goods_cents, refund_cents FROM sale_return_refunds WHERE sale_id = \?/.test(sql)) return [s.refunds.map(r => ({ payment_index: r[3], goods_cents: r[5], refund_cents: r[6] }))];
      if (/^SELECT id FROM sale_returns WHERE id = \?/.test(sql)) return [s.missingReturn ? [] : [{ id: p[0] }]];
      if (/^SELECT payment_index, amount FROM sale_partial_refunds/.test(sql)) return [s.partial];
      if (/^SELECT status FROM pdv_cash_sessions WHERE id = \?/.test(sql)) return [s.cashOpen ? [{ status: 'open' }] : []];
      if (/^SELECT company_id FROM products WHERE id = \?/.test(sql)) return [[{ company_id: 'c' }]];
      if (/^SELECT \* FROM units WHERE id = \? FOR UPDATE/.test(sql)) return [[s.unit]];
      if (/^UPDATE units SET status = 'available'/.test(sql)) { Object.assign(s.unit, { status: 'available', sale_id: null, deposit_id: p[0], location_id: p[1] }); return [{ affectedRows: 1 }]; }
      if (/^INSERT INTO sale_returns /.test(sql)) { s.returns.push(p); return [{}]; }
      if (/^INSERT INTO sale_return_items /.test(sql)) { s.returnItems.push({ sale_item_id: p[3], quantity: p[5], value_cents: p[6], suggested_cents: p[7] }); return [{}]; }
      if (/^INSERT INTO sale_return_refunds /.test(sql)) { s.refunds.push(p); return [{}]; }
      if (/^UPDATE sales SET /.test(sql)) { s.saleUpdates.push({ sql, p }); return [{}]; }
      if (/^SELECT \* FROM sale_return_refunds WHERE return_id = \?/.test(sql)) return [s.refunds.map(r => ({ id: r[0], method: r[4], gateway_refund_id: r[9] }))];
      if (/^SELECT kind, refund_id FROM sale_return_files WHERE return_id = \?/.test(sql)) return [s.files];
      if (/^INSERT INTO sale_return_files /.test(sql)) { if (s.failFileInsert) throw new Error('banco caiu'); s.files.push({ kind: p[2], refund_id: p[3] }); return [{}]; }
      if (/^UPDATE sale_returns SET status = \?/.test(sql)) { s.lastStatus = p[0]; return [{}]; }
      if (/^SELECT \* FROM sale_returns WHERE id = \?/.test(sql)) return [[{ id: p[0], sale_id: SALE, code: 'D1' }]];
      if (/^SELECT id FROM sale_returns WHERE client_request_id = \?/.test(sql)) return [s.returns.filter(r => r[9] === p[0]).map(r => ({ id: r[0] }))];
      if (/^UPDATE sale_return_refunds SET gateway_status = \?/.test(sql)) { const r = s.refunds.find(x => x[0] === p[2]); if (r) { r.gatewayStatus = p[0]; r[9] = p[1]; } s.gatewayUpdates = (s.gatewayUpdates || 0) + 1; return [{}]; }
      throw new Error('SQL inesperado: ' + sql.slice(0, 90));
    },
  };
  return db;
}
function deps(db, extra = {}) {
  const calls = { restore: [], events: [], syncs: [], cash: [], mp: [] };
  return {
    calls,
    restoreStock: async (conn, saleId, limits, reason) => { calls.restore.push({ saleId, limits: Object.fromEntries(limits), reason }); return [...limits].map(([product_id, q]) => ({ product_id, quantity_restored: q })); },
    recordUnitEvent: async (conn, ev) => { calls.events.push(ev); },
    syncProductStock: async (pid, conn, opts) => { calls.syncs.push({ pid, inTx: opts?.stockLocationInTransaction }); },
    recordCashEvent: async (conn, req, ev) => { calls.cash.push(ev); },
    ensureIncomingStockLocation: async () => ({ depositId: 'dep-d', locationId: 'loc-e' }),
    refundMercadoPagoPix: async (id, cents, key) => { calls.mp.push([id, cents]); calls.mpKeys = [...(calls.mpKeys || []), key]; calls.mpAfterCommit = db.s.committed; return { refundId: 'mp-r1' }; },
    ...extra,
  };
}
const actor = { userId: 'op', name: 'Operador Teste' };
const run = (db, d, body) => createSaleReturn({ db, saleId: SALE, body, actor, request: {}, deps: d });

test('devolver só o Poco: valor, estorno na mesma forma, aparelho volta ao Depósito, venda parcial', async () => {
  const db = fakeDb(); const d = deps(db);
  const r = await run(db, d, { items: [{ sale_item_id: poco.id, quantity: 1 }], reason: 'cliente desistiu', refund_mode: 'same', cash_session_id: 'cx' });
  assert.equal(r.total_cents, 191617);
  assert.equal(r.status, 'pendente');
  assert.deepEqual(r.refunds.map(x => [x.method, x.refund_cents]), [['money', 30000], ['credit', 180849]]);
  assert.equal(db.s.unit.status, 'available'); assert.equal(db.s.unit.location_id, 'loc-e');
  assert.equal(d.calls.events[0].eventType, 'returned_to_incoming');
  assert.match(d.calls.events[0].reason, /Devolução #/);
  assert.deepEqual(d.calls.syncs.map(x => [x.pid, x.inTx]), [[poco.product_id, true]]);
  assert.equal(d.calls.restore.length, 0);                   // aparelho não passa pela restauração de quantidade
  const upd = db.s.saleUpdates.at(-1);
  assert.match(upd.sql, /return_status = \?/); assert.ok(upd.p.includes('partial'));
  assert.ok(!/payment_status/.test(upd.sql));
  assert.equal(d.calls.cash.length, 2); assert.equal(d.calls.cash[0].referenceType, 'sale_return');
  assert.equal(db.s.committed, true);
});

test('devolver tudo: estoque comum restaurado por produto, venda cancelada, total pago devolvido', async () => {
  const db = fakeDb(); const d = deps(db);
  const r = await run(db, d, { items: fixture.saleItems.map(i => ({ sale_item_id: i.id, quantity: 1 })), reason: 'desistiu', refund_mode: 'same', cash_session_id: 'cx' });
  assert.equal(r.total_cents, 195432);
  assert.equal(r.refunds.reduce((a, x) => a + x.refund_cents, 0), 215118);
  assert.equal(d.calls.restore.length, 1);
  assert.deepEqual(Object.keys(d.calls.restore[0].limits).sort(), [cup.product_id, fixture.saleItems.find(i => i.product_sku === 'P3DRN15PRO').product_id].sort());
  const upd = db.s.saleUpdates.at(-1);
  assert.match(upd.sql, /payment_status = 'cancelled'/); assert.ok(upd.p.includes('full'));
});

test('lucro desconta (valor devolvido − custo) e guarda o original', async () => {
  const db = fakeDb(); const d = deps(db);
  await run(db, d, { items: [{ sale_item_id: cup.id, quantity: 1 }], reason: 'x', refund_mode: 'other', amount_cents: 2386, refunds: [{ method: 'money', amount_cents: 2386 }], cash_session_id: 'cx' });
  const upd = db.s.saleUpdates.at(-1);
  assert.match(upd.sql, /profit_before_returns = COALESCE\(profit_before_returns, profit\)/);
  assert.match(upd.sql, /profit = profit - \?/);
  assert.ok(upd.p.includes(2386 - Number(cup.unit_cost)));
});

test('acima do devolvível, item repetido ou quantidade inválida → 409/400 sem gravar', async () => {
  const db = fakeDb(); const d = deps(db);
  db.s.returnItems.push({ sale_item_id: poco.id, quantity: 1, value_cents: 191617 });
  await assert.rejects(run(db, d, { items: [{ sale_item_id: poco.id, quantity: 1 }], reason: 'x', refund_mode: 'same', cash_session_id: 'cx' }), e => e.statusCode === 409);
  await assert.rejects(run(db, deps(db), { items: [{ sale_item_id: cup.id, quantity: 0 }], reason: 'x', refund_mode: 'same' }), e => e.statusCode === 400);
  await assert.rejects(run(db, deps(db), { items: [{ sale_item_id: cup.id, quantity: 1 }], reason: '', refund_mode: 'same' }), e => e.statusCode === 400 && /motivo/i.test(e.message));
  await assert.rejects(run(db, deps(db), { items: [{ sale_item_id: cup.id, quantity: 1 }], reason: 'x', refund_mode: 'same', amount_cents: 999999 }), e => e.statusCode === 400);
  assert.equal(db.s.returns.length, 0);
});

test('dinheiro sem caixa aberto → 409; crediário → 409; venda cancelada → 409', async () => {
  const closed = fakeDb({ cashOpen: false });
  await assert.rejects(run(closed, deps(closed), { items: [{ sale_item_id: poco.id, quantity: 1 }], reason: 'x', refund_mode: 'same' }), e => e.statusCode === 409 && /caixa/i.test(e.message));
  const prazo = fakeDb({ sale: { payment_methods: JSON.stringify([{ method: 'a_prazo', amount: 195432, total_with_fee: 195432 }]), total: 195432 } });
  await assert.rejects(run(prazo, deps(prazo), { items: [{ sale_item_id: poco.id, quantity: 1 }], reason: 'x', refund_mode: 'same' }), e => e.statusCode === 409 && /crediário/i.test(e.message));
  const cancelled = fakeDb({ sale: { payment_status: 'cancelled' } });
  await assert.rejects(run(cancelled, deps(cancelled), { items: [{ sale_item_id: cup.id, quantity: 1 }], reason: 'x', refund_mode: 'same' }), e => e.statusCode === 409);
});

test('Pix do Mercado Pago estorna no gateway e guarda o id', async () => {
  const db = fakeDb({ sale: { total: 1490, payment_methods: JSON.stringify([{ method: 'pix', amount: 1490, total_with_fee: 1490, mercado_pago_payment_id: '987' }]) } });
  db.s.items = [fixture.saleItems.find(i => i.product_sku === 'P3DRN15PRO')];
  const d = deps(db);
  const r = await run(db, d, { items: [{ sale_item_id: db.s.items[0].id, quantity: 1 }], reason: 'x', refund_mode: 'same' });
  assert.deepEqual(d.calls.mp, [['987', 1490]]);
  assert.equal(r.refunds[0].gateway_refund_id, 'mp-r1');
});

test('arquivos: tipo e tamanho validados; recibo assinado + comprovante do cartão finalizam', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ret-'));
  const db = fakeDb(); db.s.refunds = [['r-money', 'D1', SALE, 0, 'money', 30000, 30000, 'manual', null, null], ['r-card', 'D1', SALE, 1, 'credit', 1, 1, 'manual', null, null]];
  const pdf = Buffer.from('%PDF-1.4 teste').toString('base64');
  await assert.rejects(saveReturnFile({ db, returnId: 'D1', kind: 'signed', fileName: 'a.txt', base64: Buffer.from('oi').toString('base64'), actor, root }), e => e.statusCode === 400);
  await assert.rejects(saveReturnFile({ db, returnId: 'D1', kind: 'signed', fileName: 'a.pdf', base64: Buffer.alloc(13 * 1024 * 1024, 0x25).toString('base64'), actor, root }), e => e.statusCode === 413);
  let r = await saveReturnFile({ db, returnId: 'D1', kind: 'signed', fileName: 'recibo.pdf', base64: pdf, actor, root });
  assert.equal(r.status, 'pendente');
  r = await saveReturnFile({ db, returnId: 'D1', kind: 'proof', refundId: 'r-card', fileName: 'cartao.jpg', base64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]).toString('base64'), actor, root });
  assert.equal(r.status, 'finalizada');
  assert.equal(fs.readdirSync(path.join(root, 'sale-returns', 'D1')).length, 2);
});

test('rotas exigem admin e chamam a criação', async t => {
  const app = Fastify();
  const db = fakeDb();
  registerSaleReturnRoutes(app, { pool: { getConnection: async () => db, query: (...a) => db.query(...a) }, getBearerAuthContext: async () => ({ isAdmin: false }), privateRoot: os.tmpdir(), ...deps(db) });
  t.after(() => app.close());
  for (const [method, url] of [['GET', `/admin/sales/${SALE}/returns`], ['POST', `/admin/sales/${SALE}/returns`], ['GET', '/admin/sale-returns?status=pendente'], ['POST', '/admin/sale-returns/D1/files'], ['POST', '/admin/sale-returns/D1/whatsapp']]) {
    assert.equal((await app.inject({ method, url, payload: method === 'POST' ? {} : undefined })).statusCode, 401, url);
  }
});

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  test(`${file}: devolução registrada, tabelas no boot e caixa desconta as devoluções`, () => {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, /saleReturnServer\.cjs'\)\.registerSaleReturnRoutes\(fastify, \{/);
    assert.match(src, /ensureSaleReturnSchema\(pool, addColumnIfMissing\)/);
    assert.match(src, /FROM sale_return_refunds rr[\s\S]{0,400}sr\.cash_session_id = \?/);
  });
}
test('deploy sobe os módulos da devolução', () => {
  const deploy = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
  for (const mod of ['services/saleReturnCore.cjs', 'services/saleReturnServer.cjs']) assert.ok(deploy.includes(`'${mod}'`), mod);
});

test('prévia calcula valor e divisão sem gravar nem estornar', async () => {
  const db = fakeDb(); const d = deps(db);
  const r = await run(db, d, { items: [{ sale_item_id: poco.id, quantity: 1 }], reason: 'x', refund_mode: 'same', cash_session_id: 'cx', dry_run: true });
  assert.equal(r.preview, true);
  assert.equal(r.suggested_cents, 191617);
  assert.deepEqual(r.refunds.map(x => [x.method, x.refund_cents]), [['money', 30000], ['credit', 180849]]);
  assert.equal(r.cash_words, 'trezentos reais');
  assert.equal(db.s.returns.length, 0); assert.equal(db.s.unit.status, 'sold'); assert.equal(db.s.committed, false);
  assert.equal(d.calls.mp.length, 0); assert.equal(d.calls.cash.length, 0);
});

test('devolução gravada traz o valor em dinheiro por extenso para o recibo', async () => {
  const db = fakeDb(); const d = deps(db);
  const r = await run(db, d, { items: [{ sale_item_id: poco.id, quantity: 1 }], reason: 'x', refund_mode: 'same', cash_session_id: 'cx' });
  assert.equal(r.cash_cents, 30000);
  assert.equal(r.cash_words, 'trezentos reais');
});


// Correções da revisão final
const pixSale = () => {
  const db = fakeDb({ sale: { total: 1490, payment_methods: JSON.stringify([{ method: 'pix', amount: 1490, total_with_fee: 1490, mercado_pago_payment_id: '987' }]) } });
  db.s.items = [fixture.saleItems.find(i => i.product_sku === 'P3DRN15PRO')];
  return db;
};

test('Pix do Mercado Pago só é estornado depois do commit, com chave fixa do estorno', async () => {
  const db = pixSale(); const d = deps(db);
  const r = await run(db, d, { items: [{ sale_item_id: db.s.items[0].id, quantity: 1 }], reason: 'x', refund_mode: 'same' });
  assert.equal(d.calls.mpAfterCommit, true);
  assert.equal(d.calls.mpKeys[0], `sale-return-${r.refunds[0].id}`);
  assert.equal(r.refunds[0].gateway_refund_id, 'mp-r1');
  assert.equal(db.s.refunds[0].gatewayStatus, 'done');
});

test('falha no Mercado Pago não desfaz a devolução: fica estorno manual com comprovante', async () => {
  const db = pixSale(); const d = deps(db, { refundMercadoPagoPix: async () => { throw Object.assign(new Error('recusado'), { statusCode: 502 }); } });
  const r = await run(db, d, { items: [{ sale_item_id: db.s.items[0].id, quantity: 1 }], reason: 'x', refund_mode: 'same' });
  assert.equal(db.s.committed, true);
  assert.equal(db.s.refunds[0].gatewayStatus, 'failed');
  assert.match(r.warnings[0], /Pix não foi estornado no Mercado Pago/);
  assert.equal(r.refunds[0].gateway_refund_id, null);
});

test('aparelho fora do estado esperado: nada é estornado no Mercado Pago', async () => {
  const db = fakeDb({ sale: { payment_methods: JSON.stringify([{ method: 'pix', amount: 195432, total_with_fee: 195432, mercado_pago_payment_id: '987' }]), total: 195432 } });
  db.s.unit.status = 'available';
  const d = deps(db);
  await assert.rejects(run(db, d, { items: [{ sale_item_id: poco.id, quantity: 1 }], reason: 'x', refund_mode: 'same' }), e => e.statusCode === 409);
  assert.equal(d.calls.mp.length, 0);
});

test('mesma requisição repetida não cria outra devolução', async () => {
  const db = fakeDb(); const d = deps(db);
  const body = { items: [{ sale_item_id: cup.id, quantity: 1 }], reason: 'x', refund_mode: 'same', cash_session_id: 'cx', client_request_id: 'req-1' };
  const first = await run(db, d, body);
  const again = await run(db, d, body);
  assert.equal(db.s.returns.length, 1);
  assert.equal(again.id, first.id);
  assert.equal(again.replay, true);
});

test('outra forma não passa do que ainda pode ser estornado da venda', async () => {
  const db = fakeDb({ partial: [{ payment_index: 1, amount: 185118 }] });   // cartão já estornado inteiro antes
  await assert.rejects(run(db, deps(db), { items: [{ sale_item_id: poco.id, quantity: 1 }], reason: 'x', refund_mode: 'other', refunds: [{ method: 'pix', amount_cents: 191617 }] }),
    e => e.statusCode === 409 && /já foi estornado/i.test(e.message));
});

test('valor reduzido numa leva não volta na leva seguinte', async () => {
  const db = fakeDb({ sale: { total: 30000, payment_methods: JSON.stringify([{ method: 'money', amount: 30000, total_with_fee: 30000 }]) } });
  db.s.items = [{ ...cup, id: 'tri', quantity: 3, total: 30000, subtotal: 30000, unit_cost: 1000, serialized_unit_id: null }];
  await run(db, deps(db), { items: [{ sale_item_id: 'tri', quantity: 1 }], reason: 'x', refund_mode: 'same', amount_cents: 5000, cash_session_id: 'cx' });
  const prev = await run(db, deps(db), { items: [{ sale_item_id: 'tri', quantity: 2 }], reason: 'x', refund_mode: 'same', cash_session_id: 'cx', dry_run: true });
  assert.equal(prev.suggested_cents, 20000);
});

test('venda antiga gravada em reais é recusada para estorno manual', async () => {
  const db = fakeDb({ sale: { total: '199.90', payment_methods: JSON.stringify([{ method: 'money', amount: 199.9, total_with_fee: 199.9 }]) } });
  await assert.rejects(run(db, deps(db), { items: [{ sale_item_id: cup.id, quantity: 1 }], reason: 'x', refund_mode: 'same', cash_session_id: 'cx' }),
    e => e.statusCode === 409 && /reais/i.test(e.message));
});

test('resposta diz o que voltou ao estoque por produto (para o Bling)', async () => {
  const db = fakeDb(); const d = deps(db);
  const r = await run(db, d, { items: fixture.saleItems.map(i => ({ sale_item_id: i.id, quantity: 1 })), reason: 'x', refund_mode: 'same', cash_session_id: 'cx' });
  const map = Object.fromEntries(r.restored.map(x => [x.product_id, x.quantity]));
  assert.equal(map[poco.product_id], 1);
  assert.equal(map[cup.product_id], 1);
});

test('venda guarda o devolvido e o custo devolvido em centavos', async () => {
  const db = fakeDb(); const d = deps(db);
  await run(db, d, { items: [{ sale_item_id: cup.id, quantity: 1 }], reason: 'x', refund_mode: 'other', amount_cents: 2386, refunds: [{ method: 'money', amount_cents: 2386 }], cash_session_id: 'cx' });
  const upd = db.s.saleUpdates.at(-1);
  assert.match(upd.sql, /returned_cents = COALESCE\(returned_cents, 0\) \+ \?/);
  assert.match(upd.sql, /returned_cost_cents = COALESCE\(returned_cost_cents, 0\) \+ \?/);
});

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const src = fs.readFileSync(file, 'utf8');
  test(`${file}: estorno parcial antigo e cancelar bloqueados em venda com devolução`, () => {
    const partial = src.slice(src.indexOf("fastify.post('/sales/:saleId/partial-refunds'"), src.indexOf("fastify.post('/sales/:saleId/partial-refunds'") + 3000);
    assert.match(partial, /sale\.return_status[\s\S]{0,200}Esta venda tem devolução registrada: use Devolver itens\./);
    assert.match(src, /name === 'sales' && previousSaleRow\?\.return_status[\s\S]{0,300}Esta venda tem devolução registrada: use Devolver itens\./);
  });
  test(`${file}: caixa trata venda devolvida inteira como entrada e sempre desconta a devolução`, () => {
    assert.match(src, /CASE WHEN s\.payment_status = 'paid' OR s\.return_status = 'full' THEN 'completed' ELSE s\.payment_status END AS status/);
    assert.doesNotMatch(src, /alreadyOut/);
  });
  test(`${file}: estorno Pix da devolução usa a chave de idempotência recebida`, () => {
    assert.match(src, /async function refundSalePixViaMercadoPago\(paymentId, amountCents, idempotencyKey\)/);
    assert.match(src, /'X-Idempotency-Key': idempotencyKey \|\| `sale-return-\$\{crypto\.randomUUID\(\)\}`/);
  });
}

test('arquivo de devolução inexistente → 404 sem gravar; falha no banco apaga o arquivo', async () => {
  const pdf = Buffer.from('%PDF-1.4 teste').toString('base64');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ret-'));
  const missing = fakeDb(); missing.s.missingReturn = true;
  await assert.rejects(saveReturnFile({ db: missing, returnId: 'NAO', kind: 'signed', fileName: 'r.pdf', base64: pdf, actor, root }), e => e.statusCode === 404);
  assert.equal(fs.existsSync(path.join(root, 'sale-returns', 'NAO')), false);
  const broken = fakeDb(); broken.s.failFileInsert = true;
  await assert.rejects(saveReturnFile({ db: broken, returnId: 'D1', kind: 'signed', fileName: 'r.pdf', base64: pdf, actor, root }), /banco caiu/);
  assert.deepEqual(fs.readdirSync(path.join(root, 'sale-returns', 'D1')), []);
});

test('WhatsApp que explode fica marcado como falha e responde 502', async t => {
  const app = Fastify();
  const db = fakeDb();
  db.s.customerPhone = '5599999999999';
  const realQuery = db.query.bind(db);
  const updates = [];
  db.query = async (sql, p) => {
    if (/^SELECT customer_id FROM sales/.test(sql)) return [[{ customer_id: 'c1' }]];
    if (/^SELECT phone FROM customers/.test(sql)) return [[{ phone: '5599999999999' }]];
    if (/^UPDATE sale_returns SET whatsapp_status/.test(sql)) { updates.push(p); return [{}]; }
    return realQuery(sql, p);
  };
  registerSaleReturnRoutes(app, { pool: { getConnection: async () => db, query: (...a) => db.query(...a) },
    getBearerAuthContext: async () => ({ isAdmin: true, userId: 'op' }), privateRoot: os.tmpdir(), ...deps(db),
    sendWhatsappDocument: async () => { throw new Error('gateway fora'); } });
  t.after(() => app.close());
  const res = await app.inject({ method: 'POST', url: '/admin/sale-returns/D1/whatsapp', payload: { pdf_base64: Buffer.from('%PDF-1.4 x').toString('base64') } });
  assert.equal(res.statusCode, 502);
  assert.equal(updates[0][0], 'failed');
});

test('devolução sem dinheiro não prende o caixa fechado', async () => {
  const db = fakeDb({ cashOpen: false });
  await run(db, deps(db), { items: [{ sale_item_id: cup.id, quantity: 1 }], reason: 'x', refund_mode: 'other', amount_cents: 2386, refunds: [{ method: 'pix', amount_cents: 2386 }], cash_session_id: 'cx-fechado' });
  assert.equal(db.s.returns[0][8], null);
});

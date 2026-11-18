// Local do aparelho (Parte 2): regras de entrada, volta, transferência por IMEI e preenchimento inicial.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  UNIT_EVENTS_TABLE, unitEventsMigration, withIncomingDefault, isReturnFromSale,
  transferUnits, backfillUnitLocations, stockMismatches,
} = require('../services/unitLocation.cjs');

const INC = { depositId: 'dep-deposito', locationId: 'loc-entrada' };
const LOJA = { depositId: 'dep-loja', locationId: 'loc-geral' };

// Banco falso em memória que entende as consultas do módulo.
function fakeDb({ units, products, balances = {}, locations }) {
  const state = { units: units.map(u => ({ ...u })), events: [], committed: false, rolledBack: false, queries: [] };
  const locs = locations || [
    { id: INC.locationId, deposit_id: INC.depositId, name: 'Entrada / Conferencia', deposit_name: 'Deposito', company_id: 'co', active: true },
    { id: LOJA.locationId, deposit_id: LOJA.depositId, name: 'Estoque Geral', deposit_name: 'Loja Principal', company_id: 'co', active: true },
  ];
  const db = {
    state,
    async beginTransaction() { state.snapshot = JSON.stringify(state.units); state.eventsBefore = state.events.length; },
    async commit() { state.committed = true; },
    async rollback() { state.rolledBack = true; state.units = JSON.parse(state.snapshot); state.events.length = state.eventsBefore; },
    async query(sql, params = []) {
      state.queries.push(sql);
      if (state.failOn && state.failOn.test(sql)) throw Object.assign(new Error('Deadlock found'), { code: 'ER_LOCK_DEADLOCK' });
      if (/^\s*SELECT id FROM units WHERE/i.test(sql) && !/FOR UPDATE/i.test(sql)) {
        const wanted = new Set(params.flat().map(String));
        return [state.units.filter(u => ['id', 'imei', 'imei_1', 'imei_2', 'serial'].some(k => u[k] != null && wanted.has(String(u[k])))).map(u => ({ id: u.id }))];
      }
      if (/FROM units\b[\s\S]*FOR UPDATE/i.test(sql)) {
        const wanted = new Set(params.flat().map(String));
        return [state.units.filter(u => ['id', 'imei', 'imei_1', 'imei_2', 'serial'].some(k => u[k] != null && wanted.has(String(u[k]))))];
      }
      if (/FROM stock_locations/i.test(sql)) {
        const [locationId, depositId, companyId] = params;
        const checksActive = /is_active\s*=\s*1/i.test(sql);
        return [locs.filter(l => l.id === locationId && (!depositId || l.deposit_id === depositId)
          && (!checksActive || l.active !== false) && (companyId == null || l.company_id === companyId))];
      }
      if (/^\s*UPDATE units SET deposit_id/i.test(sql)) {
        const [depositId, locationId, id] = params;
        const u = state.units.find(x => x.id === id && (!/deposit_id IS NULL/i.test(sql) || x.deposit_id == null)
          && (!/status IN \('available','reserved'\)/i.test(sql) || ['available', 'reserved'].includes(x.status)));
        if (!u) return [{ affectedRows: 0 }];
        u.deposit_id = depositId; u.location_id = locationId; return [{ affectedRows: 1 }];
      }
      if (/INSERT INTO `?unit_events`?/i.test(sql)) { state.events.push(params); return [{ affectedRows: 1 }]; }
      if (/FROM units u\s+JOIN products p[\s\S]*deposit_id IS NULL/i.test(sql)) {
        return [state.units.filter(u => ['available', 'reserved'].includes(u.status) && u.deposit_id == null)
          .map(u => ({ id: u.id, product_id: u.product_id }))];
      }
      if (/product_stock_locations/i.test(sql)) {               // stockMismatches
        const byProduct = {};
        for (const u of state.units) if (['available', 'reserved'].includes(u.status)) byProduct[u.product_id] = (byProduct[u.product_id] || 0) + 1;
        return [Object.entries(byProduct).filter(([pid, n]) => (balances[pid] ?? n) !== n)
          .map(([pid, n]) => ({ product_id: pid, sku: products[pid].sku, name: products[pid].name, units: n, balance: balances[pid] }))];
      }
      throw new Error(`consulta não esperada: ${sql.slice(0, 80)}`);
    },
  };
  return db;
}
const actor = { userId: 'op-1', name: 'Operador Teste' };
const products = { pA: { sku: 'A', name: 'Produto A' }, pB: { sku: 'B', name: 'Produto B' } };
const unit = (id, product_id, extra = {}) => ({ id, product_id, imei_1: `IMEI-${id}`, imei_2: null, imei: null, serial: `S-${id}`, status: 'available', deposit_id: INC.depositId, location_id: INC.locationId, ...extra });
const syncSpy = () => { const calls = []; const fn = async (pid, db, opts) => { calls.push({ pid, inTx: opts?.stockLocationInTransaction === true }); }; fn.calls = calls; return fn; };

test('withIncomingDefault mantém o local informado e completa o vazio', () => {
  assert.deepEqual(withIncomingDefault({ deposit_id: null, location_id: null }, INC), { deposit_id: INC.depositId, location_id: INC.locationId });
  assert.deepEqual(withIncomingDefault({}, INC), { deposit_id: INC.depositId, location_id: INC.locationId });
  assert.deepEqual(withIncomingDefault({ deposit_id: 'X', location_id: 'Y' }, INC), { deposit_id: 'X', location_id: 'Y' });
});

test('isReturnFromSale só para sold → available', () => {
  assert.equal(isReturnFromSale('sold', 'available'), true);
  assert.equal(isReturnFromSale('reserved', 'available'), false);
  assert.equal(isReturnFromSale('available', 'available'), false);
  assert.equal(isReturnFromSale('sold', 'sold'), false);
});

test('transferência por IMEI muda o local, grava evento e recalcula cada produto uma vez', async () => {
  const db = fakeDb({ units: [unit('u1', 'pA'), unit('u2', 'pA'), unit('u3', 'pB')], products });
  const sync = syncSpy();
  const result = await transferUnits({ db, identifiers: ['IMEI-u1', 'S-u2', 'IMEI-u3'], toDepositId: LOJA.depositId, toLocationId: LOJA.locationId, actor, reason: 'vitrine', syncProductStock: sync });
  assert.equal(result.moved.length, 3);
  assert.deepEqual(result.moved[0].from, { depositId: INC.depositId, locationId: INC.locationId });
  assert.deepEqual(result.moved[0].to, { depositId: LOJA.depositId, locationId: LOJA.locationId });
  assert.ok(db.state.units.every(u => u.location_id === LOJA.locationId));
  assert.equal(db.state.events.length, 3);
  assert.ok(db.state.events[0].includes('transfer'));
  assert.ok(db.state.events[0].includes('Operador Teste'));
  assert.ok(db.state.events[0].includes('vitrine'));
  assert.deepEqual(sync.calls.map(c => c.pid).sort(), ['pA', 'pB']);
  assert.ok(sync.calls.every(c => c.inTx));
  assert.equal(db.state.committed, true);
});

test('IMEI vendido, inexistente ou já no destino → recusa sem mudar nada', async () => {
  for (const [ids, code, pattern] of [
    [['IMEI-u1', 'IMEI-u9'], 409, /IMEI-u9[\s\S]*vendido/i],
    [['IMEI-u1', 'NAO-EXISTE'], 404, /NAO-EXISTE/],
  ]) {
    const db = fakeDb({ units: [unit('u1', 'pA'), unit('u9', 'pA', { status: 'sold' }), unit('u5', 'pB', { deposit_id: LOJA.depositId, location_id: LOJA.locationId })], products });
    await assert.rejects(
      transferUnits({ db, identifiers: ids, toDepositId: LOJA.depositId, toLocationId: LOJA.locationId, actor, syncProductStock: syncSpy() }),
      err => err.statusCode === code && pattern.test(err.message),
    );
    assert.equal(db.state.units.find(u => u.id === 'u1').location_id, INC.locationId);
    assert.equal(db.state.events.length, 0);
    assert.equal(db.state.committed, false);
  }
});

test('lista vazia, repetida, >100 ou destino inválido → 400/404', async () => {
  const db = fakeDb({ units: [unit('u1', 'pA')], products });
  const base = { db, toDepositId: LOJA.depositId, toLocationId: LOJA.locationId, actor, syncProductStock: syncSpy() };
  await assert.rejects(transferUnits({ ...base, identifiers: [] }), e => e.statusCode === 400);
  await assert.rejects(transferUnits({ ...base, identifiers: Array.from({ length: 101 }, (_, i) => `x${i}`) }), e => e.statusCode === 400);
  await assert.rejects(transferUnits({ ...base, toLocationId: 'nao-existe', identifiers: ['IMEI-u1'] }), e => e.statusCode === 404 && /Local de destino/.test(e.message));
  const r = await transferUnits({ ...base, identifiers: ['IMEI-u1', ' IMEI-u1 '] });
  assert.equal(r.moved.length, 1);
});

test('backfill move só aparelhos de produto com saldo batendo e lista o resto', async () => {
  const db = fakeDb({
    units: [unit('a1', 'pA', { deposit_id: null, location_id: null }), unit('a2', 'pA', { deposit_id: null, location_id: null }), unit('b1', 'pB', { deposit_id: null, location_id: null })],
    products, balances: { pB: 4 },
  });
  const sync = syncSpy();
  const result = await backfillUnitLocations({ db, incoming: INC, apply: true, actor, syncProductStock: sync });
  assert.deepEqual(result.moved.map(m => m.unitId).sort(), ['a1', 'a2']);
  assert.deepEqual(result.skipped, [{ productId: 'pB', sku: 'B', name: 'Produto B', units: 1, balance: 4 }]);
  assert.equal(db.state.units.find(u => u.id === 'b1').deposit_id, null);
  assert.equal(db.state.events.length, 2);
  assert.ok(db.state.events[0].includes('location_set'));
  assert.deepEqual(sync.calls.map(c => c.pid), ['pA']);
});

test('backfill dryRun não grava; segunda execução não move nada', async () => {
  const db = fakeDb({ units: [unit('a1', 'pA', { deposit_id: null, location_id: null })], products });
  const dry = await backfillUnitLocations({ db, incoming: INC, apply: false, actor, syncProductStock: syncSpy() });
  assert.equal(dry.moved.length, 1);
  assert.equal(db.state.units[0].deposit_id, null);
  assert.equal(db.state.events.length, 0);
  await backfillUnitLocations({ db, incoming: INC, apply: true, actor, syncProductStock: syncSpy() });
  const again = await backfillUnitLocations({ db, incoming: INC, apply: true, actor, syncProductStock: syncSpy() });
  assert.equal(again.moved.length, 0);
  assert.equal(db.state.events.length, 1);
});

test('stockMismatches devolve produtos com saldo ≠ aparelhos', async () => {
  const db = fakeDb({ units: [unit('a1', 'pA'), unit('b1', 'pB')], products, balances: { pB: 21 } });
  assert.deepEqual(await stockMismatches(db), [{ productId: 'pB', sku: 'B', name: 'Produto B', units: 1, balance: 21 }]);
});

test('migração cria unit_events e triggers que barram UPDATE/DELETE', () => {
  assert.equal(UNIT_EVENTS_TABLE, 'unit_events');
  const sql = unitEventsMigration().map(s => s.sql).join('\n');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS `unit_events`/);
  assert.match(sql, /CREATE TRIGGER `mdv_unit_events_no_update` BEFORE UPDATE ON `unit_events`[\s\S]*SIGNAL SQLSTATE '45000'/);
  assert.match(sql, /CREATE TRIGGER `mdv_unit_events_no_delete` BEFORE DELETE ON `unit_events`[\s\S]*SIGNAL SQLSTATE '45000'/);
  assert.match(sql, /INDEX `idx_unit_events_unit` \(`unit_id`, `occurred_at`\)/);
});

test('trava só os aparelhos escolhidos, por id e em ordem', async () => {
  const db = fakeDb({ units: [unit('u2', 'pA'), unit('u1', 'pA')], products });
  await transferUnits({ db, identifiers: ['IMEI-u2', 'IMEI-u1'], toDepositId: LOJA.depositId, toLocationId: LOJA.locationId, actor, syncProductStock: syncSpy() });
  const locking = db.state.queries.filter(q => /FOR UPDATE/i.test(q));
  assert.equal(locking.length, 1);
  assert.match(locking[0], /WHERE id IN \(\?\) ORDER BY id FOR UPDATE/);
  assert.doesNotMatch(locking[0], /imei/i);
  const lookupAt = db.state.queries.findIndex(q => /^\s*SELECT id FROM units WHERE/i.test(q));
  assert.ok(lookupAt >= 0 && lookupAt < db.state.queries.indexOf(locking[0]));
});

test('deadlock ou espera de trava vira 409 "tente de novo" sem mudança', async () => {
  const db = fakeDb({ units: [unit('u1', 'pA')], products });
  db.state.failOn = /^\s*UPDATE units SET deposit_id/i;
  await assert.rejects(
    transferUnits({ db, identifiers: ['IMEI-u1'], toDepositId: LOJA.depositId, toLocationId: LOJA.locationId, actor, syncProductStock: syncSpy() }),
    e => e.statusCode === 409 && /tente de novo/i.test(e.message));
  assert.equal(db.state.rolledBack, true);
  assert.equal(db.state.units[0].location_id, INC.locationId);
});

test('aparelho que já está no destino é pulado e avisado; os outros vão', async () => {
  const db = fakeDb({ units: [unit('u1', 'pA'), unit('u5', 'pB', { deposit_id: LOJA.depositId, location_id: LOJA.locationId })], products });
  const result = await transferUnits({ db, identifiers: ['IMEI-u1', 'IMEI-u5'], toDepositId: LOJA.depositId, toLocationId: LOJA.locationId, actor, syncProductStock: syncSpy() });
  assert.deepEqual(result.moved.map(m => m.unitId), ['u1']);
  assert.deepEqual(result.skipped, [{ identifier: 'IMEI-u5', unitId: 'u5', reason: 'já está nesse local' }]);
  assert.equal(db.state.events.length, 1);
  assert.equal(db.state.committed, true);
});

test('destino inativo ou de outra empresa → 404 sem mudar nada', async () => {
  const locations = [
    { id: INC.locationId, deposit_id: INC.depositId, name: 'Entrada', company_id: 'co', active: true },
    { id: 'loc-off', deposit_id: LOJA.depositId, name: 'Desativado', company_id: 'co', active: false },
    { id: 'loc-outra', deposit_id: LOJA.depositId, name: 'Outra empresa', company_id: 'co-2', active: true },
  ];
  for (const toLocationId of ['loc-off', 'loc-outra']) {
    const db = fakeDb({ units: [unit('u1', 'pA')], products, locations });
    await assert.rejects(transferUnits({ db, identifiers: ['IMEI-u1'], toDepositId: LOJA.depositId, toLocationId, companyId: 'co', actor, syncProductStock: syncSpy() }),
      e => e.statusCode === 404 && /Local de destino/.test(e.message));
    assert.equal(db.state.units[0].location_id, INC.locationId);
  }
});

test('backfill não põe local em aparelho que foi vendido no meio do caminho', async () => {
  const db = fakeDb({ units: [unit('u1', 'pA', { deposit_id: null, location_id: null })], products });
  const realQuery = db.query.bind(db);
  db.query = async (sql, params) => {
    if (/^\s*UPDATE units SET deposit_id/i.test(sql)) db.state.units[0].status = 'sold';
    return realQuery(sql, params);
  };
  const result = await backfillUnitLocations({ db, incoming: INC, apply: true, actor, syncProductStock: syncSpy() });
  assert.equal(result.moved.length, 0);
  assert.equal(db.state.units[0].deposit_id, null);
});

test('local pela metade (só depósito ou só local) → 400', () => {
  assert.throws(() => withIncomingDefault({ deposit_id: 'd' }, INC), e => e.statusCode === 400 && /depósito e o local/i.test(e.message));
  assert.throws(() => withIncomingDefault({ location_id: 'l' }, INC), e => e.statusCode === 400);
  assert.deepEqual(withIncomingDefault({}, INC), { deposit_id: INC.depositId, location_id: INC.locationId });
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createBlingFiscalAutomation, syncPeriods } = require('../services/blingFiscalAutomation.cjs');
const { collectBlingFiscalDocuments } = require('../services/blingFiscalImportCore.cjs');
const { saveBlingFiscalDocuments } = require('../services/blingFiscalPersistence.cjs');

function setup({ connected = true, acquired = 1, known = [], fetchDocuments = async () => [] } = {}) {
  const queries = [], saves = [], logs = [];
  const db = { query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('GET_LOCK')) return [[{ acquired }]];
    if (sql.includes('FROM company_settings')) return [[{ id: 'company', bling_access_token: connected ? 'private-test-token' : null }]];
    if (sql.includes('FROM company_fiscal_profiles')) return [[{ id: 'profile', cnpj: '11222333000181' }]];
    if (sql.includes('FROM company_fiscal_documents')) return [known];
    return [[]];
  }, release: () => queries.push({ sql: 'release' }) };
  const automation = createBlingFiscalAutomation({ pool: { getConnection: async () => db }, fetchDocuments,
    saveDocuments: async (_pool, args) => { saves.push(args); return { imported: args.documents.length }; },
    env: { MDV_COMPANY_FISCAL_ENABLED: '1' }, now: () => new Date('2026-10-04T12:00:00Z'),
    logger: { info: (...args) => logs.push(args), error: (...args) => logs.push(args) } });
  return { automation, queries, saves, logs };
}

test('rolling recovery uses São Paulo date and processes current month first across year boundary', () => {
  const periods = syncPeriods(new Date('2027-01-01T01:00:00Z'));
  assert.deepEqual(periods[0], { from: '2026-12-01', to: '2026-12-31' });
  for (let i = 1; i < periods.length; i++) {
    const next = new Date(`${periods[i].to}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    assert.equal(next.toISOString().slice(0, 10), periods[i - 1].from);
  }
});
test('reconnection recovers missing notes, skips archived unchanged notes and observes cancellation changes', async () => {
  const calls = [];
  const { automation, saves, queries } = setup({ known: [{ model: '55', source_reference: '1', status: 'authorized', has_xml: 1 }],
    fetchDocuments: async (req, options) => { calls.push(options);
      assert.deepEqual(req.headers, {});
      assert.equal(options.skipDocument('nfe', { id: 1, situacao: 5 }), true);
      assert.equal(options.skipDocument('nfe', { id: 1, situacao: 2 }), false);
      assert.equal(options.skipDocument('nfce', { id: 1, situacao: 5 }), false);
      return calls.length === 1 ? [{ status: 'authorized' }, { status: 'cancelled' }] : [];
    } });
  await automation.tick();
  assert.equal(automation.getStatus().state, 'ok'); assert.equal(automation.getStatus().imported, 2);
  assert.equal(calls[0].to, '2026-10-04'); assert.equal(calls[0].includeXml, true);
  assert.equal(saves[0].automatic, true); assert.equal(saves[0].profile.id, 'profile');
  assert.ok(queries.some(q => q.sql.includes('RELEASE_LOCK')));
});
test('disconnected credentials and competing worker never import', async () => {
  for (const options of [{ connected: false }, { acquired: 0 }]) {
    const { automation, saves } = setup({ ...options, fetchDocuments: () => { throw Error('must not call'); } });
    await automation.tick(); assert.equal(saves.length, 0); assert.equal(automation.getStatus().running, false);
    assert.equal(automation.getStatus().state, options.connected === false ? 'disconnected' : 'busy');
  }
});
test('temporary integration can be disabled without a database change', async () => {
  let called = false;
  const automation = createBlingFiscalAutomation({ pool: { getConnection: () => { called = true; } }, env: { MDV_COMPANY_FISCAL_ENABLED: '1', MDV_BLING_FISCAL_SYNC_ENABLED: '0' } });
  await automation.tick(); assert.equal(called, false); assert.equal(automation.getStatus().state, 'disabled');
});
test('API failure preserves last successful sync, releases lock and does not leak error content', async () => {
  let failing = false;
  const { automation, queries, logs } = setup({ fetchDocuments: async () => { if (failing) throw Error('Bearer secret customer CPF'); return []; } });
  await automation.tick(); const success = automation.getStatus().lastSuccessAt; failing = true;
  await automation.tick(); assert.equal(automation.getStatus().state, 'error'); assert.equal(automation.getStatus().lastSuccessAt, success);
  assert.equal(automation.getStatus().running, false); assert.ok(queries.filter(q => q.sql.includes('RELEASE_LOCK')).length === 2);
  assert.ok(!JSON.stringify(logs).includes('secret'));
});
test('overlapping in-process ticks share one import run', async () => {
  let resolve; const wait = new Promise(r => { resolve = r; }); let calls = 0;
  const { automation } = setup({ fetchDocuments: async () => { calls++; await wait; return []; } });
  const first = automation.tick(); await new Promise(r => setImmediate(r)); await automation.tick();
  assert.equal(calls, 1); resolve(); await first; assert.equal(automation.getStatus().state, 'ok');
});
test('skipped archived documents retain pagination and cancellation discovery', async () => {
  let details = 0;
  const notes = await collectBlingFiscalDocuments({
    listPage: async (type, status, page) => type === 'nfe' && status === 5 && page === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: i + 1, situacao: 5 })) : type === 'nfe' && status === 2 ? [{ id: 200, situacao: 2 }] : [],
    skipDocument: (_type, item) => item.situacao === 5,
    getDetail: async (_type, id) => { details++; return { id, situacao: 2, tipo: 1, dataEmissao: '2026-10-01', valorNota: 50 }; }, maxDocuments: 1,
  });
  assert.equal(details, 1); assert.equal(notes[0].status, 'cancelled'); assert.equal(notes[0].totalCents, 5000);
});
test('automatic persistence rejects a missing or wrong-company XML before opening transaction', async () => {
  const pool = { getConnection: async () => { throw Error('must not open'); } };
  await assert.rejects(saveBlingFiscalDocuments(pool, { profile: { cnpj: '11222333000181' }, documents: [{}], automatic: true }), /XML original obrigatório/);
  const xml = fs.readFileSync(require('node:path').join(__dirname, 'fixtures/accountant-nfce.xml'), 'utf8');
  const document = { authorizedXml: xml, accessKey: '26260911222333000181650010000000011123456784', model: '65', documentNumber: '1', series: '1' };
  await assert.rejects(saveBlingFiscalDocuments(pool, { profile: { cnpj: '00000000000000' }, documents: [document], automatic: true }), /empresa selecionadas/);
  await assert.rejects(saveBlingFiscalDocuments(pool, { profile: { cnpj: '11222333000181' }, documents: [{ ...document, totalCents: 999 }], automatic: true }), /diverge do XML/);
});

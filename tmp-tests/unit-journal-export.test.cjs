const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(readFileSync('utils/unitJournalExport.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const moduleResult = { exports: {} };
new Function('module', 'exports', code)(moduleResult, moduleResult.exports);
const { collectJournal, journalText, journalSummary, journalSummaryText, journalPrintHtml } = moduleResult.exports;
const event = (id, overrides = {}) => ({ id, unit_id: 'unit-a', event_type: 'baseline', recorded_at: '2026-10-14T15:00:00Z', db_actor: 'technical', before_data: null, after_data: { unit: { serial: 'serial-a', created_at: '2026-06-17', notes: '<script>alert(1)</script>' } }, ...overrides });

test('exports every page in chronological order without losing bigint IDs', async () => {
    const cursors = [];
    const result = await collectJournal(async cursor => {
        cursors.push(cursor);
        return cursor ? { events: [event('9007199254740993')], next: null } : { events: [event('9007199254740994')], next: '9007199254740994' };
    });
    assert.deepEqual(cursors, [undefined, '9007199254740994']);
    assert.deepEqual(result.map(row => row.id), ['9007199254740993', '9007199254740994']);
});
test('failed or looping pagination cannot produce a partial export', async () => {
    await assert.rejects(collectJournal(async () => ({ events: [event('2')], next: '2' })), /Paginação inconsistente/);
    await assert.rejects(collectJournal(async cursor => { if (cursor) throw new Error('offline'); return { events: [event('2')], next: '2' }; }), /offline/);
});
test('preserves full before/after values and explains baseline date; print content is escaped', () => {
    const text = journalText('Produto <unsafe>', [event('1', { before_data: { unit: { status: 'available' } } })], { baseline: 'Registro inicial', unit: 'Aparelho' });
    assert.match(text, /2026-06-17/);
    assert.match(text, /12:00:00/);
    assert.match(text, /não representa um novo cadastro/);
    assert.match(text, /Dados anteriores/);
    assert.match(text, /serial-a/);
    const html = journalPrintHtml('Produto <unsafe>', text);
    assert.doesNotMatch(html, /<script>|<unsafe>/);
    assert.match(html, /&lt;script&gt;/);
});
test('statement distinguishes baseline from original registration and masks device identifiers', () => {
    const row = journalSummary(event('1', { after_data: { unit: { imei_1: 'test-identifier-8463', created_at: '2026-06-17 18:47:00', status: 'available' } } }), { available: 'Disponível' });
    assert.equal(row.device, 'IMEI final 8463');
    assert.equal(row.status, 'Disponível');
    assert.match(row.description, /já cadastrado.*Cadastro original: 17\/06\/2026, 15:47:00/);
    assert.match(row.date, /14\/10\/2026/);
});
test('statement describes real state transitions and keeps location balances contextual', () => {
    const labels = { available: 'Disponível', sold: 'Vendida' };
    const row = journalSummary(event('2', { event_type: 'unit_update', before_data: { unit: { status: 'available' } }, after_data: { unit: { status: 'sold' } } }), labels);
    assert.equal(row.description, 'Situação alterada: Disponível → Vendida');
    const balance = journalSummary(event('3', { event_type: 'product_stock_locations_update', before_data: { unit: { status: 'available' }, product_stock_locations: { quantity: 1 } }, after_data: { unit: { status: 'available' }, product_stock_locations: { quantity: 2 } } }), labels);
    assert.match(balance.description, /Saldo do local: 1 → 2 \(contexto do produto\)/);
    assert.equal(balance.status, 'Disponível');
    const deleted = journalSummary(event('4', { event_type: 'unit_delete', after_data: null, before_data: { unit: { status: 'available' } } }), labels);
    assert.equal(deleted.status, 'Cadastro removido');
});
test('simple exports include all entries without technical snapshots; full export starts with same statement', () => {
    const rows = [event('1'), event('2', { event_type: 'unit_update' })];
    const simple = journalSummaryText('Produto', rows, {});
    assert.match(simple, /EXTRATO RESUMIDO/);
    assert.match(simple, /2 registros/);
    assert.doesNotMatch(simple, /Conta técnica|Dados completos|<script>/);
    assert.ok(journalText('Produto', rows, {}).startsWith(simple));
});

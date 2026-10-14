const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const ts = require('typescript');
const code = ts.transpileModule(readFileSync('utils/unitJournalExport.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const moduleResult = { exports: {} };
new Function('module', 'exports', code)(moduleResult, moduleResult.exports);
const { collectJournal, journalText, journalPrintHtml } = moduleResult.exports;
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

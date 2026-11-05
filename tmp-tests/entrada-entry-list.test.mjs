import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, createLine, addLines, updateLine, removeLine, toItems, applyPreview,
  canConfirm, lineStatus, hasIdentity, saveDraft, loadDraft,
} from '../components/entrada/entryList.js';

const mk = (imei1, extra = {}) => createLine({
  name: 'Redmi 15', color: 'Verde',
  configuration: { ram: '8', storage: '256' },
  identity: { imei1, imei2: extra.imei2 || null, serial: extra.serial || null },
  quantity: 1, ...extra.fields,
}, { source: 'manual' });
const plan = (over = {}) => ({ line: 1, family: 'existing', variation: 'existing', price_source: 'group', errors: [], ...over });
const okResult = (n) => ({ ok: true, hash: 'h1', plan: Array.from({ length: n }, (_, i) => plan({ line: i + 1 })) });

test('addLines + toItems preserva a ordem e gera chaves únicas', () => {
  const a = mk('111111111111111'), b = mk('222222222222222'), c = mk('333333333333333');
  const s = addLines(emptyState(), [a, b, c]);
  assert.deepEqual(toItems(s).map(i => i.identity.imei1), ['111111111111111', '222222222222222', '333333333333333']);
  assert.equal(new Set([a.key, b.key, c.key]).size, 3);
  assert.equal(a.source, 'manual');
  assert.match(a.label, /Redmi 15 · 8\/256 · Verde · IMEI …1111/);
});

test('canConfirm: falso sem prévia, verdadeiro após prévia ok, falso após editar/remover', () => {
  const a = mk('111111111111111'), b = mk('222222222222222');
  let s = addLines(emptyState(), [a, b]);
  assert.equal(canConfirm(s), false);
  s = applyPreview(s, okResult(2));
  assert.equal(canConfirm(s), true);
  const edited = updateLine(s, a.key, { ...a.item, quantity: 2 });
  assert.equal(canConfirm(edited), false);
  assert.equal(canConfirm(removeLine(s, b.key)), false);
});

test('applyPreview ok:false bloqueia e lineStatus mostra erros da linha certa', () => {
  const a = mk('111111111111111'), b = mk('222222222222222');
  let s = addLines(emptyState(), [a, b]);
  s = applyPreview(s, { ok: false, hash: 'h', plan: [plan({ line: 1 }), plan({ line: 2, errors: ['IMEI duplicado'] })] });
  assert.equal(canConfirm(s), false);
  assert.deepEqual(lineStatus(s, b.key).errors, ['IMEI duplicado']);
  assert.equal(lineStatus(s, b.key).state, 'error');
  assert.equal(lineStatus(s, a.key).state, 'ok');
  assert.deepEqual(lineStatus(s, a.key).errors, []);
});

test('lineStatus pendente sem prévia ou com lista alterada', () => {
  const a = mk('111111111111111');
  let s = addLines(emptyState(), [a]);
  assert.equal(lineStatus(s, a.key).state, 'pending');
  s = applyPreview(s, okResult(1));
  s = updateLine(s, a.key, { ...a.item, quantity: 3 });
  assert.equal(lineStatus(s, a.key).state, 'pending');
});

test('selos', () => {
  const a = mk('1'), b = mk('2'), c = mk('3'), d = mk('4');
  let s = addLines(emptyState(), [a, b, c, d]);
  s = applyPreview(s, { ok: true, hash: 'h', plan: [
    plan({ line: 1, family: 'new', variation: 'new' }),
    plan({ line: 2, family: 'existing', variation: 'new' }),
    plan({ line: 3, family: 'existing', variation: 'existing' }),
    plan({ line: 4, price_source: 'group-new' }),
  ] });
  assert.deepEqual(lineStatus(s, a.key).badges, ['família nova']);
  assert.deepEqual(lineStatus(s, b.key).badges, ['cor nova']);
  assert.deepEqual(lineStatus(s, c.key).badges, ['já existe']);
  assert.deepEqual(lineStatus(s, d.key).badges, ['já existe', 'preço da configuração novo']);
});

test('hasIdentity por imei1, imei2 e serial (sem diferenciar maiúscula)', () => {
  const s = addLines(emptyState(), [mk('111111111111111', { imei2: '222222222222222' }), mk('333333333333333', { serial: 'AbC123' })]);
  assert.equal(hasIdentity(s, '111111111111111'), true);
  assert.equal(hasIdentity(s, '222222222222222'), true);
  assert.equal(hasIdentity(s, 'abc123'), true);
  assert.equal(hasIdentity(s, 'ABC123'), true);
  assert.equal(hasIdentity(s, '999'), false);
  assert.equal(hasIdentity(s, ''), false);
});

test('rascunho: storage que lança, JSON inválido e null devolvem estado vazio', () => {
  assert.deepEqual(loadDraft({ getItem() { throw new Error('x'); } }), emptyState());
  assert.deepEqual(loadDraft({ getItem: () => '{x' }), emptyState());
  assert.deepEqual(loadDraft({ getItem: () => null }), emptyState());
  assert.deepEqual(loadDraft(null), emptyState());
  assert.deepEqual(loadDraft({ getItem: () => '{"lines":"zzz"}' }), emptyState());
});

test('saveDraft + loadDraft devolve linhas sem plano; saveDraft não lança', () => {
  const store = {};
  const storage = { setItem: (k, v) => { store[k] = v; }, getItem: k => store[k] ?? null };
  let s = addLines(emptyState(), [mk('111111111111111'), mk('222222222222222')]);
  s = applyPreview(s, okResult(2));
  saveDraft(s, storage);
  assert.ok(store['mdv-entrada-rascunho-v1']);
  const back = loadDraft(storage);
  assert.deepEqual(back.lines, s.lines);
  assert.equal(back.plan, null);
  assert.equal(back.hash, null);
  assert.equal(canConfirm(back), false);
  assert.doesNotThrow(() => saveDraft(s, { setItem() { throw new Error('cheio'); } }));
});

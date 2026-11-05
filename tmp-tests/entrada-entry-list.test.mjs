import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, createLine, createShortcutLine, addLines, updateLine, removeLine, toItems, applyPreview,
  canConfirm, lineStatus, hasIdentity, hasPhotoIntake, createPhotoLine, saveDraft, loadDraft,
  errorText, commitErrorKind,
} from '../components/entrada/entryList.js';

// O estado vazio traz um clientBatchId novo a cada chamada: compara o resto.
const noId = ({ clientBatchId, ...rest }) => rest;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  assert.deepEqual(noId(loadDraft({ getItem() { throw new Error('x'); } })), noId(emptyState()));
  assert.deepEqual(noId(loadDraft({ getItem: () => '{x' })), noId(emptyState()));
  assert.deepEqual(noId(loadDraft({ getItem: () => null })), noId(emptyState()));
  assert.deepEqual(noId(loadDraft(null)), noId(emptyState()));
  assert.deepEqual(noId(loadDraft({ getItem: () => '{"lines":"zzz"}' })), noId(emptyState()));
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

test('I1: emptyState traz clientBatchId uuid novo; rascunho guarda e devolve o mesmo', () => {
  const a = emptyState(), b = emptyState();
  assert.match(a.clientBatchId, UUID);
  assert.notEqual(a.clientBatchId, b.clientBatchId);
  const store = {};
  const storage = { setItem: (k, v) => { store[k] = v; }, getItem: k => store[k] ?? null };
  const s = addLines(a, [mk('111111111111111')]);
  assert.equal(s.clientBatchId, a.clientBatchId, 'mudar a lista não troca a chave');
  assert.equal(removeLine(s, s.lines[0].key).clientBatchId, a.clientBatchId);
  saveDraft(s, storage);
  assert.equal(loadDraft(storage).clientBatchId, a.clientBatchId);
  assert.match(loadDraft({ getItem: () => '{"lines":[],"clientBatchId":"x y"}' }).clientBatchId, UUID, 'chave inválida no rascunho é trocada');
  assert.match(loadDraft({ getItem: () => '{"lines":[]}' }).clientBatchId, UUID, 'rascunho antigo ganha chave');
});

test('I1: commitErrorKind separa 409/422/400 (sem gravação) do resto (ambíguo)', () => {
  const e = m => new Error(m);
  assert.equal(commitErrorKind(e('[VPS] 409 https://x/catalog-entries — {"error":"O lote mudou"}')), 'conflict');
  assert.equal(commitErrorKind(e('[VPS] 409 https://x/catalog-entries — {"error":"Este envio já foi gravado com outra lista.","code":"client_batch_conflict"}')), 'client-batch-conflict');
  assert.equal(commitErrorKind(e('[VPS] 422 https://x — {"plan":[]}')), 'invalid');
  assert.equal(commitErrorKind(e('[VPS] 400 https://x — {"error":"client_batch_id inválido."}')), 'rejected');
  for (const m of ['[VPS] 500 https://x — {"error":"Erro ao processar a entrada."}', '[VPS] 502 https://x', 'Failed to fetch', 'The operation was aborted due to timeout', '']) {
    assert.equal(commitErrorKind(e(m)), 'ambiguous', m);
  }
  assert.equal(commitErrorKind('boom'), 'ambiguous');
});

test('M4: errorText mostra só o campo error do JSON do servidor', () => {
  const e = m => new Error(m);
  assert.equal(errorText(e('[VPS] 400 https://api.x/catalog-entries — {"error":"Envie a lista de itens."}')), 'Envie a lista de itens.');
  assert.equal(errorText(e('[VPS] 409 https://api.x — {"error":"Aspas \\"aqui\\"","code":"c"}')), 'Aspas "aqui"');
  // corpo truncado pelo vpsClient (240 caracteres) ainda acha o error
  assert.equal(errorText(e('[VPS] 500 https://api.x — {"error":"Falhou geral","detail":"aaaaaaaa...')), 'Falhou geral');
  assert.equal(errorText(e('[VPS] 502 https://api.x — <html>Bad gateway</html>')), '[VPS] 502 https://api.x — <html>Bad gateway</html>');
  assert.equal(errorText(e('Failed to fetch')), 'Failed to fetch');
  assert.equal(errorText('x'), 'erro desconhecido');
});

test('createPhotoLine: item só com origem, pré-cadastro e local; rótulo com marca, modelo, memória, cor e final do IMEI', () => {
  const line = createPhotoLine({ id: 'pi1', detected_brand: 'Xiaomi', detected_model: 'Redmi 15', detected_ram: '8GB', detected_storage: '256GB', detected_color: 'Verde', detected_imei_1: '863715061138763', price_retail: 1 }, 'l1');
  assert.equal(line.source, 'foto');
  assert.deepEqual(line.item, { source: 'foto', photo_intake_id: 'pi1', location_id: 'l1' });
  assert.equal(createPhotoLine({ id: 'pi1' }).item.location_id, null);
  assert.equal(line.label, 'Xiaomi · Redmi 15 · 8GB/256GB · Verde · IMEI …8763');
  assert.equal(createPhotoLine({ id: 'pi2', detected_model: 'X', detected_serial: 'SN12345' }).label, 'X · Serial …2345');
  assert.equal(createPhotoLine({ id: 'pi3' }).label, 'Aparelho da fila de foto');
});

test('hasPhotoIntake acha o pré-cadastro na lista; updateLine mantém o rótulo da linha de foto', () => {
  const line = createPhotoLine({ id: 'pi1', detected_model: 'Redmi 15' });
  let s = addLines(emptyState(), [mk('111111111111111'), line]);
  assert.equal(hasPhotoIntake(s, 'pi1'), true);
  assert.equal(hasPhotoIntake(s, 'pi2'), false);
  assert.equal(hasPhotoIntake(s, ''), false);
  s = updateLine(s, line.key, { ...line.item, location_id: 'l1' });
  assert.equal(s.lines[1].label, 'Redmi 15');
});

test('createShortcutLine: item atalho com product_id; rótulo nome · SKU · identidade; updateLine mantém o rótulo', () => {
  const v = { id: 'p1', name: 'Redmi 15', sku: 'RED15' };
  const phone = createShortcutLine(v, { identity: { imei1: '863715061138763', imei2: null, serial: null }, quantity: 1 });
  assert.equal(phone.source, 'atalho');
  assert.equal(phone.item.source, 'atalho');
  assert.equal(phone.item.product_id, 'p1');
  assert.equal(phone.label, 'Redmi 15 · RED15 · IMEI …8763');
  assert.equal(createShortcutLine(v, { quantity: 5 }).label, 'Redmi 15 · RED15 · 5 un.');
  assert.equal(createShortcutLine({ id: 'p2', name: 'Capa' }, { quantity: 1 }).label, 'Capa');
  let s = addLines(emptyState(), [phone]);
  s = updateLine(s, phone.key, { ...phone.item, cost_cents: 10 });
  assert.equal(s.lines[0].label, 'Redmi 15 · RED15 · IMEI …8763');
});

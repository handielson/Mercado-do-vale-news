// bot-error-library-v1: biblioteca de erros do robô (erro + correção), usada pelos agentes do servidor de casa.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createBotErrorLibrary, chaveDe, pontuar } = require('../services/botErrorLibrary.cjs');

function poolFalso(existente) {
  const sqls = [];
  return { sqls, pool: { async query(sql, params = []) {
    const q = sql.replace(/\s+/g, ' ').trim();
    sqls.push([q, params]);
    if (q.startsWith('CREATE TABLE')) return [{}];
    if (q.startsWith('SELECT id, status, ocorrencias')) return [existente ? [existente] : []];
    if (q.startsWith('INSERT')) return [{ insertId: 9 }];
    if (q.startsWith('UPDATE')) return [{ affectedRows: 1 }];
    return [[]];
  } } };
}

test('chave: mesmo erro com números diferentes é o mesmo erro', () => {
  assert.equal(chaveDe({ origem: 'n8n', onde: 'Nó X', titulo: 'Timeout 30000 ms' }), chaveDe({ origem: 'n8n', onde: 'nó x', titulo: 'timeout 45000 ms' }));
  assert.notEqual(chaveDe({ titulo: 'a', onde: 'x' }), chaveDe({ titulo: 'a', onde: 'y' }));
  assert.equal(chaveDe({ chave: 'k' }).length, 40);
});

test('registrar: erro novo entra aberto; do histórico entra corrigido', async () => {
  const { pool, sqls } = poolFalso(null);
  const lib = createBotErrorLibrary({ pool, now: () => new Date('2026-11-21T20:00:00Z') });
  assert.deepEqual(await lib.registrar({ titulo: 'Robô negou estoque', onde: 'n8n · disponibilidade', origem: 'qualidade' }), { id: 9, novo: true, voltou: false, status: 'aberto' });
  const ins = sqls.find(([q]) => q.startsWith('INSERT'));
  assert.equal(ins[1][8], 'aberto');
  const h = await lib.registrar({ titulo: 'PayJoy mensal', correcao: 'quinzenal', origem: 'historico' });
  assert.equal(h.status, 'corrigido');
  await assert.rejects(lib.registrar({ titulo: '' }), /Título obrigatório/);
});

test('registrar de novo: soma ocorrência e, se estava corrigido, vira "voltou"; histórico não soma', async () => {
  const { pool, sqls } = poolFalso({ id: 4, status: 'corrigido', ocorrencias: 2 });
  const lib = createBotErrorLibrary({ pool });
  const r = await lib.registrar({ titulo: 'Robô negou estoque', onde: 'n8n', origem: 'qualidade', exemplo: { cliente: 'x' } });
  assert.deepEqual(r, { id: 4, novo: false, voltou: true, status: 'voltou' });
  const up = sqls.find(([q]) => q.startsWith('UPDATE'))[0];
  assert.match(up, /ocorrencias = ocorrencias \+ 1/);
  assert.match(up, /status = 'voltou'/);
  assert.match(up, /COALESCE\(NULLIF\(correcao, ''\), \?\)/, 'não apaga correção já escrita');
  const { pool: p2, sqls: s2 } = poolFalso({ id: 4, status: 'corrigido', ocorrencias: 2 });
  const h = await createBotErrorLibrary({ pool: p2 }).registrar({ titulo: 'Robô negou estoque', onde: 'n8n', origem: 'historico' });
  assert.equal(h.voltou, false);
  assert.ok(!s2.find(([q]) => q.startsWith('UPDATE'))[0].includes('ocorrencias + 1'));
});

test('atualizar: valida situação e marca a data da correção', async () => {
  const { pool, sqls } = poolFalso(null);
  const lib = createBotErrorLibrary({ pool });
  await lib.atualizar(4, { status: 'corrigido', correcao: 'Consultar estoque antes', versao: 'v1.2.882' });
  assert.match(sqls.at(-1)[0], /corrigido_em = CURRENT_TIMESTAMP/);
  await assert.rejects(lib.atualizar(4, { status: 'talvez' }), /inválida/);
  await assert.rejects(lib.atualizar(4, {}), /Nada para mudar/);
});

test('parecidos: acha pelo assunto e pelo lugar, ignora o que não tem a ver', () => {
  const rows = [
    { id: 1, titulo: 'Robô disse que não tinha o produto em estoque', sintoma: 'negou disponibilidade', onde: 'n8n · disponibilidade', causa: 'não consultava estoque', correcao: 'buscar estoque antes', tags: 'estoque' },
    { id: 2, titulo: 'Parcela PayJoy dita mensal', sintoma: 'payjoy mensal', onde: 'n8n · parcelamento', causa: '', correcao: 'quinzenal', tags: 'payjoy' },
    { id: 3, titulo: 'Recibo sem logo', sintoma: 'pdf sem logo', onde: 'PDV', causa: '', correcao: '', tags: '' },
  ];
  const r = pontuar(rows, 'O robô negou que tinha o produto no estoque', 'n8n · disponibilidade');
  assert.equal(r[0].r.id, 1);
  assert.ok(!r.some((x) => x.r.id === 3));
});

test('a API registra as rotas da biblioteca e os erros do n8n entram sozinhos', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'botMonitorApi.cjs'), 'utf8');
  for (const t of ["'/agent/monitor/errors'", "'/agent/monitor/errors/similar'", "'/agent/monitor/errors/:id'", "'/n8n-bot/error-alerts'", 'createBotErrorLibrary']) assert.ok(src.includes(t), t);
  const dep = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'deploy-bot-monitor.cjs'), 'utf8');
  assert.ok(dep.includes("'services/botErrorLibrary.cjs'"));
});

test('exportação: agrupa por área, mostra situação e nunca leva o exemplo (conversa de cliente)', () => {
  const { montar } = require('../scripts/export-bot-error-library.cjs');
  const md = montar([
    { id: 1, titulo: 'Negou estoque', status: 'voltou', ocorrencias: 3, onde: 'n8n · disponibilidade', sintoma: 's', causa: 'c', correcao: 'buscar estoque', ultima_vez: '2026-11-21T20:00:00Z', origem: 'qualidade', exemplo: 'cliente: João 87999' },
    { id: 2, titulo: 'Timeout', status: 'corrigido', ocorrencias: 1, onde: 'API · status', origem: 'historico' },
  ], new Date('2026-11-21T21:00:00Z'));
  assert.match(md, /## n8n \(1\)/);
  assert.match(md, /### #1 Negou estoque/);
  assert.match(md, /🔴 Voltou · 3x/);
  assert.ok(!md.includes('João'), 'sem conversa de cliente');
  assert.match(md, /Total: 2 · 1 voltaram · 0 abertos · 1 corrigidos/);
});

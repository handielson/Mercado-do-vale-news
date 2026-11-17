const test = require('node:test');
const assert = require('node:assert/strict');
const { createBlingNfeLaunchGuard, classifyLaunchResponse } = require('../services/blingNfeLaunchGuard.cjs');

const NOW = new Date('2026-11-17T19:00:00Z'); // 16:00 em São Paulo
const ALREADY_STOCK = { error: { type: 'VALIDATION_ERROR', fields: [{ code: 3, msg: 'Já existe estoque lançado para essa nota fiscal.' }] } };
const ALREADY_ACCOUNTS = { error: { type: 'VALIDATION_ERROR', fields: [{ code: 0, msg: 'Já existem contas lançadas para essa nota fiscal.' }] } };

// Bling falso: notas autorizadas, detalhes, pedidos e o estado de lançamento de cada nota.
function fakeBling({ notes, launched = {} }) {
  const calls = [];
  const state = new Map(Object.entries(launched).map(([id, v]) => [id, { ...v }]));
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
  const fetchImpl = async (url, options = {}) => {
    const u = new URL(url); const method = options.method || 'GET';
    calls.push(`${method} ${u.pathname.replace('/Api/v3', '')}${u.search}`);
    const path = u.pathname.replace('/Api/v3', '');
    if (method === 'GET' && path === '/nfe') {
      const situacao = Number(u.searchParams.get('situacao'));
      return json(200, { data: Number(u.searchParams.get('pagina')) > 1 ? [] : notes.filter(n => n.situacao === situacao).map(({ pedido, ...n }) => n) });
    }
    let m = path.match(/^\/nfe\/(\d+)$/);
    if (method === 'GET' && m) { const n = notes.find(x => String(x.id) === m[1]); return json(200, { data: { id: n.id, numero: n.numero, situacao: n.situacao, numeroPedidoLoja: n.numeroPedidoLoja || '' } }); }
    if (method === 'GET' && path === '/pedidos/vendas') {
      const loja = u.searchParams.get('numerosLojas[]');
      return json(200, { data: notes.filter(n => n.pedido && n.numeroPedidoLoja === loja).map(n => ({ id: n.pedido.id, numero: n.pedido.numero, numeroLoja: loja, situacao: { id: n.pedido.situacao } })) });
    }
    m = path.match(/^\/pedidos\/vendas\/(\d+)$/);
    if (method === 'GET' && m) { const n = notes.find(x => x.pedido && String(x.pedido.id) === m[1]); return json(200, { data: { id: n.pedido.id, numero: n.pedido.numero, situacao: { id: n.pedido.situacao }, notaFiscal: { id: n.pedido.notaFiscalId ?? n.id } } }); }
    m = path.match(/^\/nfe\/(\d+)\/lancar-(estoque|contas)$/);
    if (method === 'POST' && m) {
      const s = state.get(m[1]) || {}; const key = m[2] === 'estoque' ? 'stock' : 'accounts';
      if (s.fail) return json(500, { error: { message: 'instabilidade' } });
      if (s[key]) return json(400, key === 'stock' ? ALREADY_STOCK : ALREADY_ACCOUNTS);
      s[key] = true; state.set(m[1], s); return json(200, { data: {} });
    }
    throw new Error(`rota inesperada ${method} ${path}`);
  };
  return { fetchImpl, calls, state };
}

function fakePool({ acquired = 1, rows = [] } = {}) {
  const table = new Map(rows.map(r => [String(r.nfe_id), { ...r }]));
  const queries = [];
  const db = {
    query: async (sql, params = []) => {
      queries.push(sql);
      if (sql.includes('GET_LOCK')) return [[{ acquired }]];
      if (sql.includes('RELEASE_LOCK') || sql.startsWith('CREATE TABLE')) return [[]];
      if (sql.startsWith('SELECT') && sql.includes('bling_nfe_launch_guard')) return [[...table.values()].filter(r => params[0].map(String).includes(String(r.nfe_id)))];
      if (sql.startsWith('INSERT INTO bling_nfe_launch_guard')) {
        const [nfe_id, numero, numero_loja, pedido_numero, stock_state, accounts_state, skip_reason, last_error] = params;
        const prev = table.get(String(nfe_id));
        table.set(String(nfe_id), { nfe_id, numero, numero_loja, pedido_numero, stock_state, accounts_state, skip_reason, last_error, attempts: (prev?.attempts || 0) + 1 });
        return [{}];
      }
      if (sql.includes('FROM n8n_bot_admin_numbers')) return [[{ phone: '5587999990000' }]];
      throw new Error(`SQL inesperado: ${sql}`);
    },
    release: () => {},
  };
  return { pool: { getConnection: async () => db, query: db.query }, table, queries };
}

function setup({ notes, launched, rows, acquired, env = {} } = {}) {
  const bling = fakeBling({ notes, launched });
  const { pool, table } = fakePool({ rows, acquired });
  const sent = [], logs = [];
  const guard = createBlingNfeLaunchGuard({
    pool, fetchImpl: bling.fetchImpl, getAuthHeader: async () => 'Bearer t', env, now: () => NOW,
    sleep: async () => {}, notify: async text => { sent.push(text); },
    logger: { info: (...a) => logs.push(a), warn: (...a) => logs.push(a), error: (...a) => logs.push(a) },
  });
  return { guard, bling, table, sent, logs };
}

const note = (id, extra = {}) => ({ id, numero: `000${id}`, situacao: 5, dataEmissao: '2026-11-17 14:59:47', numeroPedidoLoja: `L${id}`, pedido: { id: id * 10, numero: 11000 + id, situacao: 9 }, ...extra });

test('caso real 11596: nota autorizada, pedido Atendido, sem estoque/contas → lança os dois e avisa', async () => {
  const { guard, bling, table, sent } = setup({ notes: [note(862)] });
  const result = await guard.tick();
  assert.equal(result.launched, 1);
  assert.ok(bling.calls.includes('POST /nfe/862/lancar-estoque'));
  assert.ok(bling.calls.includes('POST /nfe/862/lancar-contas'));
  assert.deepEqual(bling.state.get('862'), { stock: true, accounts: true });
  const row = table.get('862');
  assert.equal(row.stock_state, 'launched'); assert.equal(row.accounts_state, 'launched');
  assert.equal(sent.length, 1);
  assert.match(sent[0], /000862/); assert.match(sent[0], /11862/);
});

test('nota normal (lançada pela referência do pedido): Bling recusa, nada muda, sem aviso, não volta a consultar', async () => {
  const first = setup({ notes: [note(861)], launched: { 861: { stock: true, accounts: true } } });
  await first.guard.tick();
  assert.equal(first.table.get('861').stock_state, 'already');
  assert.equal(first.table.get('861').accounts_state, 'already');
  assert.equal(first.sent.length, 0);
  const again = setup({ notes: [note(861)], rows: [...first.table.values()] });
  await again.guard.tick();
  assert.deepEqual(again.bling.calls.filter(c => !c.startsWith('GET /nfe?')), []);
});

test('só contas faltando: lança contas e registra estoque como já lançado', async () => {
  const { guard, table, sent } = setup({ notes: [note(5)], launched: { 5: { stock: true } } });
  await guard.tick();
  assert.equal(table.get('5').stock_state, 'already');
  assert.equal(table.get('5').accounts_state, 'launched');
  assert.equal(sent.length, 1);
});

test('pedido ainda não Atendido: não lança e tenta de novo depois', async () => {
  const { guard, bling, table } = setup({ notes: [note(7, { pedido: { id: 70, numero: 11007, situacao: 6 } })] });
  await guard.tick();
  assert.ok(!bling.calls.some(c => c.startsWith('POST')));
  assert.equal(table.get('7').skip_reason, 'pedido_nao_atendido');
  assert.equal(table.get('7').stock_state, null);
});

test('nota sem pedido de loja (remessa, devolução, nota avulsa) nunca é lançada', async () => {
  const { guard, bling, table } = setup({ notes: [note(8, { numeroPedidoLoja: '', pedido: null })] });
  await guard.tick();
  assert.ok(!bling.calls.some(c => c.startsWith('POST')));
  assert.equal(table.get('8').skip_reason, 'sem_pedido_loja');
});

test('pedido da loja com outra nota (ex.: nota refeita) não é lançado por esta', async () => {
  const { guard, bling } = setup({ notes: [note(9, { pedido: { id: 90, numero: 11009, situacao: 9, notaFiscalId: 12345 } })] });
  await guard.tick();
  assert.ok(!bling.calls.some(c => c.startsWith('POST')));
});

test('nota emitida há menos de 1 hora espera o fluxo normal do Bling', async () => {
  const { guard, bling } = setup({ notes: [note(10, { dataEmissao: '2026-11-17 15:30:00' })] });
  await guard.tick();
  assert.ok(!bling.calls.some(c => c.startsWith('GET /nfe/10')));
});

test('erro do Bling fica registrado para nova tentativa, sem aviso de sucesso', async () => {
  const { guard, table, sent } = setup({ notes: [note(11)], launched: { 11: { fail: true } } });
  const result = await guard.tick();
  assert.equal(result.errors, 1);
  assert.equal(table.get('11').stock_state, 'error');
  assert.match(table.get('11').last_error, /500/);
  assert.equal(sent.length, 0);
});

test('trava de segurança: muitas notas para lançar de uma vez → para e avisa, sem lançar as excedentes', async () => {
  const notes = Array.from({ length: 6 }, (_, i) => note(100 + i));
  const { guard, bling, sent } = setup({ notes, env: { MDV_BLING_NFE_LAUNCH_GUARD_MAX_PER_RUN: '3' } });
  const result = await guard.tick();
  assert.equal(result.launched, 3);
  assert.equal(bling.calls.filter(c => c.endsWith('/lancar-estoque')).length, 3);
  assert.ok(sent.some(t => /limite/i.test(t)));
});

test('desligado por env e sem lock não chamam o Bling', async () => {
  const off = setup({ notes: [note(12)], env: { MDV_BLING_NFE_LAUNCH_GUARD: '0' } });
  assert.equal((await off.guard.tick()).state, 'disabled');
  assert.equal(off.bling.calls.length, 0);
  const busy = setup({ notes: [note(12)], acquired: 0 });
  assert.equal((await busy.guard.tick()).state, 'busy');
  assert.equal(busy.bling.calls.length, 0);
});

test('dryRun lista o que faria sem lançar nada', async () => {
  const { guard, bling, table } = setup({ notes: [note(13)] });
  const result = await guard.tick({ dryRun: true });
  assert.deepEqual(result.candidates.map(c => c.numero), ['00013']);
  assert.ok(!bling.calls.some(c => c.startsWith('POST')));
  assert.equal(table.size, 0);
});

test('429 do Bling (limite por segundo) espera e repete sem perder a nota', async () => {
  const bling = fakeBling({ notes: [note(14)] });
  let throttled = 0;
  const fetchImpl = async (url, options) => {
    if (String(url).endsWith('/nfe/14') && throttled < 2) { throttled += 1; return { ok: false, status: 429, json: async () => ({ error: { description: 'O limite de requisições por segundo foi atingido' } }) }; }
    return bling.fetchImpl(url, options);
  };
  const { pool, table } = fakePool();
  const guard = createBlingNfeLaunchGuard({ pool, fetchImpl, getAuthHeader: async () => 'Bearer t', env: {}, now: () => NOW, sleep: async () => {}, notify: async () => {}, logger: {} });
  const result = await guard.tick();
  assert.equal(throttled, 2);
  assert.equal(result.state, 'ok');
  assert.equal(result.launched, 1);
  assert.equal(table.get('14').stock_state, 'launched');
});

test('classifica as respostas reais do Bling', () => {
  assert.equal(classifyLaunchResponse(200, { data: {} }).state, 'launched');
  assert.equal(classifyLaunchResponse(400, ALREADY_STOCK).state, 'already');
  assert.equal(classifyLaunchResponse(400, ALREADY_ACCOUNTS).state, 'already');
  assert.equal(classifyLaunchResponse(400, { error: { fields: [{ msg: 'Depósito inválido' }] } }).state, 'error');
});

test('servidor liga a rede de segurança e os deploys levam o módulo', () => {
  const fs = require('node:fs'); const path = require('node:path');
  const root = path.join(__dirname, '..');
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /require\('\.\/services\/blingNfeLaunchGuard\.cjs'\)\.createBlingNfeLaunchGuard\(/, file);
    assert.match(source, /blingNfeLaunchGuard\.start\(\)/, file);
    assert.match(source, /'\/api\/bling-nfe-launch-guard', \{ preHandler: requireSyncKey \}/, file);
    assert.match(source, /'\/api\/bling-nfe-launch-guard\/run', \{ preHandler: requireSyncKey \}/, file);
  }
  const full = fs.readFileSync(path.join(root, 'deploy-vps-server-only.cjs'), 'utf8');
  assert.match(full, /upload\(path\.join\(__dirname, 'services\/blingNfeLaunchGuard\.cjs'\)/);
  assert.match(full, /--bling-nfe-launch-guard-only/);
  const { FILES } = require('../scripts/deploy-bling-nfe-launch-guard.cjs');
  assert.ok(FILES.some(file => file.local === 'services/blingNfeLaunchGuard.cjs'));
});

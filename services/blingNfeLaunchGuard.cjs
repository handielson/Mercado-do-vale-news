'use strict';

// bling-nfe-launch-guard-v1 (17/11/2026): rede de segurança para NF-e autorizada sem estoque/contas lançados no Bling.
//
// Caso real: pedido 11596 (TikTok, NF 000862). A emissão automática da nota falhou (NCM); o Bling voltou o pedido para
// "Em aberto" e estornou estoque e contas. Depois a nota foi corrigida e autorizada e o pedido voltou para "Atendido",
// mas o Bling não relança nada: o saldo ficou sobrando e a peça poderia ser vendida de novo. Pedidos 11594 e 11568 idem.
//
// A API v3 não informa se a nota já lançou estoque/contas. Mas POST /nfe/{id}/lancar-estoque e /lancar-contas recusam
// com "Já existe estoque lançado para essa nota fiscal." / "Já existem contas lançadas para essa nota fiscal." quando já
// houve lançamento, inclusive quando quem lançou foi o pedido ("pela referência"). Testado em 17/11/2026 nas NFs 000862
// e 000861 com o saldo conferido antes e depois. Então lançar é idempotente: o Bling nunca dá baixa em dobro.
//
// Escopo conservador: só NF-e de saída autorizada, com pedido de loja virtual, cujo pedido aponta para esta nota e está
// "Atendido", e emitida há mais de 1 hora (o fluxo normal do Bling já terminou). Nota avulsa, remessa e devolução ficam de fora.

const BLING_API = 'https://api.bling.com.br/Api/v3';
const AUTHORIZED_SITUATIONS = [5, 6]; // 5 autorizada; 6 emitida DANFE
const ORDER_ATTENDED = 9;
const DONE = new Set(['already', 'launched']);
const FINAL_SKIPS = new Set(['sem_pedido_loja', 'nota_diferente_do_pedido']);
const INTERVAL_MS = 15 * 60 * 1000;

const clean = (value, limit) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
const spDate = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const emittedAt = (text) => { const ms = Date.parse(`${String(text || '').replace(' ', 'T')}-03:00`); return Number.isFinite(ms) ? ms : null; };

function blingMessage(body) {
  const fields = Array.isArray(body?.error?.fields) ? body.error.fields.map(field => field?.msg).filter(Boolean) : [];
  return clean([...fields, body?.error?.description, body?.error?.message, body?.message].filter(Boolean)[0] || '', 300);
}

function classifyLaunchResponse(status, body) {
  if (status >= 200 && status < 300) return { state: 'launched' };
  const message = blingMessage(body);
  if (status === 400 && /j[aá]\s+exist/i.test(message)) return { state: 'already', message };
  return { state: 'error', message: `HTTP ${status}${message ? `: ${message}` : ''}` };
}

const isFinal = (row) => Boolean(row && ((DONE.has(row.stock_state) && DONE.has(row.accounts_state)) || FINAL_SKIPS.has(row.skip_reason)));

function createBlingNfeLaunchGuard({ pool, getAuthHeader, fetchImpl = globalThis.fetch, notify = async () => {}, env = process.env,
  now = () => new Date(), sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), logger = console } = {}) {
  const enabled = () => env.MDV_BLING_NFE_LAUNCH_GUARD !== '0';
  const lookbackDays = Math.min(15, Math.max(1, Number(env.MDV_BLING_NFE_LAUNCH_GUARD_DAYS) || 3));
  const minAgeMs = 60 * 60 * 1000;
  const maxPerRun = Math.max(1, Number(env.MDV_BLING_NFE_LAUNCH_GUARD_MAX_PER_RUN) || 10);
  const status = { running: false, state: 'waiting', lastAttemptAt: null, lastSuccessAt: null, lastResult: null, lastError: null };
  let ready, timer;

  const ensureSchema = () => {
    if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS bling_nfe_launch_guard (
      nfe_id BIGINT UNSIGNED PRIMARY KEY, numero VARCHAR(20) NULL, numero_loja VARCHAR(80) NULL, pedido_numero VARCHAR(20) NULL,
      stock_state VARCHAR(16) NULL, accounts_state VARCHAR(16) NULL, skip_reason VARCHAR(40) NULL, last_error VARCHAR(500) NULL,
      attempts INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch(error => { ready = undefined; throw error; });
    return ready;
  };

  async function tick({ dryRun = false } = {}) {
    if (!enabled()) { status.state = 'disabled'; return { state: 'disabled' }; }
    if (status.running) return { state: 'running' };
    status.running = true; status.lastAttemptAt = now().toISOString();
    let db, locked = false;
    const result = { state: 'ok', dryRun, checked: 0, launched: 0, errors: 0, skipped: 0, candidates: [], launches: [] };
    try {
      await ensureSchema();
      db = await pool.getConnection();
      const [locks] = await db.query("SELECT GET_LOCK('mdv_bling_nfe_launch_guard',0) AS acquired");
      locked = Number(locks[0]?.acquired) === 1;
      if (!locked) { status.state = 'busy'; return { state: 'busy' }; }
      const auth = await getAuthHeader();
      if (!auth) { status.state = 'disconnected'; return { state: 'disconnected' }; }

      const call = async (method, path) => {
        // Limite do Bling: 3 req/s por conta, dividido com os outros jobs (sync fiscal, estoque). 429 não lança nada: espera e repete.
        for (let attempt = 1; ; attempt += 1) {
          await sleep(attempt === 1 ? 400 : 1500 * attempt);
          const response = await fetchImpl(`${BLING_API}${path}`, { method, headers: { Authorization: auth, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
          const body = await response.json().catch(() => null);
          if (response.status === 429 && attempt < 5) continue;
          return { status: response.status, body };
        }
      };
      const read = async (path) => {
        const { status: code, body } = await call('GET', path);
        if (code < 200 || code >= 300) throw new Error(`Bling GET ${path.split('?')[0]} respondeu ${code}${blingMessage(body) ? `: ${blingMessage(body)}` : ''}`);
        return body?.data;
      };

      const end = now();
      const start = new Date(end.getTime() - lookbackDays * 86400000);
      const notes = [];
      for (const situacao of AUTHORIZED_SITUATIONS) {
        for (let page = 1; page <= 20; page += 1) {
          const params = new URLSearchParams({ pagina: String(page), limite: '100', tipo: '1', situacao: String(situacao),
            dataEmissaoInicial: `${spDate(start)} 00:00:00`, dataEmissaoFinal: `${spDate(end)} 23:59:59` });
          const items = await read(`/nfe?${params}`);
          if (!Array.isArray(items)) throw new Error('Listagem de NF-e inválida no Bling');
          notes.push(...items.filter(item => Number(item?.tipo ?? 1) === 1 && Number(item?.situacao) === situacao));
          if (items.length < 100) break;
        }
      }
      const ripe = notes.filter(item => { const at = emittedAt(item.dataEmissao); return at != null && end.getTime() - at >= minAgeMs; });
      const known = new Map();
      if (ripe.length) {
        const [rows] = await db.query('SELECT nfe_id,stock_state,accounts_state,skip_reason,attempts FROM bling_nfe_launch_guard WHERE nfe_id IN (?)', [ripe.map(item => Number(item.id))]);
        for (const row of rows) known.set(String(row.nfe_id), row);
      }
      const save = async (item, fields) => {
        if (dryRun) return;
        await db.query(`INSERT INTO bling_nfe_launch_guard (nfe_id,numero,numero_loja,pedido_numero,stock_state,accounts_state,skip_reason,last_error)
          VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE numero=VALUES(numero),numero_loja=VALUES(numero_loja),pedido_numero=VALUES(pedido_numero),
          stock_state=VALUES(stock_state),accounts_state=VALUES(accounts_state),skip_reason=VALUES(skip_reason),last_error=VALUES(last_error),attempts=attempts+1`,
        [Number(item.id), clean(item.numero, 20) || null, clean(fields.numeroLoja, 80) || null, clean(fields.pedidoNumero, 20) || null,
          fields.stock || null, fields.accounts || null, fields.skip || null, fields.error ? clean(fields.error, 500) : null]);
      };

      for (const item of ripe) {
        const row = known.get(String(item.id));
        if (isFinal(row)) continue;
        result.checked += 1;
        const detail = await read(`/nfe/${encodeURIComponent(item.id)}`);
        const numeroLoja = clean(detail?.numeroPedidoLoja, 80);
        if (!numeroLoja) { result.skipped += 1; await save(item, { skip: 'sem_pedido_loja' }); continue; }
        const orders = (await read(`/pedidos/vendas?${new URLSearchParams({ 'numerosLojas[]': numeroLoja })}`) || [])
          .filter(order => clean(order?.numeroLoja, 80) === numeroLoja);
        if (!orders.length) { result.skipped += 1; await save(item, { numeroLoja, skip: 'pedido_nao_encontrado' }); continue; }
        let order = null;
        for (const candidate of orders) {
          const full = await read(`/pedidos/vendas/${encodeURIComponent(candidate.id)}`);
          if (String(full?.notaFiscal?.id || '') === String(item.id)) { order = full; break; }
        }
        if (!order) { result.skipped += 1; await save(item, { numeroLoja, skip: 'nota_diferente_do_pedido' }); continue; }
        const pedidoNumero = clean(order.numero, 20);
        if (Number(order?.situacao?.id) !== ORDER_ATTENDED) { result.skipped += 1; await save(item, { numeroLoja, pedidoNumero, skip: 'pedido_nao_atendido' }); continue; }

        if (dryRun) { result.candidates.push({ nfeId: item.id, numero: item.numero, pedido: pedidoNumero, numeroLoja }); continue; }
        if (result.launched >= maxPerRun) {
          await notify(`⚠️ Bling: atingi o limite de ${maxPerRun} notas com baixa refeita numa rodada e parei por segurança. Confira as notas autorizadas recentes antes de liberar (NF ${item.numero}, pedido ${pedidoNumero} ficou para depois).`).catch(() => {});
          result.state = 'limit';
          break;
        }

        const stockDone = DONE.has(row?.stock_state);
        const launch = async (what) => { const { status: code, body } = await call('POST', `/nfe/${encodeURIComponent(item.id)}/lancar-${what}`); return classifyLaunchResponse(code, body); };
        const stock = stockDone ? { state: row.stock_state } : await launch('estoque');
        const accountsDone = DONE.has(row?.accounts_state);
        const accounts = accountsDone ? { state: row.accounts_state } : await launch('contas');
        const error = [stock.state === 'error' ? `estoque: ${stock.message}` : '', accounts.state === 'error' ? `contas: ${accounts.message}` : ''].filter(Boolean).join(' | ');
        await save(item, { numeroLoja, pedidoNumero, stock: stock.state, accounts: accounts.state, error });

        const did = [(!stockDone && stock.state === 'launched') ? 'estoque' : '', (!accountsDone && accounts.state === 'launched') ? 'contas' : ''].filter(Boolean);
        if (did.length) {
          result.launched += 1;
          result.launches.push({ nfeId: item.id, numero: item.numero, pedido: pedidoNumero, launched: did });
          logger.info?.('[bling-nfe-launch-guard]', JSON.stringify({ nfe: item.numero, pedido: pedidoNumero, launched: did }));
          await notify(`🔧 Bling: a NF ${item.numero} (pedido ${pedidoNumero}, loja ${numeroLoja}) estava autorizada sem ${did.join(' e ')} lançado. Lancei agora.\nCostuma acontecer quando a emissão automática da nota falha e ela é enviada de novo.`).catch(e => logger.warn?.('[bling-nfe-launch-guard] aviso falhou:', e?.message || e));
        }
        if (error) {
          result.errors += 1;
          logger.warn?.('[bling-nfe-launch-guard]', JSON.stringify({ nfe: item.numero, pedido: pedidoNumero, error }));
          if (Number(row?.attempts || 0) + 1 === 3) {
            await notify(`⚠️ Bling: não consegui lançar a NF ${item.numero} (pedido ${pedidoNumero}) depois de 3 tentativas. Erro: ${error}. Lance pelo menu da nota no Bling.`).catch(() => {});
          }
        }
      }
      status.state = result.state; status.lastSuccessAt = now().toISOString(); status.lastError = null;
      status.lastResult = { ...result, candidates: result.candidates.length };
      return result;
    } catch (error) {
      status.state = 'error'; status.lastError = clean(error?.message || error, 300);
      logger.error?.('[bling-nfe-launch-guard] rodada falhou:', status.lastError);
      return { ...result, state: 'error', error: status.lastError };
    } finally {
      if (locked) await db.query("SELECT RELEASE_LOCK('mdv_bling_nfe_launch_guard')").catch(() => {});
      db?.release?.();
      status.running = false;
    }
  }

  const getStatus = () => ({ ...status, enabled: enabled(), intervalMinutes: INTERVAL_MS / 60000, lookbackDays, maxPerRun });
  function start() {
    if (timer) return;
    const run = () => { tick().catch(() => {}); };
    setTimeout(run, 2 * 60 * 1000).unref?.();
    timer = setInterval(run, INTERVAL_MS);
    timer.unref?.();
  }
  return { tick, start, getStatus };
}

module.exports = { createBlingNfeLaunchGuard, classifyLaunchResponse, isFinal };

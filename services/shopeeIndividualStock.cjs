'use strict';

// shopee-g-stock-v1 (24/11/2026): baixa de estoque das vendas da loja Shopee PF (Gláucia).
// As vendas da conta PF não entram no Bling (só a loja MV é integrada lá), e o estoque de tudo sai do Bling,
// então essas vendas não baixavam nada. Agora: venda paga da loja PF = lançamento de SAÍDA no Bling pelo SKU;
// venda cancelada depois da saída = ENTRADA (devolve). O webhook de estoque do Bling atualiza o MdV e os canais.
// Kit (composição no Bling) baixa os componentes. Sem pedido nem nota no Bling.
const OUT_STATUS = /^(READY_TO_SHIP|PROCESSED|RETRY_SHIP|SHIPPED|TO_CONFIRM_RECEIVE|COMPLETED)$/i;
const CANCEL_STATUS = /^CANCELL?ED$/i;
const json = (v) => { if (!v) return {}; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return {}; } };
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function createShopeeIndividualStock({ pool, getAuthHeader, fetchImpl = globalThis.fetch, notify = async () => {}, logger = console,
  windowDays = 30, liveSince = 0, depositId = process.env.BLING_STOCK_SYNC_DEPOSIT_ID, depositName = process.env.BLING_STOCK_SYNC_DEPOSIT_NAME || 'Depósito 01 (Loja)' }) {
  let ready = null;
  let running = false;
  let deposit = depositId ? String(depositId) : null;
  function ensure() {
    if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS shopee_g_stock_moves (
      id BIGINT AUTO_INCREMENT PRIMARY KEY, connection_id VARCHAR(64) NOT NULL, order_sn VARCHAR(60) NOT NULL,
      sku VARCHAR(120) NOT NULL, quantity INT NOT NULL, op CHAR(1) NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'sending',
      bling_ids VARCHAR(400) NULL, error TEXT NULL, attempts INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_move (connection_id, order_sn, sku, op)) DEFAULT CHARSET=utf8mb4`).catch((e) => { ready = null; throw e; });
    return ready;
  }

  let lastCall = 0;
  async function bling(path, init = {}) {
    // Bling aceita ~3 chamadas por segundo: espaça para não tomar 429.
    const wait = lastCall + 450 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    const auth = await getAuthHeader();
    if (!auth) throw new Error('Bling desconectado');
    const res = await fetchImpl(`https://api.bling.com.br/Api/v3${path}`, { ...init, headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
    if (!res.ok) throw new Error(`Bling ${res.status}: ${String(body?.error?.description || body?.error?.message || text).slice(0, 300)}`);
    return body;
  }
  async function depositoId() {
    if (deposit) return deposit;
    const body = await bling('/depositos?pagina=1&limite=100');
    const list = Array.isArray(body.data) ? body.data : [];
    const key = norm(depositName);
    const found = list.find((d) => norm(d.descricao || d.nome) === key) || list.find((d) => norm(d.descricao || d.nome).includes(key)) || list.find((d) => d.padrao) || list[0];
    if (!found?.id) throw new Error('Nenhum depósito no Bling');
    deposit = String(found.id);
    return deposit;
  }
  // Kit (formato E) baixa os componentes; produto simples baixa ele mesmo.
  async function partsOf(blingId, quantity) {
    const body = await bling(`/produtos/${encodeURIComponent(blingId)}`);
    const p = body.data || {};
    const comps = p.estrutura?.componentes || [];
    if (String(p.formato || '').toUpperCase() === 'E' && comps.length) {
      return comps.map((c) => ({ id: String(c.produto?.id), quantidade: Number(c.quantidade || 1) * quantity })).filter((c) => c.id && c.id !== 'undefined');
    }
    return [{ id: String(blingId), quantidade: quantity }];
  }

  async function move({ connectionId, orderSn, sku, quantity, op, shopName, backfill = false }) {
    const [ins] = await pool.query(`INSERT IGNORE INTO shopee_g_stock_moves (connection_id, order_sn, sku, quantity, op) VALUES (?, ?, ?, ?, ?)`, [connectionId, orderSn, sku, quantity, op]);
    if (!ins.affectedRows) {
      const [[row]] = await pool.query('SELECT status, attempts FROM shopee_g_stock_moves WHERE connection_id=? AND order_sn=? AND sku=? AND op=?', [connectionId, orderSn, sku, op]);
      if (!row || row.status !== 'error' || row.attempts >= 5) return 'ja';
      await pool.query("UPDATE shopee_g_stock_moves SET status='sending' WHERE connection_id=? AND order_sn=? AND sku=? AND op=?", [connectionId, orderSn, sku, op]);
    }
    const where = [connectionId, orderSn, sku, op];
    try {
      const [[product]] = await pool.query('SELECT bling_id, name FROM products WHERE sku = ? AND bling_id IS NOT NULL LIMIT 1', [sku]);
      if (!product) throw new Error(`SKU ${sku} sem produto ligado ao Bling no MdV`);
      // shopee-g-stock-v2: se a loja PF voltar a mandar pedidos ao Bling (ela teve integração até 13/11/2026),
      // o próprio pedido do Bling baixa o estoque: aqui não baixa de novo.
      if (op === 'S') {
        const found = await bling(`/pedidos/vendas?numerosLojas[]=${encodeURIComponent(orderSn)}`);
        if (Array.isArray(found.data) && found.data.length) {
          await pool.query("UPDATE shopee_g_stock_moves SET status='bling', error=?, attempts=attempts+1 WHERE connection_id=? AND order_sn=? AND sku=? AND op=?", [`pedido ${found.data[0].numero} já está no Bling`, ...where]);
          return 'no_bling';
        }
      }
      // Retroativo (venda de antes de ligar): estoque já zerado = alguém já acertou na mão; não deixa negativo.
      if (backfill && op === 'S') {
        const [[cur]] = await pool.query('SELECT stock_quantity FROM products WHERE sku = ? LIMIT 1', [sku]);
        if (Number(cur?.stock_quantity || 0) < quantity) {
          await pool.query("UPDATE shopee_g_stock_moves SET status='skipped', error=?, attempts=attempts+1 WHERE connection_id=? AND order_sn=? AND sku=? AND op=?", [`retroativo: estoque ${Number(cur?.stock_quantity || 0)} < ${quantity}`, ...where]);
          return 'pulado';
        }
      }
      const parts = await partsOf(product.bling_id, quantity);
      const dep = await depositoId();
      for (const part of parts) {
        await bling('/estoques', { method: 'POST', body: JSON.stringify({ produto: { id: Number(part.id) }, deposito: { id: Number(dep) }, operacao: op,
          quantidade: part.quantidade, observacoes: `${op === 'S' ? 'Venda' : 'Cancelamento'} ${shopName || 'Shopee PF'} pedido ${orderSn}` }) });
      }
      await pool.query("UPDATE shopee_g_stock_moves SET status='ok', error=NULL, bling_ids=?, attempts=attempts+1 WHERE connection_id=? AND order_sn=? AND sku=? AND op=?", [parts.map((x) => x.id).join(','), ...where]);
      return 'ok';
    } catch (e) {
      const msg = String(e.message || e).slice(0, 1000);
      await pool.query("UPDATE shopee_g_stock_moves SET status='error', error=?, attempts=attempts+1 WHERE connection_id=? AND order_sn=? AND sku=? AND op=?", [msg, ...where]);
      const [[row]] = await pool.query('SELECT attempts FROM shopee_g_stock_moves WHERE connection_id=? AND order_sn=? AND sku=? AND op=?', where);
      if (!backfill && (row?.attempts === 1 || row?.attempts === 5)) {
        await notify(`📦⚠️ *Estoque NÃO ${op === 'S' ? 'baixado' : 'devolvido'}* · ${shopName || 'Shopee PF'}\n🧾 Pedido: ${orderSn}\n🏷️ SKU: ${sku} · ${quantity} un.\n❓ Motivo: ${msg}${row.attempts === 5 ? '\n🛠️ Parei de tentar: lance no Bling na mão.' : '\n🔁 Tento de novo sozinho.'}`).catch(() => {});
      }
      logger.warn?.(`[shopee-g-stock] ${orderSn} ${sku} ${op}: ${msg}`);
      return 'erro';
    }
  }

  async function tick() {
    if (running) return { skipped: 'rodando' };
    running = true;
    try {
      await ensure();
      const [conns] = await pool.query("SELECT id, display_name FROM shopee_shop_connections WHERE seller_type = 'individual' AND active = 1");
      const result = { saida: 0, entrada: 0, erro: 0, sem_sku: 0, pulado: 0 };
      for (const conn of conns || []) {
        const [sales] = await pool.query(`SELECT external_id, status, occurred_at, sale_json FROM marketplace_sales_cache
          WHERE channel = 'shopee' AND connection_id = ? AND occurred_at > NOW() - INTERVAL ? DAY ORDER BY occurred_at`, [String(conn.id), windowDays]);
        for (const sale of sales || []) {
          const status = String(sale.status || '');
          const cancel = CANCEL_STATUS.test(status);
          if (!cancel && !OUT_STATUS.test(status)) continue;
          const items = new Map();
          for (const it of json(sale.sale_json).details?.items || []) {
            const sku = String(it.sku || '').trim();
            if (!sku) { result.sem_sku += 1; continue; }
            items.set(sku, (items.get(sku) || 0) + Math.max(1, Number(it.quantity || 1)));
          }
          for (const [sku, quantity] of items) {
            const backfill = liveSince > 0 && new Date(sale.occurred_at).getTime() < liveSince;
            const base = { connectionId: String(conn.id), orderSn: String(sale.external_id), sku, quantity, shopName: conn.display_name, backfill };
            if (cancel) {
              const [[out]] = await pool.query("SELECT 1 FROM shopee_g_stock_moves WHERE connection_id=? AND order_sn=? AND sku=? AND op='S' AND status='ok'", [base.connectionId, base.orderSn, sku]);
              if (!out) continue;
              const r = await move({ ...base, op: 'E' });
              if (r === 'ok') result.entrada += 1; else if (r === 'erro') result.erro += 1;
            } else {
              const r = await move({ ...base, op: 'S' });
              if (r === 'ok') result.saida += 1; else if (r === 'erro') result.erro += 1; else if (r === 'pulado') result.pulado += 1;
            }
          }
        }
      }
      return result;
    } finally { running = false; }
  }

  function start({ everyMs = 3 * 60_000, firstMs = 60_000 } = {}) {
    const run = () => tick().then((r) => { if (r && (r.saida || r.entrada || r.erro)) logger.log?.('[shopee-g-stock]', JSON.stringify(r)); })
      .catch((e) => logger.warn?.(`[shopee-g-stock] ${e.message}`));
    setTimeout(run, firstMs).unref?.();
    setInterval(run, everyMs).unref?.();
  }

  return { tick, start, move };
}

module.exports = { createShopeeIndividualStock, OUT_STATUS, CANCEL_STATUS };

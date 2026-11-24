'use strict';

// marketplace-cancel-stock-v1 (24/11/2026): venda cancelada no marketplace = pedido Cancelado no Bling (devolve o estoque).
// O Bling já faz isso sozinho com a Shopee MV, mas os pedidos do Mercado Livre e do TikTok (e alguns da Shopee)
// ficavam "Atendido" depois do cancelamento, e a baixa não era desfeita (ex.: SG8P, pedido Bling 11613, 23/11).
// Regras: só cancelamentos novos (a primeira rodada só marca os que já existem); venda do ML cancelada DEPOIS de
// enviada não é mexida (o produto ainda não voltou): só avisa no grupo. Loja Shopee PF fica com o shopeeIndividualStock.
const CANCEL = /^cancell?ed$/i;
const json = (v) => { if (!v) return {}; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return {}; } };
const LABEL = { mercado_livre: 'Mercado Livre', tiktok: 'TikTok Shop', shopee: 'Shopee MV' };

function createMarketplaceCancelStock({ pool, getAuthHeader, fetchImpl = globalThis.fetch, notify = async () => {}, logger = console, gapMs = 450 }) {
  let ready = null;
  let running = false;
  let last = 0;
  function ensure() {
    if (!ready) ready = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS marketplace_cancel_moves (channel VARCHAR(32) NOT NULL, external_id VARCHAR(120) NOT NULL,
        action VARCHAR(20) NOT NULL, bling_pedido VARCHAR(40) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (channel, external_id)) DEFAULT CHARSET=utf8mb4`);
      await pool.query(`CREATE TABLE IF NOT EXISTS marketplace_cancel_config (k VARCHAR(40) PRIMARY KEY, v TEXT NOT NULL) DEFAULT CHARSET=utf8mb4`);
    })().catch((e) => { ready = null; throw e; });
    return ready;
  }
  async function bling(path, init = {}) {
    const wait = last + gapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const auth = await getAuthHeader();
    if (!auth) throw new Error('Bling desconectado');
    const res = await fetchImpl(`https://api.bling.com.br/Api/v3${path}`, { ...init, headers: { Authorization: auth, Accept: 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    if (!res.ok) throw new Error(`Bling ${res.status}: ${text.slice(0, 200)}`);
    try { return text ? JSON.parse(text) : {}; } catch { return {}; }
  }
  const record = (channel, id, action, pedido = null) => pool.query('INSERT IGNORE INTO marketplace_cancel_moves (channel, external_id, action, bling_pedido) VALUES (?, ?, ?, ?)', [channel, id, action, pedido]);

  function itemsText(sale) {
    return (sale.details?.items || []).map((i) => `*${Number(i.quantity || 1)}x* ${i.name || 'Produto'}${i.sku ? ` · SKU ${i.sku}` : ''}`).join('\n');
  }

  async function tick() {
    if (running) return { skipped: 'rodando' };
    running = true;
    try {
      await ensure();
      const [[cfg]] = await pool.query("SELECT v FROM marketplace_cancel_config WHERE k = 'baseline_done'");
      const baseline = !cfg;
      const [rows] = await pool.query(`SELECT c.channel, c.connection_id, c.external_id, c.status, c.sale_json FROM marketplace_sales_cache c
        LEFT JOIN marketplace_cancel_moves m ON m.channel = c.channel AND m.external_id = c.external_id
        WHERE m.external_id IS NULL AND LOWER(c.status) IN ('cancelled', 'canceled') AND c.occurred_at > NOW() - INTERVAL 90 DAY
          AND c.channel IN ('mercado_livre', 'tiktok', 'shopee') AND NOT (c.channel = 'shopee' AND c.connection_id <> 'primary')`);
      const out = { cancelado: 0, ja_cancelado: 0, nao_no_bling: 0, enviado: 0, erro: 0, baseline: rows.length && baseline ? rows.length : 0 };
      for (const r of rows) {
        if (!CANCEL.test(String(r.status))) continue;
        if (baseline) { await record(r.channel, r.external_id, 'baseline'); continue; }
        const sale = json(r.sale_json);
        const label = LABEL[r.channel] || r.channel;
        try {
          const numbers = [r.external_id, sale.details?.pack_id, sale.pack_id].filter(Boolean).map(String);
          let pedido = null;
          for (const n of numbers) {
            const found = await bling(`/pedidos/vendas?numerosLojas[]=${encodeURIComponent(n)}`);
            if (found.data?.length) { pedido = found.data[0]; break; }
          }
          if (!pedido) { await record(r.channel, r.external_id, 'nao_no_bling'); out.nao_no_bling++; continue; }
          if (Number(pedido.situacao?.id) === 12) {
            await record(r.channel, r.external_id, 'ja_cancelado', pedido.numero);
            out.ja_cancelado++;
            await notify(`↩️ *Venda cancelada* · ${label}\n🧾 Pedido: ${r.external_id}\n${itemsText(sale)}\n📦 O Bling já cancelou o pedido ${pedido.numero} e devolveu o estoque.`).catch(() => {});
            continue;
          }
          if (r.channel === 'mercado_livre') {
            const [[job]] = await pool.query('SELECT shipment_status FROM mercado_livre_print_jobs WHERE order_id = ? OR pack_id = ? LIMIT 1', [r.external_id, r.external_id]).catch(() => [[null]]);
            if (job && /^(shipped|delivered)$/i.test(String(job.shipment_status || ''))) {
              await record(r.channel, r.external_id, 'enviado', pedido.numero);
              out.enviado++;
              await notify(`↩️⚠️ *Venda cancelada depois de enviada* · ${label}\n🧾 Pedido: ${r.external_id}\n${itemsText(sale)}\n📦 Não mexi no estoque: quando o produto voltar, cancele o pedido ${pedido.numero} no Bling (ou lance a entrada).`).catch(() => {});
              continue;
            }
          }
          await bling(`/pedidos/vendas/${pedido.id}/situacoes/12`, { method: 'PATCH' });
          await record(r.channel, r.external_id, 'cancelado', pedido.numero);
          out.cancelado++;
          await notify(`↩️✅ *Venda cancelada* · ${label}\n🧾 Pedido: ${r.external_id}\n${itemsText(sale)}\n📦 Cancelei o pedido ${pedido.numero} no Bling: estoque devolvido.`).catch(() => {});
        } catch (e) {
          out.erro++;
          logger.warn?.(`[cancel-stock] ${r.channel} ${r.external_id}: ${e.message}`);
        }
      }
      if (baseline) await pool.query("INSERT IGNORE INTO marketplace_cancel_config (k, v) VALUES ('baseline_done', '1')");
      return out;
    } finally { running = false; }
  }

  function start({ everyMs = 5 * 60_000, firstMs = 90_000 } = {}) {
    const run = () => tick().then((r) => { if (r && (r.cancelado || r.enviado || r.erro)) logger.log?.('[cancel-stock]', JSON.stringify(r)); })
      .catch((e) => logger.warn?.(`[cancel-stock] ${e.message}`));
    setTimeout(run, firstMs).unref?.();
    setInterval(run, everyMs).unref?.();
  }

  return { tick, start };
}

module.exports = { createMarketplaceCancelStock };

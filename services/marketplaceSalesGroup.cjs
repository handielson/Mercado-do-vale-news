'use strict';

// marketplace-sales-group-v1 (23/11/2026): grupo do WhatsApp só com as vendas dos marketplaces.
// - Venda nova (Shopee, Mercado Livre, TikTok Shop) → mensagem com itens, SKU, variação, valor, cliente, cidade,
//   prazo de postagem e o link do produto no site (para conferir na hora de embalar).
// - Etiqueta: ✅ impressa / ⚠️ não impressa com o motivo (ML e TikTok pela fila de impressão do servidor;
//   Shopee pelo agente do Lenovo em POST /api/marketplace-group/print-event).
// Manda pelo número do robô (Evolution). Na primeira rodada só marca o que já existe (não despeja o histórico).
const crypto = require('crypto');

const SITE = 'https://www.mercadodovale.com.br';
const SKIP_STATUS = /^(unpaid|cancel+ed|in_cancel|payment_required|payment_in_process|pending|to_return|invalid)$/i;
const MAX_AGE_MS = 2 * 24 * 3600e3;
const hashOf = (text) => crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 16);
const semMeioEmoji = (t) => String(t).replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
const brl = (cents) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const when = (ms) => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const json = (v) => { if (!v) return {}; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return {}; } };

function channelLabel(channel, connectionId, shopeeNames = {}) {
  if (channel === 'mercado_livre') return 'Mercado Livre';
  if (channel === 'tiktok') return 'TikTok Shop';
  if (channel === 'shopee') return !connectionId || connectionId === 'primary' ? 'Shopee MV' : (shopeeNames[connectionId] || 'Shopee G');
  return String(channel);
}

function saleMessage(sale, { label, links = {} }) {
  const d = sale.details || {};
  const addr = d.shipping_address || {};
  const city = [addr.city, addr.state].filter(Boolean).join('/');
  const lines = [`🛒 *Venda nova · ${label}*`, `🧾 Pedido: ${sale.external_id}`];
  const who = [sale.customer_name || addr.name, city].filter(Boolean).join(' · ');
  if (who) lines.push(`👤 ${who}`);
  lines.push('', '📦 *Itens:*');
  for (const item of d.items || []) {
    lines.push(`*${Number(item.quantity || 1)}x* ${item.name || 'Produto'}${item.variation ? ` (${item.variation})` : ''}`);
    const extra = [item.sku ? `SKU: ${item.sku}` : '', item.total_cents || item.unit_price_cents ? brl(item.total_cents || item.unit_price_cents) : ''].filter(Boolean).join(' · ');
    if (extra) lines.push(`   ${extra}`);
    const link = links[String(item.sku || '').toUpperCase()];
    lines.push(link ? `   🔗 ${link}` : '   🔗 sem produto com esse SKU no site');
  }
  lines.push('', `💰 Total: *${brl(sale.total_cents)}*${d.payment ? ` · ${d.payment}` : ''}`);
  const shipBy = Number(d.ship_by_date || 0);
  if (shipBy > 0) lines.push(`⏰ Postar até: ${when(shipBy < 1e12 ? shipBy * 1000 : shipBy)}`);
  return lines.join('\n');
}

// marketplace-sales-group-v3: resumo do pedido (cliente, itens, SKU, link) também no aviso de etiqueta.
function orderSummary(sale, links = {}) {
  if (!sale) return '';
  const d = sale.details || {};
  const addr = d.shipping_address || {};
  const lines = [];
  const who = [sale.customer_name || addr.name, [addr.city, addr.state].filter(Boolean).join('/')].filter(Boolean).join(' · ');
  if (who) lines.push(`👤 ${who}`);
  lines.push('📦 *Itens:*');
  for (const item of d.items || []) {
    lines.push(`*${Number(item.quantity || 1)}x* ${item.name || 'Produto'}${item.variation ? ` (${item.variation})` : ''}`);
    if (item.sku) lines.push(`   SKU: ${item.sku}`);
    const link = links[String(item.sku || '').toUpperCase()];
    if (link) lines.push(`   🔗 ${link}`);
  }
  if (sale.total_cents) lines.push(`💰 Total: *${brl(sale.total_cents)}*`);
  return lines.join('\n');
}

function printMessage({ ok, label, order, tracking, stage, reason, instructions, summary = '' }) {
  const extra = summary ? `\n\n${summary}` : '';
  if (ok) return [`🖨️✅ *Etiqueta impressa* · ${label}`, `🧾 Pedido: ${order}`, tracking ? `🚚 Rastreio: ${tracking}` : ''].filter(Boolean).join('\n') + extra;
  return [`⚠️❌ *Etiqueta NÃO impressa* · ${label}`, `🧾 Pedido: ${order}`, tracking ? `🚚 Rastreio: ${tracking}` : '', stage ? `📍 Etapa: ${stage}` : '',
    `❓ Motivo: ${String(reason || 'não informado').slice(0, 600)}`, instructions ? `🛠️ O que fazer: ${String(instructions).slice(0, 500)}` : ''].filter(Boolean).join('\n') + extra;
}

function createMarketplaceSalesGroup({ pool, evolution = {}, fetchImpl = globalThis.fetch, now = () => Date.now(), logger = console, delayMs = 1500 }) {
  const evo = {
    url: String(evolution.url ?? process.env.EVOLUTION_SERVER_URL ?? '').replace(/\/+$/, ''),
    key: evolution.key ?? process.env.EVOLUTION_API_KEY ?? '',
    instance: evolution.instance ?? process.env.N8N_BOT_EVOLUTION_INSTANCE_NAME ?? '',
  };
  let ready = null;
  let running = false;
  function ensure() {
    if (!ready) ready = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS marketplace_group_config (k VARCHAR(60) PRIMARY KEY, v TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) DEFAULT CHARSET=utf8mb4`);
      await pool.query(`CREATE TABLE IF NOT EXISTS marketplace_group_sent (ref VARCHAR(190) PRIMARY KEY, kind VARCHAR(20) NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ok TINYINT NOT NULL DEFAULT 1) DEFAULT CHARSET=utf8mb4`);
    })().catch((e) => { ready = null; throw e; });
    return ready;
  }
  async function config() {
    await ensure();
    const [rows] = await pool.query('SELECT k, v FROM marketplace_group_config');
    return Object.fromEntries((rows || []).map((r) => [r.k, r.v]));
  }
  async function setConfig(k, v) { await ensure(); await pool.query('INSERT INTO marketplace_group_config (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [k, String(v)]); }
  async function wasSent(ref) { const [r] = await pool.query('SELECT 1 FROM marketplace_group_sent WHERE ref = ? LIMIT 1', [ref]); return r.length > 0; }
  async function markSent(ref, kind, ok = 1) { await pool.query('INSERT IGNORE INTO marketplace_group_sent (ref, kind, ok) VALUES (?, ?, ?)', [ref.slice(0, 190), kind, ok ? 1 : 0]); }

  async function send(groupJid, text) {
    if (!evo.url || !evo.key || !evo.instance || typeof fetchImpl !== 'function') throw new Error('Evolution não configurada.');
    const res = await fetchImpl(`${evo.url}/message/sendText/${encodeURIComponent(evo.instance)}`, {
      method: 'POST', headers: { apikey: evo.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: groupJid, text: semMeioEmoji(text) }), signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Evolution respondeu ${res.status}`);
    return true;
  }

  async function shopeeNames() {
    try {
      const [rows] = await pool.query('SELECT id, display_name FROM shopee_shop_connections');
      return Object.fromEntries((rows || []).map((r) => [String(r.id), String(r.display_name || 'Shopee')]));
    } catch { return {}; }
  }
  async function productLinks(skus) {
    const list = [...new Set(skus.map((s) => String(s || '').trim()).filter(Boolean))];
    if (!list.length) return {};
    const [rows] = await pool.query(`SELECT sku, slug, id FROM products WHERE sku IN (${list.map(() => '?').join(',')})`, list);
    return Object.fromEntries((rows || []).map((r) => [String(r.sku).toUpperCase(), `${SITE}/produto/${encodeURIComponent(r.slug || r.id)}`]));
  }

  async function summaryFor(channel, ids) {
    const list = [...new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean))];
    if (!list.length) return '';
    try {
      const [rows] = await pool.query(`SELECT sale_json FROM marketplace_sales_cache WHERE channel = ? AND external_id IN (${list.map(() => '?').join(',')}) LIMIT 1`, [channel, ...list]);
      if (!rows?.length) return '';
      const sale = json(rows[0].sale_json);
      return orderSummary(sale, await productLinks((sale.details?.items || []).map((i) => i.sku)));
    } catch { return ''; }
  }

  // Coleta o que ainda não foi avisado. baseline=true só marca (primeira rodada).
  async function pending() {
    const items = [];
    const [sales] = await pool.query(`SELECT channel, connection_id, external_id, occurred_at, status, sale_json FROM marketplace_sales_cache
      WHERE occurred_at > NOW() - INTERVAL 3 DAY ORDER BY occurred_at`);
    for (const row of sales || []) {
      const ref = `sale:${row.channel}:${row.connection_id}:${row.external_id}`;
      items.push({ ref, kind: 'sale', row, skip: SKIP_STATUS.test(String(row.status || '').trim()) });
    }
    // v4: impressa = etiqueta impressa nas últimas 24 h (updated_at muda quando o envio vira "enviado"/"entregue").
    const [ml] = await pool.query(`SELECT shipment_id, order_id, pack_id, status, tracking_number, last_error, updated_at FROM mercado_livre_print_jobs
      WHERE (status = 'printed' AND label_printed_at > NOW() - INTERVAL 1 DAY) OR (status = 'intervention' AND updated_at > NOW() - INTERVAL 3 DAY)`).catch(() => [[]]);
    for (const j of ml || []) {
      const err = j.status === 'intervention' ? String(j.last_error || 'Remessa não está pronta para imprimir no Mercado Livre.') : '';
      items.push({ ref: `print:ml:${j.shipment_id}:${j.status}${err ? `:${hashOf(err)}` : ''}`, kind: 'print', lookup: ['mercado_livre', [j.order_id, j.pack_id]], print: {
        ok: j.status === 'printed', label: 'Mercado Livre', order: j.order_id || j.shipment_id, tracking: j.tracking_number, stage: 'Impressão', reason: err,
        instructions: err ? 'Abra a venda no Mercado Livre, resolva o que está no motivo e imprima de novo pelo painel.' : '' } });
    }
    const [tt] = await pool.query(`SELECT package_id, order_id, status, tracking_number, last_error, updated_at FROM tiktok_shop_print_jobs
      WHERE (status = 'printed' AND label_printed_at > NOW() - INTERVAL 1 DAY) OR (status = 'intervention' AND updated_at > NOW() - INTERVAL 3 DAY)`).catch(() => [[]]);
    for (const j of tt || []) {
      const err = j.status === 'intervention' ? String(j.last_error || 'Falha na impressão.') : '';
      items.push({ ref: `print:tiktok:${j.package_id}:${j.status}${err ? `:${hashOf(err)}` : ''}`, kind: 'print', lookup: ['tiktok', [j.order_id]], print: {
        ok: j.status === 'printed', label: 'TikTok Shop', order: j.order_id, tracking: j.tracking_number, stage: 'Impressão', reason: err,
        instructions: err ? 'Abra o pedido no TikTok Shop, resolva o que está no motivo e imprima de novo pelo painel.' : '' } });
    }
    return items;
  }

  async function tick() {
    if (running) return { skipped: 'rodando' };
    running = true;
    try {
      const cfg = await config();
      if (!cfg.group_jid || cfg.enabled === '0') return { skipped: 'desligado' };
      const baseline = cfg.baseline_done !== '1';
      const items = await pending();
      const names = await shopeeNames();
      let sent = 0;
      for (const it of items) {
        if (await wasSent(it.ref)) continue;
        if (it.kind === 'sale' && it.skip) continue; // não pago/cancelado: espera mudar de status
        if (baseline) { await markSent(it.ref, it.kind); continue; }
        let text;
        if (it.kind === 'sale') {
          const sale = json(it.row.sale_json);
          if (now() - new Date(it.row.occurred_at).getTime() > MAX_AGE_MS) { await markSent(it.ref, it.kind); continue; }
          const links = await productLinks((sale.details?.items || []).map((i) => i.sku));
          text = saleMessage({ ...sale, external_id: sale.external_id || it.row.external_id }, { label: channelLabel(it.row.channel, it.row.connection_id, names), links });
        } else text = printMessage({ ...it.print, summary: it.lookup ? await summaryFor(...it.lookup) : '' });
        try { await send(cfg.group_jid, text); await markSent(it.ref, it.kind); sent += 1; }
        catch (e) { logger.warn?.(`[marketplace-group] envio falhou (${it.ref}): ${e.message}`); break; }
        await new Promise((r) => setTimeout(r, delayMs));
      }
      if (baseline) await setConfig('baseline_done', '1');
      return { sent, baseline };
    } finally { running = false; }
  }

  // Shopee (agente do Lenovo): resultado da impressão.
  async function printEvent(body = {}) {
    const cfg = await config();
    if (!cfg.group_jid || cfg.enabled === '0') return { ok: false, skipped: 'desligado' };
    const order = String(body.order || '').trim().slice(0, 60);
    if (!order) throw Object.assign(new Error('Pedido obrigatório.'), { statusCode: 400 });
    const ok = body.ok === true;
    const reason = String(body.reason || body.message || '').slice(0, 800);
    const ref = `print:${String(body.channel || 'shopee').slice(0, 20)}:${String(body.connection || '').slice(0, 40)}:${order}:${ok ? 'printed' : `err:${hashOf(`${body.stage}|${reason}`)}`}`;
    if (await wasSent(ref)) return { ok: true, skipped: 'repetido' };
    const names = await shopeeNames();
    const label = body.label ? String(body.label).slice(0, 40) : channelLabel('shopee', String(body.connection || ''), names);
    const summary = await summaryFor('shopee', [order]);
    await send(cfg.group_jid, printMessage({ summary, ok, label, order, tracking: String(body.tracking || '').trim().slice(0, 60), stage: body.stage, reason, instructions: body.instructions }));
    await markSent(ref, 'print', ok);
    return { ok: true };
  }

  function start({ everyMs = 2 * 60_000, firstMs = 40_000 } = {}) {
    const run = () => tick().catch((e) => logger.warn?.(`[marketplace-group] ${e.message}`));
    setTimeout(run, firstMs).unref?.();
    setInterval(run, everyMs).unref?.();
  }

  function register(fastify, { requireSyncKey, requireAdminBearerToken }) {
    fastify.post('/api/marketplace-group/print-event', { preHandler: requireSyncKey }, async (request, reply) => {
      try { return await printEvent(request.body || {}); }
      catch (e) { return reply.code(e.statusCode || 500).send({ error: e.message }); }
    });
    fastify.get('/admin/marketplace-group', { preHandler: requireAdminBearerToken }, async () => {
      const cfg = await config();
      return { group_jid: cfg.group_jid || null, enabled: cfg.enabled !== '0', baseline_done: cfg.baseline_done === '1' };
    });
    fastify.post('/admin/marketplace-group', { preHandler: requireAdminBearerToken }, async (request) => {
      const b = request.body || {};
      if (b.group_jid !== undefined) {
        if (!/^\d{10,30}@g\.us$/.test(String(b.group_jid))) throw Object.assign(new Error('Grupo inválido.'), { statusCode: 400 });
        await setConfig('group_jid', b.group_jid);
      }
      if (b.enabled !== undefined) await setConfig('enabled', b.enabled ? '1' : '0');
      return { ok: true };
    });
  }

  // Aviso avulso no grupo (ex.: estoque da loja PF não baixado).
  async function notice(text) {
    const cfg = await config();
    if (!cfg.group_jid || cfg.enabled === '0') return false;
    return send(cfg.group_jid, text);
  }

  return { tick, printEvent, start, register, config, setConfig, saleMessage, printMessage, notice };
}

module.exports = { createMarketplaceSalesGroup, saleMessage, printMessage, orderSummary, channelLabel, SKIP_STATUS };

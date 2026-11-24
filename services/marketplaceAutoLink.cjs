'use strict';

// marketplace-auto-link-v1 (24/11/2026): liga sozinho os anúncios da Shopee (MV e PF) e do Mercado Livre
// aos produtos do sistema pelo SKU exato, para o estoque do Bling chegar neles.
// Causas achadas na varredura (337 anúncios sem ligação):
//  1) ligação gravada no anúncio inteiro, sem a variação (shopee_model_id vazio num anúncio com variações):
//     o estoque não era aplicado e o vínculo parava de sincronizar; aqui a variação certa é gravada.
//  2) anúncio duplicado na mesma loja (antigo + novo do mesmo produto): o sistema só guarda UM anúncio por
//     produto em cada loja (índice único); o segundo vai para shopee_stock_extra_links, usado só no envio de estoque.
//  3) anúncio criado direto na Shopee/ML, sem passar pelo sistema: nunca ganhava ligação.
// Nunca mexe em preço. Só liga quando o SKU bate com UM produto.
const crypto = require('crypto');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const up = (s) => String(s || '').trim().toUpperCase();

function createMarketplaceAutoLink({ pool, shopee, ml, resync, notify = async () => {}, logger = console, pauseMs = 250 }) {
  let ready = null;
  let running = false;
  function ensure() {
    if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS shopee_stock_extra_links (
      connection_id VARCHAR(64) NOT NULL, shopee_item_id BIGINT NOT NULL, shopee_model_id BIGINT NOT NULL DEFAULT 0,
      product_id VARCHAR(64) NOT NULL, sku VARCHAR(120) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (connection_id, shopee_item_id, shopee_model_id), KEY idx_extra_product (product_id)) DEFAULT CHARSET=utf8mb4`)
      .catch((e) => { ready = null; throw e; });
    return ready;
  }

  async function productBySku() {
    const [rows] = await pool.query("SELECT id, sku FROM products WHERE sku IS NOT NULL AND sku <> ''");
    const map = new Map();
    for (const r of rows) { const k = up(r.sku); map.set(k, map.has(k) ? null : String(r.id)); } // null = SKU repetido
    return map;
  }

  async function shopeeUnits(conn) {
    const ids = [];
    for (let offset = 0; ; offset += 100) {
      const j = await shopee('/api/v2/product/get_item_list', conn, { offset, page_size: 100, item_status: 'NORMAL' });
      ids.push(...(j.response?.item || []).map((i) => i.item_id));
      if (!j.response?.has_next_page) break;
      await sleep(pauseMs);
    }
    const units = [];
    for (let i = 0; i < ids.length; i += 50) {
      const j = await shopee('/api/v2/product/get_item_base_info', conn, { item_id_list: ids.slice(i, i + 50).join(',') });
      for (const it of j.response?.item_list || []) {
        if (it.has_model) {
          await sleep(pauseMs);
          const mj = await shopee('/api/v2/product/get_model_list', conn, { item_id: it.item_id });
          for (const md of mj.response?.model || []) units.push({ item: Number(it.item_id), model: Number(md.model_id), sku: md.model_sku, hasModel: true });
        } else units.push({ item: Number(it.item_id), model: 0, sku: it.item_sku, hasModel: false });
      }
      await sleep(pauseMs);
    }
    return units;
  }

  async function linkShopee(conn, bySku, touched, report) {
    const units = await shopeeUnits(conn);
    const [main] = await pool.query('SELECT id, product_id, shopee_item_id, shopee_model_id FROM shopee_products WHERE connection_id = ?', [conn]);
    const [extra] = await pool.query('SELECT product_id, shopee_item_id, shopee_model_id FROM shopee_stock_extra_links WHERE connection_id = ?', [conn]);
    const key = (item, model) => `${item}:${Number(model || 0)}`;
    const linked = new Set([...main, ...extra].map((l) => key(l.shopee_item_id, l.shopee_model_id)));
    const mainByProduct = new Map(main.map((l) => [String(l.product_id), l]));
    const itemsWithModels = new Set(units.filter((u) => u.hasModel).map((u) => u.item));
    // Primeiro as variações do anúncio em que o produto já está ligado (corrige a ligação em vez de duplicar).
    const sameItem = (u) => { const pid = bySku.get(up(u.sku)); const cur = pid && mainByProduct.get(pid); return Boolean(cur) && Number(cur.shopee_item_id) === u.item; };
    const ordered = [...units.filter(sameItem), ...units.filter((u) => !sameItem(u))];
    for (const u of ordered) {
      if (linked.has(key(u.item, u.model))) continue;
      const pid = u.sku ? bySku.get(up(u.sku)) : undefined;
      if (!pid) { if (u.sku && pid === null) report.sku_repetido++; continue; }
      const cur = mainByProduct.get(pid);
      if (!cur) {
        await pool.query("INSERT INTO shopee_products (id, product_id, connection_id, shopee_item_id, shopee_model_id, shopee_model_sku, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())",
          [crypto.randomUUID(), pid, conn, u.item, u.model || null, u.model ? u.sku : null]);
        mainByProduct.set(pid, { product_id: pid, shopee_item_id: u.item, shopee_model_id: u.model || null });
        report.ligado++;
      } else if (Number(cur.shopee_item_id) === u.item && !Number(cur.shopee_model_id) && itemsWithModels.has(u.item)) {
        await pool.query('UPDATE shopee_products SET shopee_model_id = ?, shopee_model_sku = ?, updated_at = NOW() WHERE product_id = ? AND connection_id = ?', [u.model, u.sku, pid, conn]);
        linked.delete(key(cur.shopee_item_id, 0));
        cur.shopee_model_id = u.model;
        report.variacao_corrigida++;
      } else {
        await pool.query('INSERT IGNORE INTO shopee_stock_extra_links (connection_id, shopee_item_id, shopee_model_id, product_id, sku) VALUES (?, ?, ?, ?, ?)', [conn, u.item, u.model || 0, pid, u.sku]);
        report.anuncio_extra++;
      }
      linked.add(key(u.item, u.model));
      touched.add(pid);
    }
  }

  async function linkMercadoLivre(bySku, touched, report) {
    const [[cfg]] = await pool.query('SELECT user_id FROM mercado_livre_settings LIMIT 1');
    if (!cfg?.user_id) return;
    const ids = [];
    let scroll = '';
    for (;;) {
      const j = await ml(`/users/${cfg.user_id}/items/search?status=active&search_type=scan&limit=100${scroll ? `&scroll_id=${scroll}` : ''}`);
      if (!j.results?.length) break;
      ids.push(...j.results); scroll = j.scroll_id;
      await sleep(pauseMs);
    }
    const [links] = await pool.query('SELECT item_id, variation_id FROM mercado_livre_products');
    const linked = new Set(links.map((l) => `${l.item_id}:${l.variation_id || ''}`));
    const skuAttr = (attrs = []) => String((attrs.find((a) => a.id === 'SELLER_SKU') || {}).value_name || '').trim();
    // A consulta de vários anúncios de uma vez (/items?ids=) foi desativada pelo ML para este app: um por um.
    for (const id of ids) {
      {
        const it = await ml(`/items/${id}?include_attributes=all`);
        if (!it?.id) continue;
        const units = it.variations?.length
          ? it.variations.map((v) => ({ v: String(v.id), sku: skuAttr(v.attributes) || String(v.seller_custom_field || '') }))
          : [{ v: '', sku: skuAttr(it.attributes) || String(it.seller_custom_field || '') }];
        for (const u of units) {
          if (linked.has(`${it.id}:${u.v}`) || (u.v && linked.has(`${it.id}:`))) continue;
          const pid = u.sku ? bySku.get(up(u.sku)) : undefined;
          if (!pid) { if (u.sku && pid === null) report.sku_repetido++; continue; }
          await pool.query('INSERT IGNORE INTO mercado_livre_products (product_id, item_id, variation_id, seller_sku) VALUES (?, ?, ?, ?)', [pid, it.id, u.v, u.sku]);
          linked.add(`${it.id}:${u.v}`); touched.add(pid); report.ligado++;
        }
      }
      await sleep(pauseMs);
    }
  }

  async function run({ only = '' } = {}) {
    if (running) return { skipped: 'rodando' };
    running = true;
    const started = Date.now();
    const out = {};
    try {
      await ensure();
      const bySku = await productBySku();
      const touched = new Set();
      const [conns] = await pool.query("SELECT id, display_name FROM shopee_shop_connections WHERE active = 1 AND authorization_status = 'connected'");
      const shops = [{ id: 'primary', name: 'Shopee MV' }, ...conns.map((c) => ({ id: String(c.id), name: c.display_name }))];
      for (const s of only === 'ml' ? [] : shops) {
        const report = { ligado: 0, variacao_corrigida: 0, anuncio_extra: 0, sku_repetido: 0 };
        try { await linkShopee(s.id, bySku, touched, report); } catch (e) { report.erro = String(e.message || e).slice(0, 200); }
        out[s.name] = report;
      }
      const mlReport = { ligado: 0, sku_repetido: 0 };
      try { await linkMercadoLivre(bySku, touched, mlReport); } catch (e) { mlReport.erro = String(e.message || e).slice(0, 200); }
      out['Mercado Livre'] = mlReport;
      const ids = [...touched];
      for (let i = 0; i < ids.length; i += 100) { await resync(ids.slice(i, i + 100)).catch((e) => logger.warn?.(`[auto-link] estoque: ${e.message}`)); }
      out.produtos_com_estoque_reenviado = ids.length;
      out.minutos = Math.round((Date.now() - started) / 6000) / 10;
      const lines = Object.entries(out).filter(([, r]) => r && typeof r === 'object' && (r.ligado || r.variacao_corrigida || r.anuncio_extra || r.erro))
        .map(([loja, r]) => `• *${loja}*: ${[r.ligado && `${r.ligado} ligados`, r.variacao_corrigida && `${r.variacao_corrigida} variações corrigidas`, r.anuncio_extra && `${r.anuncio_extra} duplicados ligados`, r.erro && `erro: ${r.erro}`].filter(Boolean).join(', ')}`);
      if (lines.length) await notify(`🔗 *Anúncios ligados ao estoque*\n${lines.join('\n')}\n📦 Estoque reenviado para ${ids.length} produtos.`).catch(() => {});
      logger.log?.('[auto-link]', JSON.stringify(out));
      return out;
    } finally { running = false; }
  }

  function start({ everyMs = 6 * 3600e3, firstMs = 10 * 60e3 } = {}) {
    const go = () => run().catch((e) => logger.warn?.(`[auto-link] ${e.message}`));
    setTimeout(go, firstMs).unref?.();
    setInterval(go, everyMs).unref?.();
  }

  return { run, start, ensure };
}

module.exports = { createMarketplaceAutoLink };

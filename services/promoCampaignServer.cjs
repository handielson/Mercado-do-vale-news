'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { isPromoActive, normalizePromoCampaign, buildPromoWhatsAppText, shortPromoDate } = require('./promoPricingCore.cjs');
const { paginatePromoItems, renderPromoCampaignPage } = require('./promoCampaignArtwork.cjs');
const { loadPromoMediaByProductIds, registerProductPromoMediaRoutes } = require('./productPromoMediaServer.cjs');

const PREFERENCE_KEY = 'promo_campaign';
const MAX_PRODUCTS = 120;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const parse = (value, fallback) => { try { return typeof value === 'string' ? JSON.parse(value) : value ?? fallback; } catch { return fallback; } };

function displayWhatsapp(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return String(value || '');
}

// Produtos que entram na campanha: ativos, vendáveis, com estoque e com promoção ativa agora.
function selectPromoCampaignProducts(rows, now = Date.now()) {
  return rows
    .filter((row) => isPromoActive(row, now))
    .filter((row) => Number(row.track_inventory) === 0 || Number(row.available_stock) > 0)
    .map((row) => ({
      id: row.id,
      sku: row.sku || null,
      name: String(row.name || '').trim(),
      retailCents: Math.round(Number(row.price_retail)),
      promoCents: Math.round(Number(row.price_promo)),
      promoStart: row.promo_start || null,
      promoEnd: row.promo_end || null,
      stock: Number(row.track_inventory) === 0 ? null : Math.max(0, Math.trunc(Number(row.available_stock) || 0)),
      row,
    }))
    // Maior desconto primeiro: chama mais atenção no topo da lista.
    .sort((a, b) => (b.retailCents - b.promoCents) / b.retailCents - (a.retailCents - a.promoCents) / a.retailCents
      || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, MAX_PRODUCTS);
}

function createPromoCampaignService(dependencies) {
  const { pool, comboStockSql } = dependencies;
  const publicApiUrl = String(dependencies.publicApiUrl || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');

  async function readCampaign() {
    const [rows] = await pool.query('SELECT value_json, updated_at FROM admin_preferences WHERE preference_key = ? LIMIT 1', [PREFERENCE_KEY]);
    const value = parse(rows[0]?.value_json, null);
    if (!value) return { headline: '', footer: '', media_url: null, media_type: null, updated_at: null };
    return { headline: value.headline || '', footer: value.footer || '', media_url: value.media_url || null,
      media_type: value.media_type || null, updated_at: rows[0]?.updated_at || null };
  }

  async function saveCampaign(input) {
    const campaign = normalizePromoCampaign(input);
    await pool.query(`INSERT INTO admin_preferences (preference_key, value_json) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = CURRENT_TIMESTAMP`, [PREFERENCE_KEY, JSON.stringify(campaign)]);
    return readCampaign();
  }

  async function loadProducts() {
    const stockSql = typeof comboStockSql === 'function' ? comboStockSql('p') : 'GREATEST(COALESCE(p.stock_quantity,0),0)';
    const [rows] = await pool.query(`SELECT p.id,p.name,p.sku,p.slug,p.model_id,p.specs,p.track_inventory,
        p.price_retail,p.price_promo,p.promo_start,p.promo_end,p.images,p.image_url,
        ${stockSql} AS available_stock
      FROM products p
      WHERE p.status='active' AND COALESCE(p.is_parent,0)=0 AND COALESCE(p.hide_from_catalog,0)=0
        AND (p.offer_visibility IS NULL OR p.offer_visibility <> 'hidden')
        AND p.price_promo > 0 AND p.price_promo < p.price_retail
      ORDER BY p.name, p.id`);
    const selected = selectPromoCampaignProducts(rows);
    // promo-media-v1: imagem/vídeo próprios da promoção (definidos na Página do Produto, por versão).
    let media = new Map();
    try { media = await loadPromoMediaByProductIds(pool, selected.map((item) => item.id)); } catch {}
    return selected.map((item) => ({ ...item, promoImageUrl: media.get(String(item.id))?.image_url || null, promoVideoUrl: media.get(String(item.id))?.video_url || null }));
  }

  function publicProduct(item) {
    const { row, ...rest } = item;
    return rest;
  }

  async function overview() {
    const [campaign, products] = await Promise.all([readCampaign(), loadProducts()]);
    const whatsapp = buildPromoWhatsAppText({ headline: campaign.headline || '(escreva o título da campanha)', footer: campaign.footer, items: products });
    return { ok: true, campaign, products: products.map(publicProduct), whatsapp, generatedAt: new Date().toISOString() };
  }

  // Mesmo contrato da tabela de celulares: { ok, items:[{mediaType,mediaUrl,label,caption,offsetSeconds}], ... }
  const inFlight = new Map();
  async function generateStories() {
    const campaign = await readCampaign();
    if (!campaign.headline) throw Object.assign(new Error('Salve o título da campanha antes de gerar os stories.'), { statusCode: 409 });
    const products = await loadProducts();
    const generatedAt = new Date();
    if (!products.length) {
      return { ok: true, items: [], availableBrands: [], productCount: 0, generatedAt: generatedAt.toISOString(), warnings: ['Nenhum produto com promoção ativa e estoque agora.'] };
    }
    const [[company]] = await pool.query('SELECT phone,logo,watermark_url,social_website FROM company_settings LIMIT 1');
    if (!company?.phone) throw Object.assign(new Error('Cadastre o WhatsApp oficial nos dados da empresa.'), { statusCode: 409 });
    const hydrated = typeof dependencies.attachCatalogModelColorImages === 'function'
      ? await dependencies.attachCatalogModelColorImages(products.map((p) => p.row), 'https://mercadodovale.com.br')
      : products.map((p) => p.row);
    const byId = new Map(hydrated.map((row) => [row.id, row]));
    const cards = products.map((p) => ({ id: p.id, name: p.name, retailCents: p.retailCents, promoCents: p.promoCents,
      untilLabel: shortPromoDate(p.promoEnd), row: byId.get(p.id) || p.row }));
    const pages = paginatePromoItems(cards);
    const day = generatedAt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const key = hash(JSON.stringify({ campaign, cards: cards.map(({ row, ...c }) => c), day, version: 1 }));
    if (inFlight.has(key)) return inFlight.get(key);
    const job = (async () => {
      const readImage = dependencies.readImage;
      const imageCache = new Map();
      const image = (url) => {
        if (!imageCache.has(url)) imageCache.set(url, readImage(url).catch(() => null));
        return imageCache.get(url);
      };
      let logoBuffer;
      try { logoBuffer = await fs.readFile(path.join(__dirname, '../public/brand/mercado-do-vale-logo.png')); } catch {}
      if (!logoBuffer) logoBuffer = await image('https://mercadodovale.com.br/brand/mercado-do-vale-logo.png');
      const directory = path.join(dependencies.uploadsDir, 'promo-campaigns');
      await fs.mkdir(directory, { recursive: true });
      const warnings = [];
      const items = [];
      const website = String(company.social_website || 'mercadodovale.com.br').replace(/^https?:\/\//i, '').replace(/\/$/, '');
      for (const page of pages) {
        const pageKey = hash(JSON.stringify({ key, pageNumber: page.pageNumber }));
        let filename = `${pageKey}.png`;
        let target = path.join(directory, filename);
        let cached = false;
        try { await fs.access(target); cached = true; } catch {}
        if (!cached) {
          let missingPhoto = false;
          const withImages = await Promise.all(page.items.map(async (card) => {
            const urls = [...new Set([...parse(card.row.resolved_images, []), ...parse(card.row.model_color_images, []), ...parse(card.row.images, []), card.row.image_url].filter(Boolean))];
            let imageBuffer = null;
            for (const url of urls) { imageBuffer = await image(url); if (imageBuffer) break; }
            if (!imageBuffer) { missingPhoto = true; warnings.push(`Foto indisponível: ${card.name}`); }
            return { ...card, imageBuffer };
          }));
          const buffer = await renderPromoCampaignPage({ headline: campaign.headline, footer: campaign.footer, items: withImages, logoBuffer,
            whatsapp: displayWhatsapp(company.phone), website, pageNumber: page.pageNumber, totalPages: page.totalPages });
          if (missingPhoto) { filename = `${pageKey}-${crypto.randomUUID()}.png`; target = path.join(directory, filename); }
          const temporary = `${target}.${crypto.randomUUID()}.tmp`;
          await fs.writeFile(temporary, buffer);
          await fs.rename(temporary, target);
        }
        items.push({ mediaType: 'image', mediaUrl: `${publicApiUrl}/images/promo-campaigns/${filename}`,
          label: `Promoção • ${page.pageNumber}/${page.totalPages}`, caption: '', offsetSeconds: items.length * 10 });
      }
      return { ok: true, items, availableBrands: [], productCount: products.length, generatedAt: generatedAt.toISOString(), warnings };
    })();
    inFlight.set(key, job);
    try { return await job; } finally { inFlight.delete(key); }
  }

  return { readCampaign, saveCampaign, loadProducts, overview, generateStories };
}

function registerPromoCampaignRoutes(fastify, dependencies) {
  const service = createPromoCampaignService(dependencies);
  dependencies.generatePromoCampaignStories = service.generateStories;
  const guard = { preHandler: dependencies.requireSyncKeyOrAdmin };
  registerProductPromoMediaRoutes(fastify, { pool: dependencies.pool, guard });
  const send = async (reply, work) => {
    reply.header('Cache-Control', 'no-store');
    try { return await work(); } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.statusCode ? error.message : 'Não foi possível concluir a campanha de promoção.' });
    }
  };
  fastify.get('/admin/marketing/promo-campaign', guard, (req, reply) => send(reply, () => service.overview()));
  fastify.put('/admin/marketing/promo-campaign', guard, (req, reply) => send(reply, async () => {
    await service.saveCampaign(req.body || {});
    return service.overview();
  }));
  fastify.post('/admin/marketing/promo-campaign/stories/preview', { ...guard, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    (req, reply) => send(reply, () => service.generateStories()));
  return service;
}

module.exports = { PREFERENCE_KEY, selectPromoCampaignProducts, createPromoCampaignService, registerPromoCampaignRoutes };

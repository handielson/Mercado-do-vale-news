'use strict';

const { STOREFRONTS, validateStorefrontOffer, projectStorefrontProduct } = require('./productStorefrontOffer.cjs');
const { validateQuoteItems, quoteProduct, quotePaymentSchedule } = require('./print3dStorefrontQuote.cjs');

const compactImageColumns = `CASE WHEN p.images IS NOT NULL AND JSON_LENGTH(p.images) > 0
  AND JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]')) LIKE 'http%'
  THEN JSON_ARRAY(JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]'))) ELSE JSON_ARRAY() END AS images,
  CASE WHEN p.image_url LIKE 'http%' THEN p.image_url ELSE NULL END AS image_url`;

function productColumns(compact, storefront) { return `p.id, p.sku, p.ean, p.alternative_eans, p.model_id, p.category_id, p.brand, p.name, p.description,
  p.slug, p.status, p.is_parent, p.is_print3d, p.stock_quantity, p.track_inventory,
  ${storefront === 'loja_3d' ? `LEAST(GREATEST(COALESCE(p.stock_quantity, 0), 0),
    COALESCE((SELECT SUM(GREATEST(0, psl.quantity - psl.reserved_quantity))
      FROM product_stock_locations psl WHERE psl.product_id = p.id), GREATEST(COALESCE(p.stock_quantity, 0), 0))) AS available_stock,` : ''}
  ${compact ? compactImageColumns : 'p.images, p.image_url'}, p.video_url, p.marketing_video_url, p.specs, p.custom_fields,
  p.warranty_type, p.warranty_template_id, p.created_at,
  (SELECT c.name FROM categories c WHERE c.id = p.category_id LIMIT 1) AS category_name,
  (SELECT c.slug FROM categories c WHERE c.id = p.category_id LIMIT 1) AS category_slug,
  (SELECT m.blueprint_image_url FROM models m WHERE m.id = p.model_id LIMIT 1) AS blueprint_image_url,
  p.production_days, p.print3d_preorder_enabled,
  p.price_retail AS legacy_price_retail, p.price_promo AS legacy_price_promo`; }
const modelSpecsColumn = `(SELECT m.template_values FROM models m WHERE m.id = p.model_id LIMIT 1) AS model_template_values`;
const offerColumns = `o.product_id, o.storefront, o.publication_status, o.title, o.description AS offer_description, o.category_label,
  o.slug AS offer_slug, o.price_retail, o.price_reseller, o.price_wholesale, o.price_promo,
  o.meta_title, o.meta_description, o.updated_at`;

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function eligibilitySql(storefront) {
  if (storefront === 'loja_3d') return "o.publication_status = 'published' AND p.is_print3d = 1 AND o.price_retail > 0";
  return `((o.publication_status = 'published' AND o.price_retail > 0)
    OR (o.product_id IS NULL AND COALESCE(p.is_print3d, 0) = 0
      AND COALESCE(p.hide_from_catalog, 0) = 0 AND p.price_retail > 0))`;
}

function publicProduct(row, storefront) {
  const legacyMdv = storefront === 'mercado_do_vale' && row.product_id == null;
  const offer = {
    storefront,
    publication_status: legacyMdv ? 'published' : row.publication_status,
    title: row.title,
    description: row.offer_description,
    category_label: row.category_label,
    slug: row.offer_slug,
    price_retail: legacyMdv ? row.legacy_price_retail : row.price_retail,
    price_reseller: row.price_reseller,
    price_wholesale: row.price_wholesale,
    price_promo: legacyMdv ? row.legacy_price_promo : row.price_promo,
    meta_title: row.meta_title,
    meta_description: row.meta_description,
  };
  return projectStorefrontProduct({
    ...row,
    images: parseJson(row.images, []),
    alternative_eans: parseJson(row.alternative_eans, []),
    specs: parseJson(row.specs, {}),
    custom_fields: parseJson(row.custom_fields, {}),
    model_template_values: parseJson(row.model_template_values, {}),
  }, offer);
}

function respondError(reply, error) {
  if (error?.code === 'ER_NO_SUCH_TABLE') return reply.code(503).send({ error: 'Ofertas por site ainda não foram ativadas.' });
  throw error;
}

async function loadPrint3dQuote(pool, requested) {
      const ids = requested.map((item) => item.product_id);
      const [rows] = await pool.query(`SELECT p.id, p.company_id, p.sku, p.name, p.stock_quantity, p.weight_kg, p.dimensions,
          p.print3d_preorder_enabled, p.print3d_preorder_limit, p.production_days,
          o.title, o.price_retail, o.price_promo,
          (SELECT COUNT(*) FROM product_stock_locations psl WHERE psl.product_id = p.id) AS location_count,
          (SELECT COALESCE(SUM(GREATEST(0, psl.quantity - psl.reserved_quantity)), 0)
             FROM product_stock_locations psl WHERE psl.product_id = p.id) AS location_available
        FROM products p INNER JOIN product_storefront_offers o
          ON o.product_id = p.id AND o.storefront = 'loja_3d'
        WHERE p.id IN (${ids.map(() => '?').join(',')})
          AND p.status = 'active' AND COALESCE(p.is_parent, 0) = 0 AND p.is_print3d = 1
          AND o.publication_status = 'published' AND o.price_retail > 0`, ids);
      const byId = new Map(rows.map((row) => [String(row.id), row]));
      const items = requested.map(({ product_id, quantity }) => {
        const row = byId.get(product_id);
        if (!row) return { product_id, quantity, status: 'unavailable' };
        const availableStock = Number(row.location_count) > 0
          ? Math.min(Math.max(0, Number(row.stock_quantity) || 0), Math.max(0, Number(row.location_available) || 0))
          : row.stock_quantity;
        return quoteProduct({ ...row, available_stock: availableStock }, quantity);
      });
      const paymentSchedule = quotePaymentSchedule(items);
      return { rows, items, paymentSchedule };
}

function registerProductStorefrontOfferRoutes(fastify, {
  pool, requireSyncKeyOrAdmin, enrichProducts, calculateShipping, shippingEnv = process.env, mdvReady = process.env.MDV_STOREFRONT_MDV_READY === '1',
}) {
  require('./print3dShippingServer.cjs').registerPrint3dShipping(fastify, {
    pool, loadQuote: loadPrint3dQuote, calculateShipping, env: shippingEnv,
  });
  fastify.post('/storefronts/loja_3d/quote', async (req, reply) => {
    let requested;
    try { requested = validateQuoteItems(req.body?.items); }
    catch (error) { return reply.code(400).send({ error: error.message }); }
    try {
      const { items, paymentSchedule } = await loadPrint3dQuote(pool, requested);
      reply.header('Cache-Control', 'no-store');
      return { storefront: 'loja_3d', items,
        subtotal: paymentSchedule?.subtotal ?? null,
        payment_schedule: paymentSchedule,
        can_checkout: false,
        notice: 'Cotação informativa de produtos, sem frete. Escolha entrada entre 50% e 100% de todos os produtos e quando pagar o frete no checkout. Saldo quitado antes do envio. Estoque e prazo serão reconfirmados; nenhum item foi reservado.' };
    } catch (error) { return respondError(reply, error); }
  });

  fastify.get('/storefronts/:storefront/products', async (req, reply) => {
    const { storefront } = req.params;
    if (!STOREFRONTS.includes(storefront)) return reply.code(404).send({ error: 'Site não encontrado.' });
    const limit = Math.min(Math.max(Math.trunc(Number(req.query?.limit)) || 100, 1), 2000);
    const offset = Math.max(Math.trunc(Number(req.query?.offset)) || 0, 0);
    const search = String(req.query?.search || '').trim().slice(0, 120);
    const category = String(req.query?.category || req.query?.category_id || '').trim().slice(0, 80);
    const sku = String(req.query?.sku || '').trim().slice(0, 120);
    const includeModelSpecs = req.query?.include_model_specs === 'true';
    const params = [storefront];
    let sql = `SELECT ${productColumns(req.query?.compact === 'true', storefront)}, ${offerColumns}${includeModelSpecs ? `, ${modelSpecsColumn}` : ''}
      FROM products p LEFT JOIN product_storefront_offers o ON o.product_id = p.id AND o.storefront = ?
      WHERE ${eligibilitySql(storefront)}
      AND p.status = 'active' AND (p.is_parent = 0 OR p.is_parent IS NULL)
      `;
    if (category) {
      sql += ' AND p.category_id = ?';
      params.push(category);
    }
    if (sku) {
      sql += ' AND p.sku = ?';
      params.push(sku);
    }
    if (search) {
      sql += ` AND (o.title LIKE ? OR p.name LIKE ? OR p.sku LIKE ? OR p.ean LIKE ?
        OR CAST(p.alternative_eans AS CHAR) LIKE ? OR p.brand LIKE ? OR p.model_id LIKE ?
        OR p.slug LIKE ? OR CAST(p.specs AS CHAR) LIKE ? OR CAST(p.custom_fields AS CHAR) LIKE ?)`;
      params.push(...Array(10).fill(`%${search}%`));
    }
    sql += storefront === 'mercado_do_vale'
      ? ' ORDER BY p.name ASC, p.id ASC LIMIT ? OFFSET ?'
      : ' ORDER BY COALESCE(o.updated_at, p.updated_at) DESC, p.id ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    try {
      const [rows] = await pool.query(sql, params);
      reply.header('Cache-Control', storefront === 'mercado_do_vale' ? 'no-store' : 'public, max-age=30');
      const products = rows.map(row => publicProduct(row, storefront)).filter(Boolean);
      return enrichProducts ? enrichProducts(products, req) : products;
    } catch (error) { return respondError(reply, error); }
  });

  fastify.get('/storefronts/:storefront/products/:productId', async (req, reply) => {
    const { storefront, productId } = req.params;
    if (!STOREFRONTS.includes(storefront)) return reply.code(404).send({ error: 'Site não encontrado.' });
    try {
      const [rows] = await pool.query(`SELECT ${productColumns(req.query?.compact === 'true', storefront)}, ${offerColumns}${req.query?.include_model_specs === 'true' ? `, ${modelSpecsColumn}` : ''}
        FROM products p LEFT JOIN product_storefront_offers o ON o.product_id = p.id AND o.storefront = ?
        WHERE p.id = ? AND ${eligibilitySql(storefront)}
        AND p.status = 'active' AND (p.is_parent = 0 OR p.is_parent IS NULL)
        LIMIT 1`, [storefront, productId]);
      const result = rows.length ? publicProduct(rows[0], storefront) : null;
      if (!result) return reply.code(404).send({ error: 'Produto indisponível neste site.' });
      reply.header('Cache-Control', storefront === 'mercado_do_vale' ? 'no-store' : 'public, max-age=30');
      return enrichProducts ? (await enrichProducts([result], req))[0] : result;
    } catch (error) { return respondError(reply, error); }
  });

  fastify.get('/admin/products/:productId/storefront-offers', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
    try {
      const [rows] = await pool.query('SELECT * FROM product_storefront_offers WHERE product_id = ? ORDER BY storefront', [req.params.productId]);
      reply.header('Cache-Control', 'no-store');
      return { offers: rows };
    } catch (error) { return respondError(reply, error); }
  });

  fastify.put('/admin/products/:productId/storefront-offers/:storefront', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {
    const { productId, storefront } = req.params;
    let offer;
    try { offer = validateStorefrontOffer(storefront, req.body); }
    catch (error) { return reply.code(400).send({ error: error.message }); }
    if (storefront === 'mercado_do_vale' && offer.publication_status === 'published' && !mdvReady) {
      return reply.code(409).send({ error: 'A publicação de preços próprios do Mercado do Vale aguarda a migração do site, checkout e bot.' });
    }
    try {
      const [products] = await pool.query('SELECT id, is_print3d, status, is_parent FROM products WHERE id = ? LIMIT 1', [productId]);
      if (!products.length) return reply.code(404).send({ error: 'Produto não encontrado.' });
      if (offer.publication_status === 'published' && (products[0].status !== 'active' || Number(products[0].is_parent) === 1)) return reply.code(400).send({ error: 'Ative uma variante vendável antes de publicar.' });
      if (storefront === 'loja_3d' && offer.publication_status === 'published' && Number(products[0].is_print3d) !== 1) return reply.code(400).send({ error: 'Marque o SKU como produto 3D antes de publicá-lo nesta loja.' });
      await pool.query(`INSERT INTO product_storefront_offers
        (product_id, storefront, publication_status, title, description, category_label, slug, price_retail,
         price_reseller, price_wholesale, price_promo, meta_title, meta_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE publication_status=VALUES(publication_status), title=VALUES(title),
          description=VALUES(description), category_label=VALUES(category_label), slug=VALUES(slug), price_retail=VALUES(price_retail),
          price_reseller=VALUES(price_reseller), price_wholesale=VALUES(price_wholesale),
          price_promo=VALUES(price_promo), meta_title=VALUES(meta_title),
          meta_description=VALUES(meta_description)`, [productId, storefront, offer.publication_status,
        offer.title, offer.description, offer.category_label, offer.slug, offer.price_retail, offer.price_reseller,
        offer.price_wholesale, offer.price_promo, offer.meta_title, offer.meta_description]);
      reply.header('Cache-Control', 'no-store');
      return { ok: true, product_id: productId, storefront, ...offer };
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return reply.code(409).send({ error: 'Este endereço já está em uso neste site.' });
      return respondError(reply, error);
    }
  });
}

module.exports = { registerProductStorefrontOfferRoutes, loadPrint3dQuote };

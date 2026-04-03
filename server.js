require('dotenv').config();
const fastify = require('fastify')({ logger: false, bodyLimit: 50 * 1024 * 1024 }); // 50MB
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

const CORS_ORIGINS = [
  'https://www.mercadodovale.com.br',
  'https://mercadodovale.com.br',
  'https://www.mercadodovale.com',
  'https://mercadodovale.com',
  'https://www.xiaomipetrolina.com.br',
  'https://xiaomipetrolina.com.br',
  'https://mercado-do-vale-news.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

fastify.register(require('@fastify/cors'), {
  origin: (origin, cb) => {
    if (!origin || CORS_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error('Not allowed'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// Serve static images from /var/www/mdv-api/uploads/
fastify.register(require('@fastify/static'), {
  root: UPLOADS_DIR,
  prefix: '/images/',
  decorateReply: false,
});

// Multipart support for file uploads
fastify.register(require('@fastify/multipart'), {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});


// ─── Auth middleware for write endpoints ───────────────────────────────────
function requireSyncKey(request, reply, done) {
  const key = request.headers['x-sync-key'] || request.headers['x-api-key'];
  if (!key || key !== process.env.SYNC_SECRET) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const jsonStr = (v) => v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));

// ─── Health ────────────────────────────────────────────────────────────────
fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  db: 'mysql'
}));

// ─── Categories ────────────────────────────────────────────────────────────
fastify.get('/categories', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT id, name, slug, config, warranty_days, sort_order,
            extended_warranty_enabled, margin_wholesale, margin_reseller,
            created_at, updated_at
     FROM categories
     ORDER BY sort_order ASC, name ASC`
  );
  const result = rows.map(r => ({
    ...r,
    config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config,
  }));
  reply.header('Cache-Control', 'public, max-age=300, s-maxage=600');
  return result;
});

// ─── Category product counts (para navegação do catálogo) ──────────────────
fastify.get('/products/category-counts', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT category_id, COUNT(*) as count
     FROM products
     WHERE status = 'active' AND category_id IS NOT NULL
     GROUP BY category_id`
  );
  reply.header('Cache-Control', 'public, max-age=60, s-maxage=180');
  return rows;
});

// ─── Brands (read) ─────────────────────────────────────────────────────────
fastify.get('/brands', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT id, name, slug, logo_url, warranty_days, active FROM brands ORDER BY name`
  );
  reply.header('Cache-Control', 'public, max-age=300, s-maxage=600');
  return rows;
});

// ─── Brand CRUD (write) ────────────────────────────────────────────────────
fastify.post('/brands', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  await pool.query(
    `INSERT INTO brands (id, name, slug, active, warranty_days, logo_url, company_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name=VALUES(name), slug=VALUES(slug), active=VALUES(active),
       warranty_days=VALUES(warranty_days), logo_url=VALUES(logo_url)`,
    [b.id, b.name, b.slug || null, b.active ? 1 : 1, b.warranty_days || 90, b.logo_url || null, b.company_id || null]
  );
  reply.code(201).send({ ok: true });
});

fastify.put('/brands/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  await pool.query(
    `UPDATE brands SET name=?, slug=?, active=?, warranty_days=?, logo_url=? WHERE id=?`,
    [b.name, b.slug || null, b.active ? 1 : 1, b.warranty_days || 90, b.logo_url || null, req.params.id]
  );
  return { ok: true };
});

fastify.delete('/brands/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query(`DELETE FROM brands WHERE id=?`, [req.params.id]);
  return { ok: true };
});

// ─── Products (read) ───────────────────────────────────────────────────────
fastify.get('/products', async (req, reply) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 500, 2000);
  const offset = parseInt(req.query.offset) || 0;
  const category = req.query.category;
  const status   = req.query.status;
  const search   = req.query.search;
  const favoritesOnly = req.query.favoritesOnly === 'true';
  const customerId = req.query.customerId;
  const compact  = req.query.compact === 'true'; // sem images (evita 90+ MB de base64)

  // Colunas — compact exclui base64 mas inclui primeira URL de imagem (thumbnail)
  const imgCol = compact
    ? `CASE
        WHEN images IS NOT NULL
          AND JSON_LENGTH(images) > 0
          AND JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')) LIKE 'http%'
        THEN JSON_ARRAY(JSON_UNQUOTE(JSON_EXTRACT(images, '$[0]')))
        ELSE JSON_ARRAY()
      END as images`
    : 'images';

  const cols = compact
    ? `id, model_id, category_id, brand, name, sku, ean, alternative_eans,
       price_cost, price_retail, price_reseller, price_wholesale,
       price_promo, promo_start, promo_end,
       is_combo, combo_discount_type, combo_discount_value,
       (CASE WHEN is_combo = 1 THEN COALESCE((SELECT MIN(FLOOR(child.stock_quantity / pc.quantity)) FROM product_combos pc JOIN products child ON child.id = pc.child_product_id WHERE pc.combo_product_id = products.id), 0) ELSE stock_quantity END) AS stock_quantity,
       track_inventory, is_gift,
       warranty_type, warranty_template_id,
       ${imgCol},
       status, parent_id, bling_id, bling_parent_id, video_url,
       slug, origin, specs, custom_fields, kits, exclude_from_seo, meta_title, meta_description, keywords, view_count, created_at, updated_at`
    : `id, model_id, category_id, brand, name, sku, ean, alternative_eans,
       price_cost, price_retail, price_reseller, price_wholesale,
       price_promo, promo_start, promo_end,
       is_combo, combo_discount_type, combo_discount_value,
       (CASE WHEN is_combo = 1 THEN COALESCE((SELECT MIN(FLOOR(child.stock_quantity / pc.quantity)) FROM product_combos pc JOIN products child ON child.id = pc.child_product_id WHERE pc.combo_product_id = products.id), 0) ELSE stock_quantity END) AS stock_quantity,
       track_inventory, is_gift,
       warranty_type, warranty_template_id,
       images, status, parent_id, bling_id, bling_parent_id, video_url,
       slug, origin, specs, custom_fields, kits, exclude_from_seo, meta_title, meta_description, keywords, view_count, created_at, updated_at`;


  let sql = `SELECT ${cols} FROM products WHERE 1=1`;
  const params = [];

  if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
  else if (!status && !search)    { sql += ' AND status = ?'; params.push('active'); }
  // When search is provided without explicit status → no status filter (allows finding by SKU/EAN regardless of status)
  // status=all: retorna todos os status (admin)

  if (category)           { sql += ' AND category_id = ?';   params.push(category); }
  if (search)             { sql += ' AND (name LIKE ? OR sku LIKE ? OR ean LIKE ? OR model_id LIKE ? OR slug LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
  if (req.query.parent_id){ sql += ' AND parent_id = ?';     params.push(req.query.parent_id); }
  if (req.query.sku)      { sql += ' AND sku = ?';           params.push(req.query.sku); }
  if (req.query.ean)      { sql += ' AND (ean = ? OR JSON_CONTAINS(alternative_eans, JSON_QUOTE(?)))'; params.push(req.query.ean, req.query.ean); }
  if (req.query.model_id) { sql += ' AND model_id = ?';      params.push(req.query.model_id); }

  if (favoritesOnly && customerId) {
    sql += ' AND id IN (SELECT product_id FROM customer_favorites WHERE customer_id = ?)';
    params.push(customerId);
  }

  sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  if (search || status === 'all') { // Log explicitly what we are about to query
    console.log(`[VPS GET /products] search="${search || ''}", status="${status || ''}", SQL: ${sql}`);
  }

  const [rows] = await pool.query(sql, params);
  
  if (search || status === 'all') {
    console.log(`[VPS GET /products] Returned ${rows.length} rows for search="${search || ''}"`);
  }

  const result = rows.map(r => ({
    ...r,
    images:           typeof r.images === 'string'           ? JSON.parse(r.images)           : (r.images ?? []),
    specs:            typeof r.specs === 'string'            ? JSON.parse(r.specs)            : r.specs,
    alternative_eans: typeof r.alternative_eans === 'string' ? JSON.parse(r.alternative_eans) : r.alternative_eans,
    custom_fields:    typeof r.custom_fields === 'string'    ? JSON.parse(r.custom_fields)    : r.custom_fields,
    kits:             typeof r.kits === 'string'             ? JSON.parse(r.kits)             : r.kits,
  }));

  // Sem cache para admin (status=all) ou buscas dinâmicas (search)
  // search requests NUNCA devem ser cacheados pelo CDN, pois o resultado
  // varia por query e o cache stale causaria resultados vazios persistentes.
  if (status === 'all' || search) {
    reply.header('Cache-Control', 'no-store');
  } else {
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=180');
  }
  return result;

});

fastify.get('/products/:id', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT *,
      (CASE WHEN is_combo = 1 THEN COALESCE((SELECT MIN(FLOOR(child.stock_quantity / pc.quantity)) FROM product_combos pc JOIN products child ON child.id = pc.child_product_id WHERE pc.combo_product_id = products.id), 0) ELSE stock_quantity END) AS stock_quantity
     FROM products WHERE id = ?`, 
    [req.params.id]
  );
  if (!rows.length) { reply.code(404); return { error: 'Not found' }; }
  const r = rows[0];
  return {
    ...r,
    images:           typeof r.images === 'string'           ? JSON.parse(r.images)           : (r.images ?? []),
    specs:            typeof r.specs === 'string'            ? JSON.parse(r.specs)            : r.specs,
    alternative_eans: typeof r.alternative_eans === 'string' ? JSON.parse(r.alternative_eans) : r.alternative_eans,
    custom_fields:    typeof r.custom_fields === 'string'    ? JSON.parse(r.custom_fields)    : r.custom_fields,
    kits:             typeof r.kits === 'string'             ? JSON.parse(r.kits)             : r.kits,
  };
});

// Busca por slug (para PublicProductPage)
fastify.get('/products/by-slug/:slug', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT *,
      (CASE WHEN is_combo = 1 THEN COALESCE((SELECT MIN(FLOOR(child.stock_quantity / pc.quantity)) FROM product_combos pc JOIN products child ON child.id = pc.child_product_id WHERE pc.combo_product_id = products.id), 0) ELSE stock_quantity END) AS stock_quantity
     FROM products WHERE slug = ?`,
    [req.params.slug]
  );
  if (!rows.length) { reply.code(404); return { error: 'Not found' }; }
  const r = rows[0];
  return {
    ...r,
    images:           typeof r.images === 'string'           ? JSON.parse(r.images)           : (r.images ?? []),
    specs:            typeof r.specs === 'string'            ? JSON.parse(r.specs)            : r.specs,
    alternative_eans: typeof r.alternative_eans === 'string' ? JSON.parse(r.alternative_eans) : r.alternative_eans,
    custom_fields:    typeof r.custom_fields === 'string'    ? JSON.parse(r.custom_fields)    : r.custom_fields,
    kits:             typeof r.kits === 'string'             ? JSON.parse(r.kits)             : r.kits,
  };
});

// Busca por EAN
fastify.get('/products/by-ean/:ean', async (req, reply) => {
  const ean = req.params.ean;
  const [rows] = await pool.query(
    `SELECT *, (CASE WHEN is_combo = 1 THEN 0 ELSE stock_quantity END) AS stock_quantity
     FROM products
     WHERE ean = ? OR JSON_CONTAINS(alternative_eans, JSON_QUOTE(?))`,
    [ean, ean]
  );
  return rows.map(r => ({
    ...r,
    images:           typeof r.images === 'string'           ? JSON.parse(r.images)           : (r.images ?? []),
    specs:            typeof r.specs === 'string'            ? JSON.parse(r.specs)            : r.specs,
    alternative_eans: typeof r.alternative_eans === 'string' ? JSON.parse(r.alternative_eans) : r.alternative_eans,
    kits:             typeof r.kits === 'string'             ? JSON.parse(r.kits)             : r.kits,
  }));
});

fastify.get('/products/:id/combo', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT pc.child_product_id as id, pc.quantity, p.name, p.sku, p.price_retail, p.price_cost, p.images, p.stock_quantity
     FROM product_combos pc
     JOIN products p ON p.id = pc.child_product_id
     WHERE pc.combo_product_id = ?`,
    [req.params.id]
  );
  return rows.map(r => ({
    ...r,
    images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images
  }));
});


// ─── Products (write) ──────────────────────────────────────────────────────

// Batch upsert — used by Bling import and admin writes
fastify.post('/products/batch', { preHandler: requireSyncKey }, async (req, reply) => {
  const products = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return reply.code(400).send({ error: 'Expected non-empty array' });
  }

  const results = { upserted: 0, errors: [] };

  for (const p of products) {
    try {
      await pool.query(
        `INSERT INTO products (
          id, name, slug, sku, ean, alternative_eans, description,
          price_retail, price_wholesale, price_cost, price_reseller,
          price_promo, promo_start, promo_end,
          stock_quantity, status, category_id, brand, model_id,
          images, specs, custom_fields, dimensions, weight_kg,
          ncm, cest, origin, bling_id, bling_parent_id, parent_id,
          video_url, track_inventory, is_gift, is_virtual,
          warranty_type, warranty_template_id, company_id, kits,
          meta_title, meta_description, keywords, exclude_from_seo
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          name=VALUES(name), slug=VALUES(slug), sku=VALUES(sku),
          ean=VALUES(ean), alternative_eans=VALUES(alternative_eans),
          description=VALUES(description),
          price_retail=VALUES(price_retail), price_wholesale=VALUES(price_wholesale),
          price_cost=VALUES(price_cost), price_reseller=VALUES(price_reseller),
          price_promo=VALUES(price_promo), promo_start=VALUES(promo_start),
          promo_end=VALUES(promo_end),
          stock_quantity=VALUES(stock_quantity), status=VALUES(status),
          category_id=VALUES(category_id), brand=VALUES(brand),
          model_id=VALUES(model_id), images=VALUES(images),
          specs=VALUES(specs), custom_fields=VALUES(custom_fields),
          dimensions=VALUES(dimensions), weight_kg=VALUES(weight_kg),
          ncm=VALUES(ncm), cest=VALUES(cest), origin=VALUES(origin),
          bling_id=VALUES(bling_id), bling_parent_id=VALUES(bling_parent_id),
          parent_id=VALUES(parent_id), video_url=VALUES(video_url),
          track_inventory=VALUES(track_inventory), is_gift=VALUES(is_gift),
          is_virtual=VALUES(is_virtual),
          warranty_type=VALUES(warranty_type),
          warranty_template_id=VALUES(warranty_template_id),
          kits=VALUES(kits), exclude_from_seo=VALUES(exclude_from_seo),
          meta_title=VALUES(meta_title), meta_description=VALUES(meta_description), keywords=VALUES(keywords),
          updated_at=CURRENT_TIMESTAMP`,
        [
          p.id, p.name, p.slug || null, p.sku || null,
          p.ean || null, jsonStr(p.alternative_eans), p.description || null,
          p.price_retail || null, p.price_wholesale || null,
          p.price_cost || null, p.price_reseller || null,
          p.price_promo || null, p.promo_start || null, p.promo_end || null,
          p.stock_quantity || 0, p.status || 'active',
          p.category_id || null, p.brand || null, p.model_id || null,
          jsonStr(p.images), jsonStr(p.specs), jsonStr(p.custom_fields),
          jsonStr(p.dimensions), p.weight_kg || null,
          p.ncm || null, p.cest || null, p.origin || null,
          p.bling_id || null, p.bling_parent_id || null, p.parent_id || null,
          p.video_url || null,
          p.track_inventory ? 1 : 0, p.is_gift ? 1 : 0, p.is_virtual ? 1 : 0,
          p.warranty_type || 'brand', p.warranty_template_id || null,
          p.company_id || null, jsonStr(p.kits),
          p.meta_title || null, p.meta_description || null, p.keywords || null, p.exclude_from_seo ? 1 : 0,
        ]
      );
      results.upserted++;
    } catch (err) {
      results.errors.push({ id: p.id, name: p.name, error: err.message });
    }
  }

  return results;
});

// Single product update
fastify.put('/products/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const p = req.body;
  await pool.query(
    `UPDATE products SET
      name=?, slug=?, sku=?, ean=?, alternative_eans=?,
      price_retail=?, price_wholesale=?, price_cost=?, price_reseller=?,
      price_promo=?, promo_start=?, promo_end=?,
      stock_quantity=?, status=?, category_id=?, brand=?, model_id=?,
      images=?, specs=?, custom_fields=?, dimensions=?, weight_kg=?,
      ncm=?, cest=?, origin=?, bling_id=?, bling_parent_id=?, parent_id=?,
      video_url=?, track_inventory=?, is_gift=?,
      warranty_type=?, warranty_template_id=?, kits=?,
      meta_title=?, meta_description=?, keywords=?, exclude_from_seo=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?`,
    [
      p.name, p.slug || null, p.sku || null,
      p.ean || null, jsonStr(p.alternative_eans),
      p.price_retail || null, p.price_wholesale || null,
      p.price_cost || null, p.price_reseller || null,
      p.price_promo || null, p.promo_start || null, p.promo_end || null,
      p.stock_quantity || 0, p.status || 'active',
      p.category_id || null, p.brand || null, p.model_id || null,
      jsonStr(p.images), jsonStr(p.specs), jsonStr(p.custom_fields),
      jsonStr(p.dimensions), p.weight_kg || null,
      p.ncm || null, p.cest || null, p.origin || null,
      p.bling_id || null, p.bling_parent_id || null, p.parent_id || null,
      p.video_url || null,
      p.track_inventory ? 1 : 0, p.is_gift ? 1 : 0,
      p.warranty_type || 'brand', p.warranty_template_id || null, jsonStr(p.kits),
      p.meta_title || null, p.meta_description || null, p.keywords || null, p.exclude_from_seo ? 1 : 0,
      req.params.id,
    ]
  );
  return { ok: true };
});

// Delete product (and children)
fastify.delete('/products/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query(`DELETE FROM products WHERE id=? OR parent_id=?`, [req.params.id, req.params.id]);
  return { ok: true };
});

// Update images by SKU (used by image bank sync)
fastify.patch('/products/images', { preHandler: requireSyncKey }, async (req, reply) => {
  const { sku, images } = req.body || {};
  if (!sku || !images) return reply.code(400).send({ error: 'sku and images required' });
  const [result] = await pool.query(
    'UPDATE products SET images=?, updated_at=CURRENT_TIMESTAMP WHERE sku=?',
    [JSON.stringify(images), sku]
  );
  // affectedRows=0 means the SKU doesn't exist in VPS MySQL yet
  return { ok: true, affectedRows: result.affectedRows };
});

// Update description + technical_specifications by SKU (used by description sync)
fastify.patch('/products/description', { preHandler: requireSyncKey }, async (req, reply) => {
  const { sku, description, technical_specifications } = req.body || {};
  if (!sku) return reply.code(400).send({ error: 'sku required' });
  const [result] = await pool.query(
    'UPDATE products SET description=?, technical_specifications=?, updated_at=CURRENT_TIMESTAMP WHERE sku=?',
    [description ?? null, technical_specifications ?? null, sku]
  );
  return { ok: true, affectedRows: result.affectedRows };
});

// Update stock_quantity by SKU (used by Bling webhook — estoque event)
fastify.patch('/products/stock', { preHandler: requireSyncKey }, async (req, reply) => {
  const { sku, stock_quantity } = req.body || {};
  if (!sku) return reply.code(400).send({ error: 'sku required' });
  if (stock_quantity === undefined || stock_quantity === null) return reply.code(400).send({ error: 'stock_quantity required' });
  const [result] = await pool.query(
    'UPDATE products SET stock_quantity=?, updated_at=CURRENT_TIMESTAMP WHERE sku=?',
    [Math.max(0, parseInt(stock_quantity, 10) || 0), sku]
  );
  return { ok: true, affectedRows: result.affectedRows };
});

// Update product name by SKU (used by Bling webhook — produto event)
fastify.patch('/products/name', { preHandler: requireSyncKey }, async (req, reply) => {
  const { sku, name } = req.body || {};
  if (!sku || !name) return reply.code(400).send({ error: 'sku and name required' });
  const [result] = await pool.query(
    'UPDATE products SET name=?, updated_at=CURRENT_TIMESTAMP WHERE sku=?',
    [name, sku]
  );
  return { ok: true, affectedRows: result.affectedRows };
});


fastify.patch('/products/:id/seo', { preHandler: requireSyncKey }, async (req, reply) => {
  const { exclude_from_seo } = req.body;
  await pool.query(
    'UPDATE products SET exclude_from_seo=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [exclude_from_seo ? 1 : 0, req.params.id]
  );
  return { ok: true };
});

// ─── Combos (write) ─────────────────────────────────────────────────────────

fastify.post('/combos', { preHandler: requireSyncKey }, async (req, reply) => {
  // expects body to be a Product payload + `combo_children` (array of { id, quantity })
  const p = req.body;
  const id = p.id || require('crypto').randomUUID();
  const children = p.combo_children || [];
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO products (
        id, name, slug, sku, is_combo, combo_discount_type, combo_discount_value,
        price_retail, price_wholesale, price_cost, price_reseller,
        status, track_inventory, images, category_id, brand,
        description, specs, dimensions, weight_kg, is_virtual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, p.name, p.slug || null, p.sku || null, 1, p.combo_discount_type || null, p.combo_discount_value || 0,
        p.price_retail || 0, p.price_wholesale || 0, p.price_cost || 0, p.price_reseller || 0,
        p.status || 'active', p.track_inventory ? 1 : 0, jsonStr(p.images), p.category_id || null, p.brand || null,
        p.description || null, jsonStr({ technical_specifications: p.technical_specifications, tags: p.tags }), jsonStr(p.dimensions), p.weight_kg || null, p.is_virtual ? 1 : 0
      ]
    );

    for (const child of children) {
      const pcId = require('crypto').randomUUID();
      await connection.query(
        `INSERT INTO product_combos (id, combo_product_id, child_product_id, quantity) VALUES (?, ?, ?, ?)`,
        [pcId, id, child.id, child.quantity || 1]
      );
    }
    
    await connection.commit();
    reply.code(201).send({ ok: true, id });
  } catch (err) {
    await connection.rollback();
    reply.code(500).send({ error: err.message });
  } finally {
    connection.release();
  }
});

fastify.put('/combos/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const p = req.body;
  const comboId = req.params.id;
  const children = p.combo_children || [];
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE products SET 
        name=?, slug=?, sku=?, is_combo=1, combo_discount_type=?, combo_discount_value=?,
        price_retail=?, price_wholesale=?, price_cost=?, price_reseller=?,
        status=?, images=?, category_id=?, brand=?, description=?, specs=?, dimensions=?, weight_kg=?, is_virtual=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [
        p.name, p.slug || null, p.sku || null, p.combo_discount_type || null, p.combo_discount_value || 0,
        p.price_retail || 0, p.price_wholesale || 0, p.price_cost || 0, p.price_reseller || 0,
        p.status || 'active', jsonStr(p.images), p.category_id || null, p.brand || null,
        p.description || null, jsonStr({ technical_specifications: p.technical_specifications, tags: p.tags }), jsonStr(p.dimensions), p.weight_kg || null, p.is_virtual ? 1 : 0,
        comboId
      ]
    );

    await connection.query(`DELETE FROM product_combos WHERE combo_product_id = ?`, [comboId]);

    for (const child of children) {
      const pcId = require('crypto').randomUUID();
      await connection.query(
        `INSERT INTO product_combos (id, combo_product_id, child_product_id, quantity) VALUES (?, ?, ?, ?)`,
        [pcId, comboId, child.id, child.quantity || 1]
      );
    }
    
    await connection.commit();
    reply.send({ ok: true, id: comboId });
  } catch (err) {
    await connection.rollback();
    reply.code(500).send({ error: err.message });
  } finally {
    connection.release();
  }
});


// ─── Image Bank ────────────────────────────────────────────────────────────

// POST /images/upload — salva arquivo no filesystem
// multipart/form-data: file (binary) + path (string)
fastify.post('/images/upload', { preHandler: requireSyncKey }, async (req, reply) => {
  const parts = req.parts();
  let fileBuf = null;
  let filePath = null;

  for await (const part of parts) {
    if (part.type === 'file' && part.fieldname === 'file') {
      const chunks = [];
      for await (const chunk of part.file) chunks.push(chunk);
      fileBuf = Buffer.concat(chunks);
    } else if (part.fieldname === 'path') {
      filePath = part.value;
    }
  }

  if (!fileBuf || !filePath) return reply.code(400).send({ error: 'file and path required' });

  // Sanitize: allow only products/{SKU}/{filename}.webp paths
  const safe = path.normalize(filePath).replace(/^\/+/, '');
  if (safe.startsWith('..') || !safe.startsWith('products/')) {
    return reply.code(400).send({ error: 'Invalid path' });
  }

  const dest = path.join(UPLOADS_DIR, safe);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, fileBuf);

  const url = `${process.env.API_BASE_URL || 'https://api.xiaomipetrolina.com.br'}/images/${safe}`;
  return { ok: true, url, path: safe };
});

// GET /images/list?prefix=products/SKU — lista arquivos (recursivo) num prefixo
fastify.get('/images/list', async (req, reply) => {
  const prefix = (req.query.prefix || 'products').replace(/^\/+/, '');
  const dir = path.join(UPLOADS_DIR, prefix);
  const baseUrl = process.env.API_BASE_URL || 'https://api.xiaomipetrolina.com.br';

  if (!fs.existsSync(dir)) return [];

  function walkDir(d) {
    const entries = [];
    for (const item of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, item.name);
      if (item.isDirectory()) entries.push(...walkDir(full));
      else if (item.name.endsWith('.webp')) {
        const rel = path.relative(UPLOADS_DIR, full).replace(/\\/g, '/');
        entries.push({ path: rel, url: `${baseUrl}/images/${rel}`, filename: item.name });
      }
    }
    return entries;
  }

  reply.header('Cache-Control', 'no-store');
  return walkDir(dir);
});

// DELETE /images/file — remove arquivo
fastify.delete('/images/file', { preHandler: requireSyncKey }, async (req, reply) => {
  const filePath = req.body?.path;
  if (!filePath) return reply.code(400).send({ error: 'path required' });

  const safe = path.normalize(filePath).replace(/^\/+/, '');
  if (safe.startsWith('..') || !safe.startsWith('products/')) {
    return reply.code(400).send({ error: 'Invalid path' });
  }

  const dest = path.join(UPLOADS_DIR, safe);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  return { ok: true };
});

// ─── Company Settings ──────────────────────────────────────────────────────
fastify.get('/company-settings', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM company_settings LIMIT 1');
  reply.header('Cache-Control', 'no-store');
  return rows[0] || null;
});

// ─── Company Settings (PATCH) ─────────────────────────────────────────────
fastify.patch('/company-settings', { preHandler: requireSyncKey }, async (req, reply) => {
  const ALLOWED = [
    'company_name', 'address', 'phone', 'cnpj', 'email', 'header_text', 'footer_text',
    'warranty_terms', 'receipt_logo_url', 'receipt_width', 'show_company_info',
    'show_order_number', 'show_timestamp', 'show_seller_info', 'warranty_template',
    'warranty_show_logo', 'warranty_show_company_name', 'warranty_show_cnpj',
    'warranty_show_phone', 'warranty_show_email', 'warranty_show_address',
    'payment_receipt_template', 'receipt_extra_page_text', 'receipt_extra_page_qr_url',
    'receipt_show_extra_page', 'extended_warranty_options', 'extended_warranty_terms_text',
    'pix_discount_percentage', 'default_a4_header', 'default_thermal_header',
    'debt_clearance_template', 'delivery_receipt_template', 'extended_warranty_template',
    'ai_prompts', 'business_hours', 'holiday_overrides', 'local_holidays',
    'business_hours_display_text',
    'store_label_open', 'store_label_closed', 'store_label_closing_soon', 'store_label_lunch',
    'synology_video_base_url', 'synology_video_extension',

    // Campos de Identidade / Dados Gerais (usados por companyToRow em companyService.ts)
    'name', 'razao_social', 'state_registration', 'cnae', 'situacao_cadastral',
    'data_abertura', 'porte', 'logo', 'watermark_url', 'favicon',
    
    // Shopee Integration
    'shopee_partner_id', 'shopee_partner_key', 'shopee_shop_id', 
    'shopee_access_token', 'shopee_refresh_token',

    // Campos de Endereço Extensos
    'address_zip_code', 'address_street', 'address_number', 'address_complement',
    'address_neighborhood', 'address_city', 'address_state', 'address_lat', 'address_lng',
    
    // Redes Sociais e Contatos Visuais
    'social_instagram', 'social_facebook', 'social_youtube', 'social_website',
    'google_reviews_link',
    
    // Dados Financeiros
    'pix_key', 'pix_key_type', 'pix_beneficiary_name',
    'bank_name', 'bank_agency', 'bank_account',
    
    // Campos adicionais e integrações
    'description', 'internal_notes', 'google_analytics_id', 'catalog_footer_text',
    'maintenance_mode', 'maintenance_message', 'maintenance_bypass_key',
    'about_us_text', 'about_us_image_url'
  ];
  const body = req.body;
  const updates = [];
  const params = [];
  for (const key of ALLOWED) {
    if (key in body) {
      const val = body[key];
      updates.push(`${key} = ?`);
      params.push(val !== null && typeof val === 'object' ? JSON.stringify(val) : val);
    }
  }
  if (updates.length === 0) return reply.code(400).send({ error: 'No valid fields to update' });
  const [existing] = await pool.query('SELECT id FROM company_settings LIMIT 1');
  if (existing.length === 0) return reply.code(404).send({ error: 'No company settings found' });
  params.push(existing[0].id);
  await pool.query(`UPDATE company_settings SET ${updates.join(', ')} WHERE id = ?`, params);
  const [rows] = await pool.query('SELECT * FROM company_settings WHERE id = ?', [existing[0].id]);
  return rows[0];
});

// ─── Versions CRUD ───────────────────────────────────────────────────────────
fastify.get('/versions', async (req, reply) => {
  const active = req.query.active;
  let sql = 'SELECT * FROM versions';
  const params = [];
  if (active !== undefined) { sql += ' WHERE active = ?'; params.push(Number(active)); }
  sql += ' ORDER BY name';
  const [rows] = await pool.query(sql, params);
  return rows;
});

fastify.get('/versions/:id', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM versions WHERE id = ?', [req.params.id]);
  return rows[0] || reply.code(404).send({ error: 'Not found' });
});

fastify.post('/versions', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name, active = 1 } = req.body;
  const id = require('crypto').randomUUID();
  await pool.query('INSERT INTO versions (id, name, active) VALUES (?, ?, ?)', [id, name, active ? 1 : 0]);
  const [rows] = await pool.query('SELECT * FROM versions WHERE id = ?', [id]);
  reply.code(201);
  return rows[0];
});

fastify.patch('/versions/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name, active } = req.body;
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (!updates.length) return reply.code(400).send({ error: 'No fields to update' });
  params.push(req.params.id);
  await pool.query(`UPDATE versions SET ${updates.join(', ')} WHERE id = ?`, params);
  const [rows] = await pool.query('SELECT * FROM versions WHERE id = ?', [req.params.id]);
  return rows[0] || reply.code(404).send({ error: 'Not found' });
});

fastify.delete('/versions/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const [result] = await pool.query('DELETE FROM versions WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) return reply.code(404).send({ error: 'Not found' });
  return { ok: true };
});
// ─── Table Data Viewer (protegido por X-Sync-Key) ────────────────────────────
fastify.get('/table-data/:name', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  // Validar nome da tabela (apenas chars seguros)
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return reply.code(400).send({ error: 'Invalid table name' });
  }

  const [[countRow]] = await pool.query(`SELECT COUNT(*) as total FROM \`${name}\``);
  const [rows] = await pool.query(`SELECT * FROM \`${name}\` LIMIT ? OFFSET ?`, [limit, offset]);

  return {
    table: name,
    total: Number(countRow.total),
    limit,
    offset,
    rows,
  };
});

// ─── Relatório Administrativo: Ranking de Favoritos ──────────────────────────
fastify.get('/admin/reports/favorites-ranking', { preHandler: requireSyncKey }, async (req, reply) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const sql = `
      SELECT 
        cf.product_id, 
        COUNT(cf.customer_id) as favorite_count,
        p.name, p.sku, p.images, p.price_retail, p.stock_quantity
      FROM customer_favorites cf
      JOIN products p ON p.id = cf.product_id
      GROUP BY cf.product_id
      ORDER BY favorite_count DESC
      LIMIT ?
    `;
    const [rows] = await pool.query(sql, [limit]);
    
    // Parse JSON images
    const result = rows.map(r => ({
      ...r,
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || [])
    }));
    
    return result;
  } catch (error) {
    console.error('Error fetching favorites ranking:', error);
    reply.code(500).send({ error: 'Failed to fetch favorites ranking' });
  }
});

// ─── Relatório Administrativo: Ranking de Carrinhos ──────────────────────────
fastify.get('/admin/reports/carts-ranking', { preHandler: requireSyncKey }, async (req, reply) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const sql = `
      SELECT 
        cc.product_id, 
        COUNT(DISTINCT cc.customer_id) as cart_count,
        SUM(cc.quantity) as total_quantity,
        p.name, p.sku, p.images, p.price_retail, p.stock_quantity
      FROM customer_carts cc
      JOIN products p ON p.id = cc.product_id
      GROUP BY cc.product_id
      ORDER BY cart_count DESC, total_quantity DESC
      LIMIT ?
    `;
    const [rows] = await pool.query(sql, [limit]);
    
    // Parse JSON images
    const result = rows.map(r => ({
      ...r,
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || [])
    }));
    
    return result;
  } catch (error) {
    console.error('Error fetching carts ranking:', error);
    reply.code(500).send({ error: 'Failed to fetch carts ranking' });
  }
});

// ─── Sincronização de Carrinho do Cliente ───────────────────────────────────────
fastify.post('/cart/sync', { preHandler: requireSyncKey }, async (req, reply) => {
  const { customerId, items } = req.body;
  if (!customerId || !Array.isArray(items)) {
    return reply.code(400).send({ error: 'customerId and items array required' });
  }

  const connection = await pool.getConnection();
  try {
    // Basic table creation check
    await connection.query(`CREATE TABLE IF NOT EXISTS customer_carts (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id VARCHAR(255) NOT NULL,
      product_id CHAR(36) NOT NULL,
      quantity INT DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_unique_cart (customer_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

    await connection.beginTransaction();

    // Remove old cart items for this customer
    await connection.query('DELETE FROM customer_carts WHERE customer_id = ?', [customerId]);

    // Insert new cart items
    if (items.length > 0) {
      const values = items.map(i => [customerId, i.product_id, i.quantity]);
      await connection.query(
        'INSERT INTO customer_carts (customer_id, product_id, quantity) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    return { ok: true, synced: items.length };
  } catch (error) {
    await connection.rollback();
    console.error('Error syncing cart:', error);
    reply.code(500).send({ error: 'Failed to sync cart' });
  } finally {
    connection.release();
  }
});

// ─── Table CRUD (protegido por X-Sync-Key) ───────────────────────────────────

// Helper: detectar PK de uma tabela
async function getPrimaryKey(pool, tableName) {
  const [keys] = await pool.query(
    `SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'`
  );
  return keys[0]?.Column_name || 'id';
}

// Validação de nome de tabela
function isValidTable(name) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

// INSERT individual
fastify.post('/table-data/:name', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reply.code(400).send({ error: 'Body must be a JSON object' });
  }

  const cols = Object.keys(body);
  const vals = Object.values(body);
  const placeholders = cols.map(() => '?').join(', ');
  const colList = cols.map(c => `\`${c}\``).join(', ');

  await pool.query(
    `INSERT INTO \`${name}\` (${colList}) VALUES (${placeholders})`,
    vals
  );

  const pk = await getPrimaryKey(pool, name);
  const [rows] = await pool.query(
    `SELECT * FROM \`${name}\` WHERE \`${pk}\` = ? LIMIT 1`,
    [body[pk] ?? vals[0]]
  );

  reply.code(201);
  return rows[0] || { ok: true };
});

// INSERT em massa (array de objetos)
fastify.post('/table-data/:name/bulk', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return reply.code(400).send({ error: 'Body must be a non-empty array' });
  }

  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `\`${c}\``).join(', ');
  const placeholders = `(${cols.map(() => '?').join(', ')})`;
  const allPlaceholders = rows.map(() => placeholders).join(', ');
  const allValues = rows.flatMap(r => cols.map(c => r[c] ?? null));

  await pool.query(
    `INSERT INTO \`${name}\` (${colList}) VALUES ${allPlaceholders}`,
    allValues
  );

  return { inserted: rows.length };
});

// UPDATE por PK
fastify.patch('/table-data/:name/:pkValue', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name, pkValue } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const pkCol = req.query.pk || await getPrimaryKey(pool, name);
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reply.code(400).send({ error: 'Body must be a JSON object' });
  }

  const entries = Object.entries(body).filter(([k]) => k !== pkCol);
  if (!entries.length) return reply.code(400).send({ error: 'No fields to update' });

  const setClauses = entries.map(([k]) => `\`${k}\` = ?`).join(', ');
  const vals = [...entries.map(([, v]) => v), pkValue];

  await pool.query(`UPDATE \`${name}\` SET ${setClauses} WHERE \`${pkCol}\` = ?`, vals);

  const [rows] = await pool.query(`SELECT * FROM \`${name}\` WHERE \`${pkCol}\` = ? LIMIT 1`, [pkValue]);
  return rows[0] || reply.code(404).send({ error: 'Not found' });
});

// DELETE por PK
fastify.delete('/table-data/:name/:pkValue', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name, pkValue } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const pkCol = req.query.pk || await getPrimaryKey(pool, name);
  const [result] = await pool.query(`DELETE FROM \`${name}\` WHERE \`${pkCol}\` = ?`, [pkValue]);

  if (result.affectedRows === 0) return reply.code(404).send({ error: 'Row not found' });
  return { ok: true, deleted: 1 };
});

// EXPORT completo (para backup)
fastify.get('/table-data/:name/export', { preHandler: requireSyncKey }, async (req, reply) => {
  const { name } = req.params;
  if (!isValidTable(name)) return reply.code(400).send({ error: 'Invalid table name' });

  const [rows] = await pool.query(`SELECT * FROM \`${name}\``);
  reply.header('Content-Disposition', `attachment; filename="${name}.json"`);
  return rows;
});
﻿// --- Schema Inspector ---
fastify.get('/schema/tables', { preHandler: requireSyncKey }, async (req, reply) => {
  const [tables] = await pool.query('SHOW TABLES');
  const result = {};
  for (const row of tables) {
    const tableName = Object.values(row)[0];
    const [columns] = await pool.query('DESCRIBE ??', [tableName]);
    result[tableName] = columns.map(c => ({ field: c.Field, type: c.Type, null: c.Null, key: c.Key, default: c.Default }));
  }
  return result;
}); 
fastify.get('/schema/table/:name', { preHandler: requireSyncKey }, async (req, reply) => {
  const [columns] = await pool.query('DESCRIBE ??', [req.params.name]);
  return columns.map(c => ({ field: c.Field, type: c.Type, null: c.Null, key: c.Key, default: c.Default }));
});
// ─── Catalog Settings ──────────────────────────────────────────────────────
fastify.get('/catalog-settings', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM catalog_settings LIMIT 1');
  reply.header('Cache-Control', 'public, max-age=900, s-maxage=1800');
  return rows[0] || null;
});

// ─── VPS Status ─────────────────────────────────────────────────────────────
fastify.get('/status', async (req, reply) => {
  const t0 = Date.now();
  let mysqlOk = false; let mysqlMs = 0;
  let productTotal = 0; let productActive = 0;

  try {
    const t1 = Date.now();
    const [[row]] = await pool.query(
      `SELECT COUNT(*) as total, SUM(status='active') as active FROM products`
    );
    mysqlMs = Date.now() - t1;
    mysqlOk = true;
    productTotal  = Number(row.total);
    productActive = Number(row.active);
  } catch {}

  // Count images in uploads dir
  let imageCount = 0; let imagesSizeMb = 0;
  function walkCount(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkCount(full);
      else if (e.name.endsWith('.webp')) {
        imageCount++;
        try { imagesSizeMb += fs.statSync(full).size / 1048576; } catch {}
      }
    }
  }
  walkCount(UPLOADS_DIR);

  // Disk info via df
  let diskTotalGb = null; let diskFreeGb = null;
  try {
    const { execSync } = require('child_process');
    const out = execSync("df -k /var/www/mdv-api --output=size,avail 2>/dev/null | tail -1")
      .toString().trim().split(/\s+/);
    diskTotalGb = Math.round(Number(out[0]) / 1048576 * 10) / 10;
    diskFreeGb  = Math.round(Number(out[1]) / 1048576 * 10) / 10;
  } catch {}

  const m = process.memoryUsage();
  return {
    ok: true,
    uptime_seconds: Math.floor(process.uptime()),
    response_ms: Date.now() - t0,
    memory: {
      rss_mb:        Math.round(m.rss / 1048576),
      heap_used_mb:  Math.round(m.heapUsed / 1048576),
      heap_total_mb: Math.round(m.heapTotal / 1048576),
    },
    mysql: { ok: mysqlOk, ping_ms: mysqlMs },
    disk: { total_gb: diskTotalGb, free_gb: diskFreeGb },
    products: { total: productTotal, active: productActive },
    images: { total: imageCount, size_mb: Math.round(imagesSizeMb * 10) / 10 },
  };
});


// ─── Shipping Settings ──────────────────────────────────────────────────────
fastify.get('/shipping/settings', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM shipping_settings LIMIT 1');
  reply.header('Cache-Control', 'public, max-age=300');
  if (!rows[0]) return null;
  const row = rows[0];
  // extra_config: mysql2 retorna JSON column como string em algumas versões
  if (row.extra_config && typeof row.extra_config === 'string') {
    try { row.extra_config = JSON.parse(row.extra_config); } catch { row.extra_config = null; }
  }
  return row;
});

fastify.patch('/shipping/settings', { preHandler: requireSyncKey }, async (req, reply) => {
  const s = req.body;
  const [rows] = await pool.query('SELECT id FROM shipping_settings LIMIT 1');
  if (rows.length === 0) {
    await pool.query(
      `INSERT INTO shipping_settings (id,origin_cep,origin_label,secondary_origin_cep,secondary_origin_label,
       melhor_envio_token,melhor_envio_sandbox,melhor_envio_enabled,melhor_envio_allowed_services,
       frenet_token,frenet_enabled,local_delivery_enabled,
       enable_progressive_shipping_subsidy,min_order_value_for_subsidy,
       default_subsidy_discount_percent,profit_margin_percentage_cap,extra_config)
       VALUES (UUID(),?,?,?,?,?,?,?,?,?,?,?,
       ?,?,?,?,?)`,
      [s.origin_cep,s.origin_label,s.secondary_origin_cep,s.secondary_origin_label,
       s.melhor_envio_token,s.melhor_envio_sandbox?1:0,s.melhor_envio_enabled?1:0,
       s.melhor_envio_allowed_services,s.frenet_token,s.frenet_enabled?1:0,s.local_delivery_enabled?1:0,
       s.enable_progressive_shipping_subsidy?1:0, s.min_order_value_for_subsidy||0,
       s.default_subsidy_discount_percent!=null?s.default_subsidy_discount_percent:100,
       s.profit_margin_percentage_cap!=null?s.profit_margin_percentage_cap:20,
       s.extra_config!=null?JSON.stringify(s.extra_config):null]
    );
  } else {
    await pool.query(
      `UPDATE shipping_settings SET
       origin_cep=COALESCE(?,origin_cep), origin_label=COALESCE(?,origin_label),
       secondary_origin_cep=COALESCE(?,secondary_origin_cep), secondary_origin_label=COALESCE(?,secondary_origin_label),
       melhor_envio_token=COALESCE(?,melhor_envio_token), melhor_envio_sandbox=COALESCE(?,melhor_envio_sandbox),
       melhor_envio_enabled=COALESCE(?,melhor_envio_enabled), melhor_envio_allowed_services=COALESCE(?,melhor_envio_allowed_services),
       frenet_token=COALESCE(?,frenet_token), frenet_enabled=COALESCE(?,frenet_enabled),
       local_delivery_enabled=COALESCE(?,local_delivery_enabled),
       enable_progressive_shipping_subsidy=COALESCE(?,enable_progressive_shipping_subsidy),
       min_order_value_for_subsidy=COALESCE(?,min_order_value_for_subsidy),
       default_subsidy_discount_percent=COALESCE(?,default_subsidy_discount_percent),
       profit_margin_percentage_cap=COALESCE(?,profit_margin_percentage_cap),
       extra_config=COALESCE(?,extra_config),
       updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [s.origin_cep,s.origin_label,s.secondary_origin_cep,s.secondary_origin_label,
       s.melhor_envio_token,s.melhor_envio_sandbox!=null?s.melhor_envio_sandbox?1:0:null,
       s.melhor_envio_enabled!=null?s.melhor_envio_enabled?1:0:null,s.melhor_envio_allowed_services,
       s.frenet_token,s.frenet_enabled!=null?s.frenet_enabled?1:0:null,
       s.local_delivery_enabled!=null?s.local_delivery_enabled?1:0:null,
       s.enable_progressive_shipping_subsidy!=null?s.enable_progressive_shipping_subsidy?1:0:null,
       s.min_order_value_for_subsidy,
       s.default_subsidy_discount_percent,
       s.profit_margin_percentage_cap,
       s.extra_config!=null?JSON.stringify(s.extra_config):null,
       rows[0].id]
    );
  }
  return { ok: true };
});

// ─── Shipping Zones ─────────────────────────────────────────────────────────
fastify.get('/shipping/zones', async (req, reply) => {
  const [zones] = await pool.query(
    `SELECT z.*, JSON_ARRAYAGG(
       IF(r.id IS NULL, NULL, JSON_OBJECT('id',r.id,'min_order',r.min_order,'max_order',r.max_order,'price',r.price))
     ) as price_ranges
     FROM shipping_zones z
     LEFT JOIN shipping_price_ranges r ON r.zone_id = z.id
     GROUP BY z.id
     ORDER BY z.display_order ASC`
  );
  reply.header('Cache-Control', 'public, max-age=300');
  return zones.map(z => ({
    ...z,
    enabled: z.enabled === 1,
    cities: z.cities ? JSON.parse(z.cities) : null,
    cep_ranges: z.cep_ranges ? JSON.parse(z.cep_ranges) : null,
    price_ranges: (z.price_ranges ? JSON.parse(z.price_ranges) : []).filter(Boolean),
  }));
});

fastify.post('/shipping/zones', { preHandler: requireSyncKey }, async (req, reply) => {
  const z = req.body;
  const id = z.id || require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO shipping_zones (id,name,type,enabled,cities,cep_ranges,max_km_free,price_per_km,fixed_price,min_order_free,estimated_days_min,estimated_days_max,display_order)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,z.name,z.type,z.enabled?1:0,jsonStr(z.cities),jsonStr(z.cep_ranges),
     z.max_km_free||null,z.price_per_km||null,z.fixed_price||null,z.min_order_free||null,
     z.estimated_days_min||null,z.estimated_days_max||null,z.display_order||0]
  );
  return { ok: true, id };
});

fastify.patch('/shipping/zones/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const z = req.body;
  await pool.query(
    `UPDATE shipping_zones SET name=?,type=?,enabled=?,cities=?,cep_ranges=?,max_km_free=?,price_per_km=?,
     fixed_price=?,min_order_free=?,estimated_days_min=?,estimated_days_max=?,display_order=?,updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [z.name,z.type,z.enabled?1:0,jsonStr(z.cities),jsonStr(z.cep_ranges),
     z.max_km_free||null,z.price_per_km||null,z.fixed_price||null,z.min_order_free||null,
     z.estimated_days_min||null,z.estimated_days_max||null,z.display_order||0,req.params.id]
  );
  return { ok: true };
});

fastify.delete('/shipping/zones/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM shipping_zones WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Payment Fees ───────────────────────────────────────────────────────────
fastify.get('/payment-fees', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT id, method, installments, operator_fee_pct, applied_fee_pct, channel, created_at, updated_at
     FROM payment_fees ORDER BY method ASC, installments ASC`
  );
  reply.header('Cache-Control', 'public, max-age=900');
  return rows;
});

fastify.put('/payment-fees', { preHandler: requireSyncKey }, async (req, reply) => {
  const fees = req.body;
  if (!Array.isArray(fees)) return reply.code(400).send({ error: 'Expected array' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM payment_fees');
    for (const f of fees) {
      const id = require('crypto').randomUUID();
      await conn.query(
        `INSERT INTO payment_fees (id, method, installments, operator_fee_pct, applied_fee_pct, channel)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, f.method, f.installments || 1, f.operator_fee_pct ?? 0, f.applied_fee_pct ?? 0, f.channel || 'presencial']
      );
    }
    await conn.commit();
    return { ok: true, count: fees.length };
  } catch (err) {
    await conn.rollback();
    reply.code(500).send({ error: err.message });
  } finally {
    conn.release();
  }
});

// ─── Coupons ────────────────────────────────────────────────────────────────
fastify.get('/coupons', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
  return rows.map(r => ({ ...r, active: r.active === 1 }));
});

fastify.get('/coupons/validate/:code', async (req, reply) => {
  const [rows] = await pool.query(
    `SELECT * FROM coupons WHERE code=? AND active=1
     AND (expires_at IS NULL OR expires_at > NOW())
     AND (max_uses IS NULL OR uses_count < max_uses)`,
    [req.params.code.toUpperCase()]
  );
  if (!rows.length) return reply.code(404).send({ error: 'Cupom inválido ou expirado' });
  return { ...rows[0], active: rows[0].active === 1 };
});

fastify.post('/coupons', { preHandler: requireSyncKey }, async (req, reply) => {
  const c = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO coupons (id,code,type,value,min_order,max_uses,expires_at,active,target_type)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id,c.code.toUpperCase(),c.type,c.value,c.min_order||0,c.max_uses||null,c.expires_at||null,c.active?1:0,c.target_type||'all']
  );
  return { ok: true, id };
});

fastify.patch('/coupons/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const c = req.body;
  await pool.query(
    `UPDATE coupons SET code=?,type=?,value=?,min_order=?,max_uses=?,expires_at=?,active=?,target_type=?,updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [c.code.toUpperCase(),c.type,c.value,c.min_order||0,c.max_uses||null,c.expires_at||null,c.active?1:0,c.target_type||'all',req.params.id]
  );
  return { ok: true };
});

fastify.delete('/coupons/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM coupons WHERE id=?', [req.params.id]);
  return { ok: true };
});

// POST /coupons/:code/use — incrementa uses_count
fastify.post('/coupons/:code/use', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query(`UPDATE coupons SET uses_count=uses_count+1 WHERE code=?`, [req.params.code]);
  return { ok: true };
});

// ─── Banners ────────────────────────────────────────────────────────────────
fastify.get('/banners', async (req, reply) => {
  const where = req.query.active === 'true' ? 'WHERE active=1' : '';
  const [rows] = await pool.query(
    `SELECT * FROM banners ${where} ORDER BY display_order ASC, created_at DESC`
  );
  reply.header('Cache-Control', 'public, max-age=120');
  return rows.map(r => ({ ...r, active: r.active === 1 }));
});

fastify.post('/banners', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO banners (id,title,image_url,link_url,active,display_order,start_date,end_date)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id,b.title||null,b.image_url||null,b.link_url||b.link_target||null,b.active?1:0,b.display_order||0,b.start_date||null,b.end_date||null]
  );
  return { ok: true, id };
});

fastify.patch('/banners/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const b = req.body;
  await pool.query(
    `UPDATE banners SET title=?,image_url=?,link_url=?,active=?,display_order=?,start_date=?,end_date=?
     WHERE id=?`,
    [b.title||null,b.image_url||null,b.link_url||b.link_target||null,b.active?1:0,b.display_order||0,b.start_date||null,b.end_date||null,req.params.id]
  );
  return { ok: true };
});

fastify.delete('/banners/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM banners WHERE id=?', [req.params.id]);
  return { ok: true };
});

fastify.post('/banners/:id/click', async (req, reply) => {
  await pool.query(`UPDATE banners SET click_count=COALESCE(click_count,0)+1 WHERE id=?`, [req.params.id]);
  return { ok: true };
});

fastify.post('/banners/:id/view', async (req, reply) => {
  await pool.query(`UPDATE banners SET view_count=COALESCE(view_count,0)+1 WHERE id=?`, [req.params.id]);
  return { ok: true };
});

// POST /banners/upload — upload de imagem de banner
fastify.post('/banners/upload', { preHandler: requireSyncKey }, async (req, reply) => {
  const parts = req.parts();
  let fileBuf = null; let origName = 'banner.webp';
  for await (const part of parts) {
    if (part.type === 'file' && part.fieldname === 'file') {
      origName = part.filename || origName;
      const chunks = [];
      for await (const chunk of part.file) chunks.push(chunk);
      fileBuf = Buffer.concat(chunks);
    }
  }
  if (!fileBuf) return reply.code(400).send({ error: 'file required' });
  const ext = path.extname(origName) || '.webp';
  const fname = `${Date.now()}${ext}`;
  const bannerDir = path.join(UPLOADS_DIR, 'banners');
  fs.mkdirSync(bannerDir, { recursive: true });
  fs.writeFileSync(path.join(bannerDir, fname), fileBuf);
  const baseUrl = process.env.API_BASE_URL || 'https://api.xiaomipetrolina.com.br';
  return { ok: true, url: `${baseUrl}/images/banners/${fname}`, path: `banners/${fname}` };
});

// ─── Warranty Templates ─────────────────────────────────────────────────────
fastify.get('/warranty-templates', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM warranty_templates ORDER BY name');
  reply.header('Cache-Control', 'public, max-age=900');
  return rows.map(r => ({ ...r, is_default: r.is_default === 1 }));
});

fastify.post('/warranty-templates', { preHandler: requireSyncKey }, async (req, reply) => {
  const t = req.body;
  const id = require('crypto').randomUUID();
  if (t.is_default) await pool.query('UPDATE warranty_templates SET is_default=0');
  await pool.query(
    `INSERT INTO warranty_templates (id,name,content,is_default) VALUES (?,?,?,?)`,
    [id, t.name, t.content||null, t.is_default?1:0]
  );
  return { ok: true, id };
});

fastify.patch('/warranty-templates/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const t = req.body;
  if (t.is_default) await pool.query('UPDATE warranty_templates SET is_default=0');
  await pool.query(
    `UPDATE warranty_templates SET name=?,content=?,is_default=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [t.name, t.content||null, t.is_default?1:0, req.params.id]
  );
  return { ok: true };
});

fastify.delete('/warranty-templates/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM warranty_templates WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── RAMs ───────────────────────────────────────────────────────────────────
fastify.get('/rams', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM rams WHERE active=1 ORDER BY value ASC');
  reply.header('Cache-Control', 'public, max-age=900');
  return rows;
});

fastify.get('/rams/all', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM rams ORDER BY value ASC');
  return rows;
});

fastify.post('/rams', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(`INSERT INTO rams (id,value,label,active) VALUES (?,?,?,?)`, [id,r.value,r.label,r.active?1:0]);
  return { ok: true, id };
});

fastify.patch('/rams/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  await pool.query(`UPDATE rams SET value=?,label=?,active=? WHERE id=?`, [r.value,r.label,r.active?1:0,req.params.id]);
  return { ok: true };
});

fastify.delete('/rams/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM rams WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Storages ───────────────────────────────────────────────────────────────
fastify.get('/storages', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM storages WHERE active=1 ORDER BY value ASC');
  reply.header('Cache-Control', 'public, max-age=900');
  return rows;
});

fastify.get('/storages/all', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM storages ORDER BY value ASC');
  return rows;
});

fastify.post('/storages', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(`INSERT INTO storages (id,value,label,active) VALUES (?,?,?,?)`, [id,r.value,r.label,r.active?1:0]);
  return { ok: true, id };
});

fastify.patch('/storages/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  await pool.query(`UPDATE storages SET value=?,label=?,active=? WHERE id=?`, [r.value,r.label,r.active?1:0,req.params.id]);
  return { ok: true };
});

fastify.delete('/storages/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM storages WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Battery Healths ────────────────────────────────────────────────────────
fastify.get('/battery-healths', async (req, reply) => {
  const [rows] = await pool.query('SELECT * FROM battery_healths ORDER BY value DESC');
  reply.header('Cache-Control', 'public, max-age=900');
  return rows;
});

fastify.post('/battery-healths', { preHandler: requireSyncKey }, async (req, reply) => {
  const r = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(`INSERT INTO battery_healths (id,value,label) VALUES (?,?,?)`, [id,r.value,r.label]);
  return { ok: true, id };
});

fastify.delete('/battery-healths/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM battery_healths WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Team Members ────────────────────────────────────────────────────────────────

const videoExistenceCache = new Map();
const VIDEO_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutos

// GET /public/check-video?sku=SKU — verifica existência via HEAD no CDN de vídeos
fastify.get('/public/check-video', async (req, reply) => {
  const sku = req.query.sku;
  if (!sku) return reply.code(400).send({ error: 'sku required' });

  const cleanSku = sku.trim().replace(/\s+/g, '');
  const [rows] = await pool.query('SELECT synology_video_extension FROM company_settings LIMIT 1').catch(() => [[]]);
  const ext = rows?.[0]?.synology_video_extension || '.mp4';
  const fileName = `${cleanSku}${ext}`;

  // Retorna do cache se ainda válido
  const cached = videoExistenceCache.get(cleanSku);
  if (cached && (Date.now() - cached.cachedAt) < VIDEO_CACHE_TTL_MS) {
    return reply.send({ exists: cached.exists, ...(cached.url ? { url: cached.url } : {}) });
  }

  const VPS_PUBLIC = process.env.VPS_PUBLIC_URL || 'https://api.xiaomipetrolina.com.br';
  const cdnBase = 'https://videos.mercadodovale.com.br';
  const cdnUrl = `${cdnBase}/${encodeURIComponent(fileName)}`;
  const proxyUrl = `${VPS_PUBLIC}/video/${encodeURIComponent(fileName)}`;

  // Verifica existência via HEAD no CDN (sem Synology DSM)
  const exists = await new Promise((resolve) => {
    const https = require('https');
    const r = https.request(cdnUrl, { method: 'HEAD', timeout: 8000 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    r.on('error', () => resolve(null));
    r.on('timeout', () => { r.destroy(); resolve(null); });
    r.end();
  });

  // Se o CDN não respondeu: fallback otimista (mostra botão como antes)
  if (exists === null) {
    console.error('[check-video] CDN timeout/error for', fileName, '- returning optimistic');
    return reply.send({ exists: true, url: proxyUrl });
  }

  const url = exists ? cdnUrl : null;
  videoExistenceCache.set(cleanSku, { exists, url, cachedAt: Date.now() });
  return reply.send({ exists, ...(url ? { url } : {}) });
});

fastify.get('/team', { preHandler: requireSyncKey }, async (req, reply) => {
  const [rows] = await pool.query('SELECT id,name,role,email,phone,active FROM team_members ORDER BY name');
  return rows.map(r => ({ ...r, active: r.active === 1 }));
});

fastify.post('/team', { preHandler: requireSyncKey }, async (req, reply) => {
  const m = req.body;
  const id = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO team_members (id,name,role,email,phone,active,pin) VALUES (?,?,?,?,?,?,?)`,
    [id,m.name,m.role||null,m.email||null,m.phone||null,m.active?1:0,m.pin||null]
  );
  return { ok: true, id };
});

fastify.patch('/team/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  const m = req.body;
  await pool.query(
    `UPDATE team_members SET name=?,role=?,email=?,phone=?,active=?,pin=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [m.name,m.role||null,m.email||null,m.phone||null,m.active?1:0,m.pin||null,req.params.id]
  );
  return { ok: true };
});

fastify.delete('/team/:id', { preHandler: requireSyncKey }, async (req, reply) => {
  await pool.query('DELETE FROM team_members WHERE id=?', [req.params.id]);
  return { ok: true };
});

// ─── Synology CDN Manager ──────────────────────────────────────────────────
// Rotas para gerenciar arquivos nos CDNs do Synology NAS
// Funciona de qualquer rede via QuickConnect (sem CORS: chamadas server-side)

const SYNO_URL  = process.env.SYNOLOGY_URL  || 'https://192-168-1-2.handielson.direct.quickconnect.to:5001';
const SYNO_USER = process.env.SYNOLOGY_USER || '';
const SYNO_PASS = process.env.SYNOLOGY_PASS || '';

const SYNO_FOLDERS = {
  imagens:  '/web/imagens',
  videos:   '/web/videos',
  arquivos: '/web/arquivos',
};
const SYNO_CDN = {
  imagens:  'https://imagens.xiaomipetrolina.com.br',
  videos:   'https://videos.mercadodovale.com.br',
  arquivos: 'https://arquivos.xiaomipetrolina.com.br',
};

function synoHttpGet(urlObj, path) {
  const https = require('https');
  const port = urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80);
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: urlObj.hostname, port, path, rejectUnauthorized: false }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Synology request timeout (15s)')); });
  });
}

async function synoLogin() {
  const qs = `api=SYNO.API.Auth&version=7&method=login&account=${encodeURIComponent(SYNO_USER)}&passwd=${encodeURIComponent(SYNO_PASS)}&session=FileStation&format=sid`;
  const urlObj = new URL(SYNO_URL);
  const j = await synoHttpGet(urlObj, `/webapi/auth.cgi?${qs}`);
  if (j.success) return j.data.sid;
  throw new Error('Synology login failed: ' + JSON.stringify(j.error));
}

async function synoApiGet(apiPath) {
  const urlObj = new URL(SYNO_URL);
  return synoHttpGet(urlObj, apiPath);
}




// GET /video/:filename — streaming proxy de vídeo do Synology (sem depender do CDN quebrado)
fastify.get('/video/:filename', async (req, reply) => {
  const { filename } = req.params;
  if (!filename || !filename.match(/^[\w\-. ]+\.(mp4|webm|mov|avi|mkv)$/i)) {
    return reply.code(400).send({ error: 'Invalid filename' });
  }
  if (!SYNO_USER || !SYNO_PASS) return reply.code(503).send({ error: 'Synology not configured' });

  try {
    const sid = await synoLogin();
    const filePath = encodeURIComponent(`${SYNO_FOLDERS['videos']}/${filename}`);
    const urlObj = new URL(SYNO_URL);
    const https = require('https');
    const downloadPath = `/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${filePath}&mode=stream&_sid=${sid}`;

    const headers = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const r = https.request({
      hostname: urlObj.hostname,
      port: parseInt(urlObj.port) || 5001,
      path: downloadPath,
      method: 'GET',
      headers: headers,
      rejectUnauthorized: false,
    }, (res) => {
      // Check if Synology returned a JSON API error instead of a file
      if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
        reply.raw.writeHead(404, { 'Content-Type': 'application/json' });
        res.pipe(reply.raw);
        return;
      }

      // Forward headers from Synology (important for 206 Partial Content and Content-Length)
      const replyHeaders = {
        'Cache-Control': 'public, max-age=3600',
        'Accept-Ranges': 'bytes',
      };
      
      if (res.headers['content-type']) replyHeaders['Content-Type'] = res.headers['content-type'];
      if (res.headers['content-length']) replyHeaders['Content-Length'] = res.headers['content-length'];
      if (res.headers['content-range']) replyHeaders['Content-Range'] = res.headers['content-range'];

      reply.raw.writeHead(res.statusCode || 200, replyHeaders);
      res.pipe(reply.raw);
    });
    r.on('error', (err) => { console.error('[video proxy] error:', err.message); });
    r.end();

    // Retorna sem value — o stream está sendo gerenciado manualmente
    await new Promise((resolve) => reply.raw.on('finish', resolve));
    return;
  } catch (err) {
    return reply.code(500).send({ error: 'Video unavailable' });
  }
});

// GET /synology/files?folder=imagens|videos|arquivos
fastify.get('/synology/files', { preHandler: requireSyncKey }, async (req, reply) => {
  const folder = req.query.folder;
  if (!SYNO_FOLDERS[folder]) return reply.code(400).send({ error: 'Invalid folder' });
  if (!SYNO_USER || !SYNO_PASS) return reply.code(500).send({ error: 'Synology credentials not configured in .env' });

  const sid = await synoLogin();
  const data = await synoApiGet(
    `/webapi/entry.cgi?api=SYNO.FileStation.List&version=2&method=list&folder_path=${encodeURIComponent(SYNO_FOLDERS[folder])}&additional=%5B%22size%22%2C%22time%22%5D&_sid=${sid}`
  );

  if (!data.success) return reply.code(500).send({ error: 'Failed to list files', detail: data.error });

  const cdn = SYNO_CDN[folder];
  const files = (data.data?.files || [])
    .filter(f => !f.isdir)
    .map(f => ({
      name: f.name,
      size: f.additional?.size || 0,
      modified: f.additional?.time?.mtime ? new Date(f.additional.time.mtime * 1000).toISOString() : null,
      url: `${cdn}/${f.name}`,
    }));

  reply.header('Cache-Control', 'no-store');
  return files;
});

// POST /synology/upload?folder=imagens|videos|arquivos
fastify.post('/synology/upload', { preHandler: requireSyncKey }, async (req, reply) => {
  const folder = req.query.folder;
  if (!SYNO_FOLDERS[folder]) return reply.code(400).send({ error: 'Invalid folder' });
  if (!SYNO_USER || !SYNO_PASS) return reply.code(500).send({ error: 'Synology credentials not configured' });

  const parts = req.parts({ limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB para vídeos
  let fileBuf = null;
  let fileName = null;

  for await (const part of parts) {
    if (part.type === 'file' && part.fieldname === 'file') {
      fileName = part.filename;
      const chunks = [];
      for await (const chunk of part.file) chunks.push(chunk);
      fileBuf = Buffer.concat(chunks);
    }
  }

  if (!fileBuf || !fileName) return reply.code(400).send({ error: 'file field required' });

  const folderPath = SYNO_FOLDERS[folder];
  const cdnUrl = `${SYNO_CDN[folder]}/${fileName}`;

  // ── Responde 200 IMEDIATAMENTE (evita timeout 524 do Cloudflare) ──────────
  reply.code(200).send({ ok: true, name: fileName, url: cdnUrl });

  // ── Upload ao Synology em background (sem bloquear o cliente) ─────────────
  setImmediate(async () => {
    try {
      const sid = await synoLogin();
      const boundary = `MDVBoundary${Date.now()}`;

      const textFields = [
        ['api', 'SYNO.FileStation.Upload'],
        ['version', '2'],
        ['method', 'upload'],
        ['path', folderPath],
        ['create_parents', 'true'],
        ['overwrite', 'true'],
        ['_sid', sid],
      ].map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`).join('');

      const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const body = Buffer.concat([Buffer.from(textFields), Buffer.from(fileHeader), fileBuf, Buffer.from(`\r\n--${boundary}--\r\n`)]);

      const https = require('https');
      const urlObj = new URL(SYNO_URL);
      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: urlObj.hostname, port: parseInt(urlObj.port) || 5001,
          path: '/webapi/entry.cgi', method: 'POST', rejectUnauthorized: false,
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
        };
        const r = https.request(options, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
        });
        r.on('error', reject);
        r.write(body);
        r.end();
      });

      if (result.success) {
        console.log(`[synology] Upload OK: ${folderPath}/${fileName}`);
      } else {
        console.error(`[synology] Upload FAILED: ${fileName}`, result.error);
      }
    } catch (err) {
      console.error(`[synology] Background upload error: ${fileName}`, err.message);
    }
  });
});

// DELETE /synology/file?folder=imagens&name=arquivo.jpg
fastify.delete('/synology/file', { preHandler: requireSyncKey }, async (req, reply) => {
  const { folder, name } = req.query;
  if (!SYNO_FOLDERS[folder]) return reply.code(400).send({ error: 'Invalid folder' });
  if (!name) return reply.code(400).send({ error: 'name required' });
  if (!SYNO_USER || !SYNO_PASS) return reply.code(500).send({ error: 'Synology credentials not configured' });

  const sid = await synoLogin();
  const filePath = `${SYNO_FOLDERS[folder]}/${name}`;
  const data = await synoApiGet(
    `/webapi/entry.cgi?api=SYNO.FileStation.Delete&version=2&method=start&path=${encodeURIComponent(filePath)}&accurate_progress=true&_sid=${sid}`
  );

  if (!data.success) return reply.code(500).send({ error: 'Delete failed', detail: data.error });
  return { ok: true };
});

// ─── Customer Favorites ────────────────────────────────────────────────────────

fastify.get('/customers/:id/favorites', async (req, reply) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT product_id FROM customer_favorites WHERE customer_id = ?', [id]);
    reply.header('Cache-Control', 'no-store');
    return rows.map(r => r.product_id);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Database error fetching favorites' });
  }
});

fastify.post('/customers/:id/favorites', async (req, reply) => {
  const { id } = req.params;
  const { productId } = req.body;
  if (!productId) return reply.code(400).send({ error: 'Missing productId' });
  try {
    await pool.query('INSERT IGNORE INTO customer_favorites (customer_id, product_id) VALUES (?, ?)', [id, productId]);
    return { success: true };
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Database error adding favorite' });
  }
});

fastify.delete('/customers/:id/favorites/:productId', async (req, reply) => {
  const { id, productId } = req.params;
  try {
    await pool.query('DELETE FROM customer_favorites WHERE customer_id = ? AND product_id = ?', [id, productId]);
    return { success: true };
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ error: 'Database error removing favorite' });
  }
});

// ─── Video existence check ───────────────────────────────────────────────────
// GET /check-video?sku=PI153D
// Verifica se existe um vídeo no Synology NAS para o SKU informado.
// Rota sem prefixo /public/ para evitar conflito com regras Nginx/CDN.
fastify.get('/check-video', async (req, reply) => {
  reply.header('Cache-Control', 'public, max-age=300');
  const sku = req.query.sku;
  if (!sku) return reply.code(400).send({ error: 'sku required', exists: false });
  try {
    const [[setting]] = await pool.query(
      'SELECT synology_video_base_url, synology_video_extension FROM company_settings LIMIT 1'
    );
    const baseUrl = (setting && setting.synology_video_base_url) || 'https://videos.mercadodovale.com.br';
    const ext = (setting && setting.synology_video_extension) || '.mp4';
    const url = `${baseUrl}/${encodeURIComponent(sku.trim())}${ext}`;
    const headRes = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return { exists: headRes.ok, url };
  } catch {
    const url = `https://videos.mercadodovale.com.br/${encodeURIComponent(sku.trim())}.mp4`;
    return { exists: false, url };
  }
});

// ─── Auto-migrations ────────────────────────────────────────────────────────
async function addColumnIfMissing(table, column, definition) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (Number(row.cnt) === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`[migration] Added ${table}.${column}`);
  } else {
    console.log(`[migration] ${table}.${column} already exists — skip`);
  }
}


async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_favorites (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id VARCHAR(255) NOT NULL,
      product_id CHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY idx_unique_fav (customer_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_carts (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      customer_id VARCHAR(255) NOT NULL,
      product_id CHAR(36) NOT NULL,
      quantity INT DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_unique_cart (customer_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await addColumnIfMissing('company_settings', 'synology_video_base_url', 'TEXT DEFAULT NULL');
  await addColumnIfMissing('company_settings', 'synology_video_extension', "VARCHAR(20) DEFAULT '.mp4'");
  await addColumnIfMissing('products', 'exclude_from_seo', "TINYINT(1) DEFAULT 0");
  await addColumnIfMissing('products', 'meta_title', "VARCHAR(255) NULL");
  await addColumnIfMissing('products', 'meta_description', "TEXT NULL");
  await addColumnIfMissing('products', 'keywords', "TEXT NULL");
  await addColumnIfMissing('products', 'view_count', "INT DEFAULT 0");
  await addColumnIfMissing('shipping_settings', 'extra_config', 'JSON NULL');
  console.log('[migration] company_settings synology columns: OK');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_fees (
      id CHAR(36) PRIMARY KEY,
      method VARCHAR(50) NOT NULL,
      installments INT NOT NULL DEFAULT 1,
      operator_fee_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
      applied_fee_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
      channel VARCHAR(50) NOT NULL DEFAULT 'presencial',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_fee_unique (method, installments, channel)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('[migration] payment_fees table: OK');
}

// ─── Start ─────────────────────────────────────────────────────────────────
runMigrations().then(() => {
  fastify.listen({ port: process.env.PORT || 4000, host: '0.0.0.0' }, (err) => {
    if (err) { console.error(err); process.exit(1); }
    console.log(`MDV API rodando na porta ${process.env.PORT || 4000}`);
  });
});

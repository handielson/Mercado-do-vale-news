'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  PHOTO_INTAKE_STATUS,
  buildSmartphoneVariantSkuBase,
  calculateBrandPrices,
  normalizeMemory,
  resolvePhotoIntakeStatus,
  translateColorToPtBr,
  validatePhotoExtraction,
} = require('./smartphonePhotoIntakeCore.cjs');

const DEFAULT_MODEL = 'gpt-5.6-luna';
const DEFAULT_INPUT_RATE = 0.20;
const DEFAULT_OUTPUT_RATE = 1.20;

function safeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getBrandFamily(value) {
  const brand = slugify(value);
  if (['xiaomi', 'redmi', 'poco'].includes(brand)) return 'xiaomi';
  return brand;
}

function scoreCatalogModel(model, extraction) {
  const wantedBrand = slugify(extraction.brand);
  const wantedModel = slugify(extraction.model);
  const modelName = slugify(model.name);
  const catalogBrand = slugify(model.brand_name);
  if (!wantedModel || !modelName) return Number.POSITIVE_INFINITY;
  const fullLabel = wantedBrand && !wantedModel.startsWith(`${wantedBrand}-`)
    ? `${wantedBrand}-${wantedModel}`
    : wantedModel;
  const nameWithoutDetectedBrand = wantedBrand && modelName.startsWith(`${wantedBrand}-`)
    ? modelName.slice(wantedBrand.length + 1)
    : modelName;
  const brandCompatible = !wantedBrand
    || catalogBrand === wantedBrand
    || getBrandFamily(catalogBrand) === getBrandFamily(wantedBrand)
    || modelName === fullLabel
    || modelName.startsWith(`${wantedBrand}-`);
  if (!brandCompatible) return Number.POSITIVE_INFINITY;
  if (fullLabel && modelName === fullLabel) return 0;
  if (catalogBrand === wantedBrand && modelName === wantedModel) return 1;
  if (nameWithoutDetectedBrand === wantedModel) return 2;
  if (modelName === wantedModel) return 3;
  return Number.POSITIVE_INFINITY;
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (typeof content?.text === 'string' && content.text.trim()) return content.text.trim();
    }
  }
  return '';
}

function parseIntakeRow(row) {
  if (!row) return row;
  return {
    ...row,
    extracted_data: safeJson(row.extracted_data, {}),
    validation_errors: safeJson(row.validation_errors, []),
    validation_warnings: safeJson(row.validation_warnings, []),
    prices_confirmed: Number(row.prices_confirmed || 0) === 1,
  };
}

function productMatchesIntakeConfiguration(product, intake) {
  const specs = safeJson(product?.specs, {});
  const wantedRam = normalizeMemory(intake?.detected_ram);
  const wantedStorage = normalizeMemory(intake?.detected_storage);
  const productRam = normalizeMemory(specs.ram || specs.memoria_ram || specs.memory_ram);
  const productStorage = normalizeMemory(specs.storage || specs.armazenamento || specs.memoria || specs.capacity);
  const wantedColorId = String(intake?.matched_color_id || '').trim();
  const productColorId = String(specs.color_id || '').trim();
  const colorMatches = wantedColorId && productColorId
    ? wantedColorId === productColorId
    : slugify(specs.color || specs.cor || specs.colour) === slugify(intake?.detected_color);
  return Boolean(wantedRam && wantedStorage && intake?.detected_color)
    && productRam === wantedRam
    && productStorage === wantedStorage
    && colorMatches;
}

async function findExactIntakeProduct(connection, intake) {
  const [products] = await connection.query(
    `SELECT id,sku,specs FROM products
      WHERE model_id=? AND (? IS NULL OR company_id=? OR company_id IS NULL)
      ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'out_of_stock' THEN 1 WHEN 'inactive' THEN 2 ELSE 3 END,
        updated_at DESC FOR UPDATE`,
    [intake.matched_model_id, intake.company_id || null, intake.company_id || null]
  );
  return products.find((product) => productMatchesIntakeConfiguration(product, intake)) || null;
}

async function reserveAvailableSku(connection, requestedSku, intake, model) {
  const preferred = String(requestedSku || '').trim();
  if (preferred) {
    const [requestedRows] = await connection.query('SELECT id FROM products WHERE sku=? LIMIT 1 FOR UPDATE', [preferred]);
    if (!requestedRows[0]) return preferred;
  }
  const base = buildSmartphoneVariantSkuBase({
    modelName: model.name,
    ram: intake.detected_ram,
    storage: intake.detected_storage,
    color: intake.detected_color,
  });
  for (let suffix = 1; suffix <= 999; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}${suffix}`;
    const [rows] = await connection.query('SELECT id FROM products WHERE sku=? LIMIT 1 FOR UPDATE', [candidate]);
    if (!rows[0]) return candidate;
  }
  throw new Error('Não foi possível gerar um SKU único para esta variação');
}

function toPublicIntake(row) {
  const parsed = parseIntakeRow(row);
  if (!parsed) return parsed;
  const { photo_private_path, photo_sha256, ...safe } = parsed;
  return safe;
}

function getImageMime(filename = '', mimetype = '') {
  const safeMime = String(mimetype || '').toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].includes(safeMime)) return safeMime;
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function getImageExtension(mimetype) {
  if (mimetype === 'image/png') return '.png';
  if (mimetype === 'image/webp') return '.webp';
  return '.jpg';
}

function registerSmartphonePhotoIntakeRoutes(fastify, dependencies) {
  const { pool, requireSyncKey } = dependencies;
  const privateRoot = process.env.PRIVATE_UPLOADS_DIR
    || path.join(dependencies.baseDir || process.cwd(), 'private-uploads');
  const photoRoot = path.join(privateRoot, 'smartphone-intakes');
  fs.mkdirSync(photoRoot, { recursive: true });

  let schemaPromise = null;
  const ensureSchema = () => {
    if (schemaPromise) return schemaPromise;
    schemaPromise = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS smartphone_brand_price_margins (
        id CHAR(36) PRIMARY KEY, company_id CHAR(36) NULL, brand_id CHAR(36) NOT NULL,
        retail_margin_cents INT NOT NULL DEFAULT 0, reseller_margin_cents INT NOT NULL DEFAULT 0,
        wholesale_margin_cents INT NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_smartphone_brand_margin_unique (company_id, brand_id),
        INDEX idx_smartphone_brand_margin_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool.query(`CREATE TABLE IF NOT EXISTS smartphone_photo_intakes (
        id CHAR(36) PRIMARY KEY, company_id CHAR(36) NULL, batch_id CHAR(36) NULL,
        photo_private_path VARCHAR(1000) NOT NULL, photo_sha256 CHAR(64) NOT NULL,
        status VARCHAR(48) NOT NULL DEFAULT 'uploaded', ai_model VARCHAR(80) NOT NULL DEFAULT 'gpt-5.6-luna',
        detected_brand VARCHAR(160) NULL, detected_model VARCHAR(255) NULL, detected_color VARCHAR(120) NULL,
        detected_ram VARCHAR(32) NULL, detected_storage VARCHAR(32) NULL, detected_serial VARCHAR(120) NULL,
        detected_imei_1 VARCHAR(20) NULL, detected_imei_2 VARCHAR(20) NULL, detected_ean VARCHAR(20) NULL,
        detected_product_code VARCHAR(120) NULL, matched_brand_id CHAR(36) NULL, matched_model_id CHAR(36) NULL,
        matched_product_id CHAR(36) NULL, price_cost INT NULL, price_retail INT NULL,
        price_reseller INT NULL, price_wholesale INT NULL, prices_confirmed TINYINT(1) NOT NULL DEFAULT 0,
        extracted_data JSON NULL, validation_errors JSON NULL, validation_warnings JSON NULL,
        ai_input_tokens INT NOT NULL DEFAULT 0, ai_output_tokens INT NOT NULL DEFAULT 0,
        ai_cost_usd DECIMAL(14,8) NOT NULL DEFAULT 0,
        ai_input_rate_usd_per_1m DECIMAL(14,8) NOT NULL DEFAULT 0.20,
        ai_output_rate_usd_per_1m DECIMAL(14,8) NOT NULL DEFAULT 1.20,
        retry_count INT NOT NULL DEFAULT 0, error_message TEXT NULL, created_by CHAR(36) NULL,
        reviewed_by CHAR(36) NULL, unit_id CHAR(36) NULL, completed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_smartphone_photo_intake_hash (company_id, photo_sha256),
        INDEX idx_smartphone_photo_intake_status (status, created_at),
        INDEX idx_smartphone_photo_intake_model (matched_model_id),
        INDEX idx_smartphone_photo_intake_imei_1 (detected_imei_1),
        INDEX idx_smartphone_photo_intake_serial (detected_serial)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      const [intakeColumns] = await pool.query('SHOW COLUMNS FROM smartphone_photo_intakes');
      const intakeColumnNames = new Set(intakeColumns.map((column) => column.Field));
      if (!intakeColumnNames.has('matched_color_id')) {
        await pool.query('ALTER TABLE smartphone_photo_intakes ADD COLUMN matched_color_id CHAR(36) NULL AFTER matched_model_id');
      }
      await pool.query(`CREATE TABLE IF NOT EXISTS ai_usage_events (
        id CHAR(36) PRIMARY KEY, company_id CHAR(36) NULL, feature VARCHAR(80) NOT NULL,
        reference_id CHAR(36) NULL, provider VARCHAR(40) NOT NULL DEFAULT 'openai', model VARCHAR(80) NOT NULL,
        input_tokens INT NOT NULL DEFAULT 0, output_tokens INT NOT NULL DEFAULT 0,
        input_rate_usd_per_1m DECIMAL(14,8) NOT NULL DEFAULT 0,
        output_rate_usd_per_1m DECIMAL(14,8) NOT NULL DEFAULT 0,
        estimated_cost_usd DECIMAL(14,8) NOT NULL DEFAULT 0, request_id VARCHAR(255) NULL,
        status VARCHAR(32) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ai_usage_feature_created (feature, created_at), INDEX idx_ai_usage_reference (reference_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      const [unitColumns] = await pool.query('SHOW COLUMNS FROM units');
      const names = new Set(unitColumns.map((column) => column.Field));
      if (!names.has('intake_photo_path')) await pool.query('ALTER TABLE units ADD COLUMN intake_photo_path VARCHAR(1000) NULL');
      if (!names.has('intake_id')) await pool.query('ALTER TABLE units ADD COLUMN intake_id CHAR(36) NULL');
      await repairPendingPhotoIntakes();
    })().catch((error) => { schemaPromise = null; throw error; });
    return schemaPromise;
  };

  async function loadIntake(id, connection = pool) {
    const [rows] = await connection.query('SELECT * FROM smartphone_photo_intakes WHERE id = ? LIMIT 1', [id]);
    return parseIntakeRow(rows[0]);
  }

  async function resolvePhotoIntakeCompanyId(companyId) {
    const requested = String(companyId || '').trim();
    if (requested && requested !== 'default') return requested;
    const [preferred] = await pool.query("SELECT id FROM companies WHERE slug='mercado-do-vale' LIMIT 1").catch(() => [[]]);
    if (preferred?.[0]?.id) return preferred[0].id;
    const [fallback] = await pool.query('SELECT id FROM companies ORDER BY created_at ASC LIMIT 1').catch(() => [[]]);
    return fallback?.[0]?.id || null;
  }

  async function resolveCatalogColor(value, companyId) {
    const resolvedCompanyId = await resolvePhotoIntakeCompanyId(companyId);
    const translated = translateColorToPtBr(value);
    if (!translated) return { id: null, name: '', original: String(value || '').trim() };
    const [colors] = await pool.query(
      `SELECT id,name FROM colors WHERE active=1 AND (? IS NULL OR company_id=? OR company_id IS NULL)`,
      [resolvedCompanyId, resolvedCompanyId]
    );
    const translatedKey = slugify(translated);
    const originalKey = slugify(value);
    const color = colors.find((candidate) => slugify(candidate.name) === translatedKey)
      || colors.find((candidate) => slugify(candidate.name) === originalKey)
      || null;
    return { id: color?.id || null, name: color?.name || translated, original: String(value || '').trim() };
  }

  async function matchCatalog(extraction, companyId) {
    const resolvedCompanyId = await resolvePhotoIntakeCompanyId(companyId);
    const [models] = await pool.query(
      `SELECT m.id, m.name, m.category_id, b.id AS brand_id, b.name AS brand_name
         FROM models m LEFT JOIN brands b ON b.id = m.brand_id
        WHERE m.active = 1 AND (? IS NULL OR m.company_id = ? OR m.company_id IS NULL)`,
      [resolvedCompanyId, resolvedCompanyId]
    );
    const model = models
      .map((candidate) => ({ candidate, score: scoreCatalogModel(candidate, extraction) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((left, right) => left.score - right.score || String(left.candidate.name).length - String(right.candidate.name).length)[0]?.candidate || null;
    let product = null;
    if (model) {
      const [products] = await pool.query(
        `SELECT id, name, sku, price_cost, price_retail, price_reseller, price_wholesale, specs
           FROM products WHERE model_id = ? AND status IN ('active','out_of_stock') ORDER BY updated_at DESC`,
        [model.id]
      );
      product = products.find((candidate) => {
        const specs = safeJson(candidate.specs, {});
        return (!extraction.ram || String(specs.ram || '').replace(/\s/g, '').toUpperCase() === extraction.ram)
          && (!extraction.storage || String(specs.storage || '').replace(/\s/g, '').toUpperCase() === extraction.storage)
          && (!extraction.color || slugify(specs.color || specs.cor) === slugify(extraction.color));
      }) || null;
    }
    return { model, product };
  }

  async function repairPendingPhotoIntakes() {
    const [rows] = await pool.query(
      `SELECT * FROM smartphone_photo_intakes
        WHERE status IN ('waiting_model_registration','waiting_price_confirmation','review_required')
        ORDER BY created_at DESC LIMIT 500`
    );
    for (const row of rows) {
      const intake = parseIntakeRow(row);
      const companyId = await resolvePhotoIntakeCompanyId(intake.company_id);
      const color = await resolveCatalogColor(intake.detected_color, companyId);
      const catalog = await matchCatalog({
        brand: intake.detected_brand,
        model: intake.detected_model,
        color: color.name,
        ram: intake.detected_ram,
        storage: intake.detected_storage,
      }, companyId);
      const status = resolvePhotoIntakeStatus({
        validationErrors: intake.validation_errors || [],
        matchedModelId: catalog.model?.id || intake.matched_model_id,
        pricesConfirmed: Boolean(intake.prices_confirmed),
      });
      await pool.query(
        `UPDATE smartphone_photo_intakes SET company_id=?, detected_color=?, matched_color_id=?, matched_brand_id=?, matched_model_id=?,
         matched_product_id=COALESCE(matched_product_id,?), price_cost=COALESCE(price_cost,?),
         price_retail=COALESCE(price_retail,?), price_reseller=COALESCE(price_reseller,?),
         price_wholesale=COALESCE(price_wholesale,?), status=? WHERE id=?`,
        [companyId || intake.company_id, color.name || intake.detected_color || null, color.id, catalog.model?.brand_id || intake.matched_brand_id || null,
          catalog.model?.id || intake.matched_model_id || null, catalog.product?.id || null,
          catalog.product?.price_cost ?? null, catalog.product?.price_retail ?? null,
          catalog.product?.price_reseller ?? null, catalog.product?.price_wholesale ?? null, status, intake.id]
      );
    }
  }

  async function getOpenAiKey() {
    const [rows] = await pool.query('SELECT openai_api_key FROM autoresponder_settings WHERE id = 1 LIMIT 1');
    return String(rows?.[0]?.openai_api_key || process.env.OPENAI_API_KEY || '').trim();
  }

  async function analyzeIntake(intake) {
    const apiKey = await getOpenAiKey();
    if (!apiKey) throw new Error('Chave OpenAI não configurada no VPS');
    const absolutePath = path.join(privateRoot, intake.photo_private_path);
    const imageBuffer = await fs.promises.readFile(absolutePath);
    const mime = getImageMime(absolutePath);
    const model = String(process.env.OPENAI_SMARTPHONE_PHOTO_MODEL || DEFAULT_MODEL).trim();
    const inputRate = Number(process.env.OPENAI_SMARTPHONE_PHOTO_INPUT_USD_PER_1M || DEFAULT_INPUT_RATE);
    const outputRate = Number(process.env.OPENAI_SMARTPHONE_PHOTO_OUTPUT_USD_PER_1M || DEFAULT_OUTPUT_RATE);
    const schema = {
      type: 'object', additionalProperties: false,
      properties: {
        brand: { type: ['string', 'null'] }, model: { type: ['string', 'null'] },
        color: { type: ['string', 'null'] }, ram: { type: ['string', 'null'] },
        storage: { type: ['string', 'null'] }, serial: { type: ['string', 'null'] },
        imei1: { type: ['string', 'null'] }, imei2: { type: ['string', 'null'] },
        ean: { type: ['string', 'null'] }, product_code: { type: ['string', 'null'] },
        confidence: { type: ['number', 'null'] },
      },
      required: ['brand', 'model', 'color', 'ram', 'storage', 'serial', 'imei1', 'imei2', 'ean', 'product_code', 'confidence'],
    };
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        instructions: 'Leia somente a etiqueta visível da caixa do smartphone. Não pesquise e não complete por memória. Copie cada identificador dígito por dígito. Responda a cor em português do Brasil quando houver tradução direta. Use null quando não estiver legível.',
        input: [{ role: 'user', content: [
          { type: 'input_text', text: 'Extraia marca, modelo, cor, RAM, armazenamento, serial, IMEI 1, IMEI 2, EAN/GTIN e código do produto desta etiqueta.' },
          { type: 'input_image', image_url: `data:${mime};base64,${imageBuffer.toString('base64')}`, detail: 'original' },
        ] }],
        reasoning: { effort: 'none' },
        text: { format: { type: 'json_schema', name: 'smartphone_box_label', strict: true, schema } },
        max_output_tokens: 700,
      }),
      signal: AbortSignal.timeout(90000),
    });
    const payload = await response.json().catch(() => ({}));
    const text = extractResponseText(payload);
    if (!response.ok || !text) throw new Error(payload?.error?.message || `OpenAI ${response.status}`);
    const parsed = JSON.parse(text);
    const validation = validatePhotoExtraction(parsed);
    const color = await resolveCatalogColor(validation.value.color, intake.company_id);
    validation.value.color = color.name;
    const catalog = await matchCatalog(validation.value, intake.company_id);
    const duplicateValues = [validation.value.imei1, validation.value.imei2, validation.value.serial].filter(Boolean);
    if (duplicateValues.length > 0) {
      const placeholders = duplicateValues.map(() => '?').join(',');
      const [duplicates] = await pool.query(
        `SELECT id FROM units WHERE imei_1 IN (${placeholders}) OR imei_2 IN (${placeholders}) OR serial IN (${placeholders}) LIMIT 1`,
        [...duplicateValues, ...duplicateValues, ...duplicateValues]
      );
      if (duplicates.length > 0) validation.errors.push({ field: 'identifiers', code: 'already_registered', message: 'IMEI ou serial já cadastrado' });
    }
    const usage = payload?.usage || {};
    const inputTokens = Number(usage.input_tokens || 0);
    const outputTokens = Number(usage.output_tokens || 0);
    const cost = (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
    const status = resolvePhotoIntakeStatus({ validationErrors: validation.errors, matchedModelId: catalog.model?.id });
    await pool.query(
      `UPDATE smartphone_photo_intakes SET status=?, ai_model=?, detected_brand=?, detected_model=?, detected_color=?,
       detected_ram=?, detected_storage=?, detected_serial=?, detected_imei_1=?, detected_imei_2=?, detected_ean=?,
       detected_product_code=?, matched_brand_id=?, matched_model_id=?, matched_color_id=?, matched_product_id=?,
       price_cost=?, price_retail=?, price_reseller=?, price_wholesale=?, extracted_data=?, validation_errors=?,
       validation_warnings=?, ai_input_tokens=?, ai_output_tokens=?, ai_cost_usd=?, ai_input_rate_usd_per_1m=?,
       ai_output_rate_usd_per_1m=?, retry_count=retry_count+1, error_message=NULL WHERE id=?`,
      [status, model, validation.value.brand, validation.value.model, validation.value.color, validation.value.ram,
        validation.value.storage, validation.value.serial, validation.value.imei1, validation.value.imei2,
        validation.value.ean, validation.value.product_code, catalog.model?.brand_id || null, catalog.model?.id || null,
        color.id, catalog.product?.id || null, catalog.product?.price_cost ?? null, catalog.product?.price_retail ?? null,
        catalog.product?.price_reseller ?? null, catalog.product?.price_wholesale ?? null,
        JSON.stringify({ ...validation.value, color_original: color.original }),
        JSON.stringify(validation.errors), JSON.stringify(validation.warnings), inputTokens, outputTokens, cost,
        inputRate, outputRate, intake.id]
    );
    await pool.query(
      `INSERT INTO ai_usage_events (id, company_id, feature, reference_id, provider, model, input_tokens, output_tokens,
       input_rate_usd_per_1m, output_rate_usd_per_1m, estimated_cost_usd, request_id, status)
       VALUES (?,?,'smartphone_photo_intake',?,'openai',?,?,?,?,?,?,?,'success')`,
      [crypto.randomUUID(), intake.company_id || null, intake.id, model, inputTokens, outputTokens, inputRate, outputRate,
        cost, payload?.id || null]
    );
    return toPublicIntake(await loadIntake(intake.id));
  }

  fastify.post('/smartphone-photo-intakes', { preHandler: requireSyncKey }, async (request, reply) => {
    await ensureSchema();
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'Foto obrigatória' });
    const mime = getImageMime(data.filename, data.mimetype);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return reply.code(415).send({ error: 'Use JPG, PNG ou WEBP' });
    const buffer = await data.toBuffer();
    if (buffer.length > 20 * 1024 * 1024) return reply.code(413).send({ error: 'Foto maior que 20 MB' });
    const id = crypto.randomUUID();
    const companyId = await resolvePhotoIntakeCompanyId(data.fields?.company_id?.value);
    if (!companyId) return reply.code(409).send({ error: 'Empresa padrão não encontrada para o pré-cadastro' });
    const batchId = String(data.fields?.batch_id?.value || '').trim() || null;
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const relativePath = path.join('smartphone-intakes', companyId || 'default', `${id}${getImageExtension(mime)}`).replace(/\\/g, '/');
    const absolutePath = path.join(privateRoot, relativePath);
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.promises.writeFile(absolutePath, buffer, { flag: 'wx' });
    try {
      await pool.query(
        `INSERT INTO smartphone_photo_intakes (id, company_id, batch_id, photo_private_path, photo_sha256, status)
         VALUES (?,?,?,?,?,'uploaded')`,
        [id, companyId, batchId, relativePath, hash]
      );
    } catch (error) {
      await fs.promises.unlink(absolutePath).catch(() => {});
      if (error?.code === 'ER_DUP_ENTRY') return reply.code(409).send({ error: 'Esta foto já está na fila' });
      throw error;
    }
    reply.code(201);
    return toPublicIntake(await loadIntake(id));
  });

  fastify.post('/smartphone-photo-intakes/:id/analyze', { preHandler: requireSyncKey }, async (request, reply) => {
    await ensureSchema();
    const intake = await loadIntake(request.params.id);
    if (!intake) return reply.code(404).send({ error: 'Pré-cadastro não encontrado' });
    if (intake.status === PHOTO_INTAKE_STATUS.COMPLETED) return toPublicIntake(intake);
    await pool.query('UPDATE smartphone_photo_intakes SET status=?, error_message=NULL WHERE id=?', [PHOTO_INTAKE_STATUS.ANALYZING, intake.id]);
    try { return await analyzeIntake(intake); }
    catch (error) {
      await pool.query('UPDATE smartphone_photo_intakes SET status=?, retry_count=retry_count+1, error_message=? WHERE id=?',
        [PHOTO_INTAKE_STATUS.FAILED, String(error?.message || error).slice(0, 2000), intake.id]);
      return reply.code(502).send({ error: error?.message || 'Falha ao analisar foto', intake_id: intake.id });
    }
  });

  fastify.get('/smartphone-photo-intakes', { preHandler: requireSyncKey }, async (request) => {
    await ensureSchema();
    const conditions = []; const params = [];
    if (request.query?.status && request.query.status !== 'all') { conditions.push('status = ?'); params.push(request.query.status); }
    if (request.query?.company_id) { conditions.push('company_id = ?'); params.push(request.query.company_id); }
    const [rows] = await pool.query(`SELECT * FROM smartphone_photo_intakes ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 500`, params);
    return rows.map(toPublicIntake);
  });

  fastify.get('/smartphone-photo-intakes/:id', { preHandler: requireSyncKey }, async (request, reply) => {
    await ensureSchema();
    const intake = await loadIntake(request.params.id);
    return intake ? toPublicIntake(intake) : reply.code(404).send({ error: 'Pré-cadastro não encontrado' });
  });

  fastify.get('/smartphone-photo-intakes/:id/photo', { preHandler: requireSyncKey }, async (request, reply) => {
    await ensureSchema();
    const intake = await loadIntake(request.params.id);
    if (!intake) return reply.code(404).send({ error: 'Pré-cadastro não encontrado' });
    const absolutePath = path.resolve(privateRoot, intake.photo_private_path);
    const resolvedPhotoRoot = `${path.resolve(photoRoot)}${path.sep}`;
    if (!absolutePath.startsWith(resolvedPhotoRoot)) return reply.code(400).send({ error: 'Caminho de foto inválido' });
    if (!fs.existsSync(absolutePath)) return reply.code(404).send({ error: 'Foto não encontrada' });
    reply.header('Cache-Control', 'private, no-store');
    reply.type(getImageMime(absolutePath));
    return reply.send(fs.createReadStream(absolutePath));
  });

  fastify.patch('/smartphone-photo-intakes/:id', { preHandler: requireSyncKey }, async (request, reply) => {
    await ensureSchema();
    const intake = await loadIntake(request.params.id);
    if (!intake) return reply.code(404).send({ error: 'Pré-cadastro não encontrado' });
    const body = { ...(request.body || {}) };
    if ('matched_model_id' in body && body.matched_model_id) {
      const [modelRows] = await pool.query('SELECT id,brand_id,name FROM models WHERE id=? AND active=1 LIMIT 1', [body.matched_model_id]);
      if (!modelRows[0]) return reply.code(409).send({ error: 'O modelo selecionado não está mais disponível' });
      body.matched_brand_id = modelRows[0].brand_id || null;
      body.detected_model = modelRows[0].name || body.detected_model || intake.detected_model;
      if (body.matched_model_id !== intake.matched_model_id) body.matched_product_id = null;
    }
    if ('matched_color_id' in body && body.matched_color_id) {
      const [colorRows] = await pool.query('SELECT id,name FROM colors WHERE id=? AND active=1 LIMIT 1', [body.matched_color_id]);
      if (!colorRows[0]) return reply.code(409).send({ error: 'A cor selecionada não está mais disponível' });
      body.detected_color = colorRows[0].name;
    } else if ('detected_color' in body) {
      const color = await resolveCatalogColor(body.detected_color, intake.company_id);
      body.detected_color = color.name;
      body.matched_color_id = color.id;
    }
    const validation = validatePhotoExtraction({
      brand: body.detected_brand ?? intake.detected_brand,
      model: body.detected_model ?? intake.detected_model,
      color: body.detected_color ?? intake.detected_color,
      ram: body.detected_ram ?? intake.detected_ram,
      storage: body.detected_storage ?? intake.detected_storage,
      serial: body.detected_serial ?? intake.detected_serial,
      imei1: body.detected_imei_1 ?? intake.detected_imei_1,
      imei2: body.detected_imei_2 ?? intake.detected_imei_2,
      ean: body.detected_ean ?? intake.detected_ean,
      product_code: body.detected_product_code ?? intake.detected_product_code,
    });
    const catalog = await matchCatalog(validation.value, intake.company_id);
    if (catalog.model && (!body.matched_model_id || body.matched_model_id === catalog.model.id)) {
      body.matched_brand_id = catalog.model.brand_id || body.matched_brand_id || intake.matched_brand_id || null;
      body.matched_model_id = catalog.model.id;
      body.matched_product_id = catalog.product?.id || body.matched_product_id || intake.matched_product_id || null;
      if (catalog.product) {
        for (const field of ['price_cost', 'price_retail', 'price_reseller', 'price_wholesale']) {
          if (!(field in body) && intake[field] == null) body[field] = catalog.product[field] ?? null;
        }
      }
    }
    const allowed = ['matched_brand_id', 'matched_model_id', 'matched_product_id', 'detected_brand', 'detected_model',
      'matched_color_id', 'detected_color', 'detected_ram', 'detected_storage', 'detected_serial', 'detected_imei_1', 'detected_imei_2',
      'detected_ean', 'detected_product_code', 'price_cost', 'price_retail', 'price_reseller', 'price_wholesale', 'prices_confirmed', 'reviewed_by'];
    const sets = []; const values = [];
    for (const field of allowed) if (field in body) { sets.push(`${field}=?`); values.push(body[field] ?? null); }
    if (!sets.length) return reply.code(400).send({ error: 'Nenhum campo permitido' });
    const identifiers = [validation.value.imei1, validation.value.imei2, validation.value.serial].filter(Boolean);
    if (identifiers.length > 0) {
      const placeholders = identifiers.map(() => '?').join(',');
      const [duplicates] = await pool.query(
        `SELECT id FROM units WHERE imei_1 IN (${placeholders}) OR imei_2 IN (${placeholders}) OR serial IN (${placeholders}) LIMIT 1`,
        [...identifiers, ...identifiers, ...identifiers]
      );
      if (duplicates.length > 0) validation.errors.push({ field: 'identifiers', code: 'already_registered', message: 'IMEI ou serial já cadastrado' });
    }
    sets.push('extracted_data=?', 'validation_errors=?', 'validation_warnings=?');
    values.push(JSON.stringify(validation.value), JSON.stringify(validation.errors), JSON.stringify(validation.warnings));
    const status = resolvePhotoIntakeStatus({ validationErrors: validation.errors, matchedModelId: body.matched_model_id ?? intake.matched_model_id,
      pricesConfirmed: Boolean(body.prices_confirmed ?? intake.prices_confirmed) });
    sets.push('status=?'); values.push(status); values.push(intake.id);
    await pool.query(`UPDATE smartphone_photo_intakes SET ${sets.join(', ')} WHERE id=?`, values);
    return toPublicIntake(await loadIntake(intake.id));
  });

  fastify.post('/smartphone-photo-intakes/:id/confirm-group-prices', { preHandler: requireSyncKey }, async (request, reply) => {
    await ensureSchema();
    const intake = await loadIntake(request.params.id);
    if (!intake) return reply.code(404).send({ error: 'Pré-cadastro não encontrado' });
    if (!intake.matched_model_id || !intake.matched_color_id || !intake.detected_ram || !intake.detected_storage) {
      return reply.code(409).send({ error: 'Confirme modelo, RAM, armazenamento e cor antes de agrupar' });
    }
    const priceFields = ['price_cost', 'price_retail', 'price_reseller', 'price_wholesale'];
    const prices = {};
    for (const field of priceFields) {
      const value = Number(request.body?.[field]);
      if (!Number.isFinite(value) || value <= 0) return reply.code(400).send({ error: 'Informe todos os preços do grupo' });
      prices[field] = Math.round(value);
    }
    const normalizedRam = String(intake.detected_ram).replace(/\s+/g, '').toUpperCase();
    const normalizedStorage = String(intake.detected_storage).replace(/\s+/g, '').toUpperCase();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [groupRows] = await connection.query(
        `SELECT id,matched_model_id,validation_errors FROM smartphone_photo_intakes
          WHERE company_id <=> ? AND matched_model_id=? AND matched_color_id=?
            AND UPPER(REPLACE(COALESCE(detected_ram,''),' ',''))=?
            AND UPPER(REPLACE(COALESCE(detected_storage,''),' ',''))=?
            AND status IN ('waiting_price_confirmation','review_required','ready_to_finalize')
          FOR UPDATE`,
        [intake.company_id || null, intake.matched_model_id, intake.matched_color_id, normalizedRam, normalizedStorage]
      );
      if (groupRows.length === 0) {
        await connection.rollback();
        return reply.code(409).send({ error: 'Nenhum aparelho disponível neste grupo' });
      }
      for (const row of groupRows) {
        const status = resolvePhotoIntakeStatus({
          validationErrors: safeJson(row.validation_errors, []),
          matchedModelId: row.matched_model_id,
          pricesConfirmed: true,
        });
        await connection.query(
          `UPDATE smartphone_photo_intakes SET price_cost=?,price_retail=?,price_reseller=?,price_wholesale=?,
           prices_confirmed=1,status=? WHERE id=?`,
          [prices.price_cost, prices.price_retail, prices.price_reseller, prices.price_wholesale, status, row.id]
        );
      }
      await connection.commit();
      return {
        intake: toPublicIntake(await loadIntake(intake.id)),
        updated_count: groupRows.length,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  fastify.get('/smartphone-brand-margins', { preHandler: requireSyncKey }, async (request) => {
    await ensureSchema();
    const companyId = await resolvePhotoIntakeCompanyId(request.query?.company_id);
    const [rows] = await pool.query(
      `SELECT m.*, b.name AS brand_name FROM smartphone_brand_price_margins m JOIN brands b ON b.id=m.brand_id
       WHERE (? IS NULL OR m.company_id=? OR m.company_id IS NULL) ORDER BY b.name`, [companyId, companyId]
    );
    return rows;
  });

  fastify.put('/smartphone-brand-margins/:brandId', { preHandler: requireSyncKey }, async (request, reply) => {
    await ensureSchema();
    const body = request.body || {};
    let companyId = await resolvePhotoIntakeCompanyId(body.company_id);
    if (!companyId) {
      const [brandRows] = await pool.query(
        'SELECT company_id FROM brands WHERE id=? AND company_id IS NOT NULL LIMIT 1',
        [request.params.brandId]
      ).catch(() => [[]]);
      companyId = brandRows?.[0]?.company_id || null;
    }
    if (!companyId) return reply.code(409).send({ error: 'Empresa padrão não encontrada para a margem' });
    const prices = calculateBrandPrices(0, body);
    await pool.query(
      `INSERT INTO smartphone_brand_price_margins (id,company_id,brand_id,retail_margin_cents,reseller_margin_cents,wholesale_margin_cents,active)
       VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE retail_margin_cents=VALUES(retail_margin_cents),
       reseller_margin_cents=VALUES(reseller_margin_cents), wholesale_margin_cents=VALUES(wholesale_margin_cents), active=VALUES(active)`,
      [crypto.randomUUID(), companyId, request.params.brandId, prices.price_retail, prices.price_reseller, prices.price_wholesale, body.active === false ? 0 : 1]
    );
    const [rows] = await pool.query('SELECT * FROM smartphone_brand_price_margins WHERE brand_id=? AND (company_id <=> ?) LIMIT 1', [request.params.brandId, companyId]);
    return rows[0];
  });

  fastify.post('/smartphone-photo-intakes/:id/apply-brand-margins', { preHandler: requireSyncKey }, async (request, reply) => {
    await ensureSchema();
    const intake = await loadIntake(request.params.id);
    if (!intake) return reply.code(404).send({ error: 'Pré-cadastro não encontrado' });
    if (!intake.matched_brand_id) return reply.code(409).send({ error: 'Confirme a marca primeiro' });
    const [rows] = await pool.query(
      `SELECT * FROM smartphone_brand_price_margins WHERE brand_id=? AND active=1
       AND (company_id <=> ? OR company_id IS NULL) ORDER BY company_id IS NULL ASC LIMIT 1`,
      [intake.matched_brand_id, intake.company_id || null]
    );
    if (!rows[0]) return reply.code(409).send({ error: 'Cadastre as margens desta marca primeiro' });
    const prices = calculateBrandPrices(request.body?.price_cost, rows[0]);
    await pool.query(
      `UPDATE smartphone_photo_intakes SET price_cost=?,price_retail=?,price_reseller=?,price_wholesale=?,prices_confirmed=0,
       status=? WHERE id=?`,
      [prices.price_cost, prices.price_retail, prices.price_reseller, prices.price_wholesale,
        PHOTO_INTAKE_STATUS.WAITING_PRICE_CONFIRMATION, intake.id]
    );
    return toPublicIntake(await loadIntake(intake.id));
  });

  fastify.post('/smartphone-photo-intakes/:id/finalize', { preHandler: requireSyncKey }, async (request, reply) => {
    await ensureSchema();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [intakeRows] = await connection.query('SELECT * FROM smartphone_photo_intakes WHERE id=? FOR UPDATE', [request.params.id]);
      const intake = parseIntakeRow(intakeRows[0]);
      if (!intake) { await connection.rollback(); return reply.code(404).send({ error: 'Pré-cadastro não encontrado' }); }
      if (intake.status === PHOTO_INTAKE_STATUS.COMPLETED && intake.unit_id) {
        await connection.commit();
        return { intake: toPublicIntake(intake), product_id: intake.matched_product_id, unit_id: intake.unit_id, idempotent: true };
      }
      if (!intake.matched_model_id) { await connection.rollback(); return reply.code(409).send({ error: 'Cadastre ou vincule o modelo primeiro' }); }
      if (!intake.matched_color_id) { await connection.rollback(); return reply.code(409).send({ error: 'Selecione ou cadastre a cor antes de salvar' }); }
      if (!intake.prices_confirmed) { await connection.rollback(); return reply.code(409).send({ error: 'Confirme os preços antes de salvar' }); }
      const requiredPrices = ['price_cost', 'price_retail', 'price_reseller', 'price_wholesale'];
      if (requiredPrices.some((field) => intake[field] == null || !Number.isFinite(Number(intake[field])) || Number(intake[field]) < 0)) {
        await connection.rollback();
        return reply.code(409).send({ error: 'Preencha e confirme todos os valores antes de salvar' });
      }
      if ((intake.validation_errors || []).length > 0) { await connection.rollback(); return reply.code(409).send({ error: 'Corrija os dados marcados para revisão' }); }
      const identifiers = [intake.detected_imei_1, intake.detected_imei_2, intake.detected_serial].filter(Boolean);
      if (identifiers.length) {
        const placeholders = identifiers.map(() => '?').join(',');
        const [duplicates] = await connection.query(
          `SELECT id FROM units WHERE imei_1 IN (${placeholders}) OR imei_2 IN (${placeholders}) OR serial IN (${placeholders}) FOR UPDATE`,
          [...identifiers, ...identifiers, ...identifiers]
        );
        if (duplicates.length) { await connection.rollback(); return reply.code(409).send({ error: 'IMEI ou serial já cadastrado' }); }
      }
      const [modelRows] = await connection.query(
        `SELECT m.id,m.name,m.category_id,m.template_values,b.name AS brand_name,b.id AS brand_id
         FROM models m LEFT JOIN brands b ON b.id=m.brand_id WHERE m.id=? LIMIT 1`, [intake.matched_model_id]
      );
      const model = modelRows[0];
      if (!model) { await connection.rollback(); return reply.code(409).send({ error: 'Modelo vinculado não existe mais' }); }
      const template = safeJson(model.template_values, {});
      let productId = String(request.body?.product_id || intake.matched_product_id || '').trim();
      if (productId) {
        const [products] = await connection.query('SELECT id,model_id FROM products WHERE id=? LIMIT 1', [productId]);
        if (!products[0]) productId = '';
        else if (products[0].model_id !== intake.matched_model_id) {
          await connection.rollback();
          return reply.code(409).send({ error: 'O produto selecionado não pertence ao modelo conferido' });
        }
      }
      if (!productId) {
        const exactProduct = await findExactIntakeProduct(connection, intake);
        if (exactProduct) productId = exactProduct.id;
      }
      if (!productId) {
        const sku = await reserveAvailableSku(connection, request.body?.sku, intake, model);
        if (!sku) { await connection.rollback(); return reply.code(409).send({ error: 'Informe o SKU para criar esta variação' }); }
        const [skuRows] = await connection.query('SELECT id FROM products WHERE sku=? LIMIT 1 FOR UPDATE', [sku]);
        if (skuRows[0]) {
          await connection.rollback();
          return reply.code(409).send({ error: 'Este SKU já está em uso. Informe outro SKU ou vincule o produto existente.' });
        } else {
          productId = crypto.randomUUID();
          const specs = {
            ...template,
            color: intake.detected_color || undefined,
            color_id: intake.matched_color_id || undefined,
            ram: intake.detected_ram || undefined,
            storage: intake.detected_storage || undefined,
          };
          let images = [];
          if (intake.detected_color) {
            const [imageRows] = await connection.query(
              `SELECT mci.images,mci.image_url FROM model_color_images mci
               WHERE mci.model_id=? AND mci.color_id=?
               AND (mci.company_id=? OR mci.company_id IS NULL)
               ORDER BY (mci.company_id=?) DESC, mci.updated_at DESC LIMIT 1`,
              [model.id, intake.matched_color_id, intake.company_id || null, intake.company_id || null]
            );
            const savedImages = safeJson(imageRows?.[0]?.images, []);
            images = Array.isArray(savedImages) ? savedImages : [];
            if (imageRows?.[0]?.image_url && !images.includes(imageRows[0].image_url)) images.push(imageRows[0].image_url);
          }
          const name = String(model.name || '').trim();
          await connection.query(
            `INSERT INTO products (id,name,slug,sku,ean,alternative_eans,price_retail,price_wholesale,price_cost,
             price_reseller,stock_quantity,status,category_id,brand,model_id,images,specs,track_inventory,warranty_type,company_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,0,'active',?,?,?,?,?,1,'brand',?)`,
            [productId, name, slugify([model.name, intake.detected_ram, intake.detected_storage, intake.detected_color, sku].filter(Boolean).join(' ')), sku, intake.detected_ean || null,
              JSON.stringify(intake.detected_ean ? [intake.detected_ean] : []), intake.price_retail,
              intake.price_wholesale, intake.price_cost, intake.price_reseller, model.category_id || null,
              model.brand_name || intake.detected_brand || null, model.id, JSON.stringify(images), JSON.stringify(specs),
              intake.company_id || null]
          );
        }
      }
      const unitId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO units (id,product_id,imei_1,imei_2,serial,status,\`condition\`,internal_notes,cost_price,intake_photo_path,intake_id)
         VALUES (?,?,?,?,?,'available','new',?,?,?,?)`,
        [unitId, productId, intake.detected_imei_1 || null, intake.detected_imei_2 || null,
          intake.detected_serial || null, `Cadastro por foto ${intake.id}`, intake.price_cost || null,
          intake.photo_private_path, intake.id]
      );
      await connection.query(
        `UPDATE products SET price_cost=?,price_retail=?,price_reseller=?,price_wholesale=?,status='active',
         stock_quantity=(SELECT COUNT(*) FROM units WHERE product_id=? AND status='available'),updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [intake.price_cost, intake.price_retail, intake.price_reseller, intake.price_wholesale, productId, productId]
      );
      await connection.query(
        `UPDATE smartphone_photo_intakes SET status=?,matched_product_id=?,unit_id=?,completed_at=NOW() WHERE id=?`,
        [PHOTO_INTAKE_STATUS.COMPLETED, productId, unitId, intake.id]
      );
      await connection.commit();
      return { intake: toPublicIntake(await loadIntake(intake.id)), product_id: productId, unit_id: unitId, idempotent: false };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  });

  return { ensureSchema };
}

module.exports = { registerSmartphonePhotoIntakeRoutes, scoreCatalogModel };

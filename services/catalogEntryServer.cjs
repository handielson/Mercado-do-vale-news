'use strict';
// Entrada única: resolve família, variação, preço e estoque de um lote numa única transação.
// Prévia (commit:false) roda o mesmo código e termina em ROLLBACK; a confirmação exige o mesmo hash.
const crypto = require('node:crypto');
const { normalizeEntryItem, validateEntryBatch, planHash } = require('./catalogEntryCore.cjs');
const { ensureSmartphoneModelFamily } = require('./smartphoneModelFamily.cjs');
const { productSkuPrefix, nextProductSku, assignAutomaticProductSku } = require('./productSku.cjs');
const { ensureSmartphonePriceGroupsSchema, inheritSmartphonePrices, loadModel } = require('./smartphonePriceGroupsServer.cjs');
const core = require('./smartphonePriceGroupsCore.cjs');

const SKU_LOCK = 'mdv:product-auto-sku';
// Mesmo valor de DEFAULT_PRODUCT_VERSION (smartphoneModelSpecs.mjs, ESM — não dá para require aqui).
const DEFAULT_PRODUCT_VERSION = 'Global';
const SALE = ['price_retail', 'price_reseller', 'price_wholesale'];
const MODEL_SQL = `SELECT m.id,m.name,m.category_id,m.company_id,m.template_values,b.name AS brand_name,c.name AS category_name
  FROM models m LEFT JOIN brands b ON b.id=m.brand_id LEFT JOIN categories c ON c.id=m.category_id WHERE m.id=?`;
const schemaPromises = new WeakMap();

class LineError extends Error {}
const lineError = message => new LineError(message);
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
// Regras de negócio (inclusive os 409 dos serviços reaproveitados) viram erro da linha; o resto propaga.
const isRuleError = error => error instanceof LineError || error?.statusCode === 409;
const norm = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const scope = (value, defaultId) => !value || value === 'default' ? defaultId : String(value);
const slugify = value => norm(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const completePrices = prices => Boolean(prices) && SALE.every(key => Number.isSafeInteger(prices[key]) && prices[key] >= 0);

function ensureCatalogEntrySchema(pool) {
  if (!schemaPromises.has(pool)) {
    schemaPromises.set(pool, (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS catalog_entry_batches (
        id CHAR(36) PRIMARY KEY,
        source VARCHAR(20) NOT NULL,
        created_by CHAR(36) NULL,
        plan_hash CHAR(64) NOT NULL,
        line_count INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool.query(`CREATE TABLE IF NOT EXISTS catalog_entry_lines (
        id CHAR(36) PRIMARY KEY,
        batch_id CHAR(36) NOT NULL,
        line INT NOT NULL,
        product_id CHAR(36) NOT NULL,
        unit_id CHAR(36) NULL,
        quantity INT NOT NULL,
        family_created TINYINT(1) NOT NULL DEFAULT 0,
        variation_created TINYINT(1) NOT NULL DEFAULT 0,
        INDEX idx_catalog_entry_lines_batch (batch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    })().catch(error => { schemaPromises.delete(pool); throw error; }));
  }
  return schemaPromises.get(pool);
}

async function loadRefs(ctx, item) {
  const { conn } = ctx;
  if (item.model_id && !ctx.models.has(item.model_id)) {
    const [[model]] = await conn.query(MODEL_SQL, [item.model_id]);
    ctx.models.set(item.model_id, model || null);
  }
  if (!item.model_id && item.category_id && !ctx.categories.has(item.category_id)) {
    const [[category]] = await conn.query('SELECT id,name FROM categories WHERE id=?', [item.category_id]);
    ctx.categories.set(item.category_id, category || null);
  }
  if (item.location_id && !ctx.locations.has(item.location_id)) {
    const [[location]] = await conn.query('SELECT id,company_id,deposit_id FROM stock_locations WHERE id=?', [item.location_id]);
    ctx.locations.set(item.location_id, location || null);
  }
}

function isPhone(ctx, item) {
  const owner = item.model_id ? ctx.models.get(item.model_id) : ctx.categories.get(item.category_id);
  return core.isSmartphoneCategory(item.model_id ? owner?.category_name : owner?.name);
}

const stockKind = (ctx, item) => isPhone(ctx, item) || item.identity.imei1 || item.identity.serial ? 'unit' : 'quantity';
const STOCK_LABEL = { unit: 'aparelho', quantity: 'quantidade' };

// O modo de estoque é do PRODUTO: celular ou produto com unidades → aparelho; produto com saldo por local
// e sem unidades → quantidade; produto sem nenhum dos dois segue a linha. Misturar apagaria o saldo
// (syncProductStock reconstrói product_stock_locations a partir das unidades).
async function productStockKind(ctx, productId, phone, lineKind) {
  if (phone) return 'unit';
  const [[row]] = await ctx.conn.query(`SELECT (SELECT COUNT(*) FROM units WHERE product_id=?) AS units,
    (SELECT COUNT(*) FROM product_stock_locations WHERE product_id=?) AS locations`, [productId, productId]);
  if (Number(row?.units) > 0) return 'unit';
  if (Number(row?.locations) > 0) return 'quantity';
  return lineKind;
}

// Compara cada identificador informado com imei_1, imei_2 e serial, na conexão da transação
// (enxerga unidades gravadas por linhas anteriores do mesmo lote). Valores já normalizados pelo núcleo:
// IMEI só dígitos, serial em maiúsculas sem espaços nas pontas.
async function findIdentifierConflict(conn, identity) {
  const imeis = [identity.imei1, identity.imei2].map(v => String(v ?? '').replace(/\D/g, '')).filter(Boolean);
  const serial = String(identity.serial ?? '').trim().toUpperCase();
  const values = [...new Set([...imeis, serial].filter(Boolean))];
  if (!values.length) return null;
  const [[hit]] = await conn.query('SELECT id,imei_1,imei_2,serial FROM units WHERE imei_1 IN (?) OR imei_2 IN (?) OR serial IN (?) LIMIT 1',
    [values, values, values]);
  if (!hit) return null;
  const same = (a, b) => a != null && String(a).trim().toUpperCase() === b;
  const value = values.find(v => same(hit.imei_1, v) || same(hit.imei_2, v)) || values.find(v => same(hit.serial, v)) || values[0];
  const asImei = same(hit.imei_1, value) || same(hit.imei_2, value) || imeis.includes(value);
  return { value, label: asImei ? 'IMEI' : 'Serial' };
}

// SKU e nome seguem assignAutomaticProductSku: produto/variação recebe "<nome> - <SKU>".
async function nextSku(conn, { name, parentSku }) {
  try {
    const prefix = parentSku ? `${parentSku}-` : productSkuPrefix(name);
    const [rows] = await conn.query('SELECT sku FROM products WHERE sku LIKE ?', [`${prefix}%`]);
    const product = { name };
    assignAutomaticProductSku(product, rows.map(row => row.sku), parentSku);
    return product;
  } catch (error) {
    if (error.code || error.sqlMessage) throw error;
    throw lineError(error.message);
  }
}

// Características da variação. Celular segue o cadastro por foto: versão padrão 'Global'
// e a rede financeira congelada em _price_group_network (do item ou do modelo).
function variantSpecs(item, template, phone) {
  const c = item.configuration;
  const specs = {};
  if (c.ram) specs.ram = c.ram;
  if (c.storage) specs.storage = c.storage;
  if (phone) {
    specs.version = c.version || 'Global';
    specs._price_group_network = c.network
      ?? ['rede_operadora', 'network', 'rede'].map(key => template[key]).find(value => value != null && value !== '') ?? '';
  } else {
    if (c.version) specs.version = c.version;
    if (c.network) specs.network = c.network;
  }
  if (c.condition !== 'new') specs.condition = c.condition;
  if (item.color) specs.color = item.color;
  return specs;
}

// Mesma variação = mesma configuração (inclui condição) + mesma cor, sem diferenciar maiúsculas,
// espaços ou acentos. Os pares já estão filtrados pela empresa, então a empresa fica fora da chave.
// Celular: versão vazia (cadastro antigo) conta como 'Global', igual ao cadastro por foto.
// Sem configuração (sem RAM+armazenamento), a chave usa as características normalizadas da variação.
function variantKey(product, model, phone) {
  const specs = core.object(product.specs);
  const cfg = core.configuration({ ...product, is_parent: 0 }, model);
  const version = value => norm(value) || (phone ? norm(DEFAULT_PRODUCT_VERSION) : '');
  const config = cfg ? [cfg.ram, cfg.storage, version(cfg.version), cfg.network, cfg.condition]
    : [norm(specs.ram ?? specs.memoria_ram), norm(specs.storage ?? specs.armazenamento), version(specs.version ?? specs.versao),
      norm(specs.network ?? specs.rede), norm(specs.condition || specs.condicao || 'new')];
  return JSON.stringify([...config, norm(specs.color ?? specs.cor)]);
}

async function findParent(conn, peers, children) {
  const local = peers.find(row => Number(row.is_parent) === 1);
  if (local) return local;
  const linked = children.map(row => row.parent_id).find(Boolean);
  if (linked) {
    const [[parent]] = await conn.query('SELECT id,sku FROM products WHERE id=? FOR UPDATE', [linked]);
    if (parent) return parent;
  }
  const blingParent = children.map(row => row.bling_parent_id).find(Boolean);
  if (blingParent) {
    const [[parent]] = await conn.query('SELECT id,sku FROM products WHERE bling_id=? AND COALESCE(is_parent,0)=1 FOR UPDATE', [blingParent]);
    if (parent) return parent;
  }
  return null;
}

async function createParent(ctx, model, company) {
  const name = String(model.name || '').trim();
  const { sku } = await nextSku(ctx.conn, { name }); // o pai mantém o nome do modelo, sem o SKU
  const id = crypto.randomUUID();
  // O pai nunca recebe IMEI, serial, estoque nem preço de venda.
  await ctx.conn.query(`INSERT INTO products
    (id,name,sku,model_id,company_id,category_id,brand,is_parent,parent_id,price_retail,price_reseller,
     price_wholesale,price_cost,stock_quantity,track_inventory,status,images,specs,slug)
    VALUES (?,?,?,?,?,?,?,1,NULL,0,0,0,NULL,0,0,'active','[]','{}',?)`,
  [id, name, sku, model.id, company, model.category_id || null, model.brand_name || null, `familia-${model.id}`]);
  ctx.created.add(id);
  return { id, sku };
}

async function insertProduct(ctx, { name, baseName, sku, model, categoryId, company, parentId, prices, cost, specs, images }) {
  const id = crypto.randomUUID();
  await ctx.conn.query(`INSERT INTO products (id,name,slug,sku,price_retail,price_wholesale,price_cost,price_reseller,
    stock_quantity,status,category_id,brand,model_id,parent_id,images,specs,track_inventory,company_id)
    VALUES (?,?,?,?,?,?,?,?,0,'active',?,?,?,?,?,?,1,?)`,
  [id, name, slugify([baseName || name, specs.ram, specs.storage, specs.color, sku].filter(Boolean).join(' ')), sku,
    prices.price_retail, prices.price_wholesale, cost ?? null, prices.price_reseller, categoryId || null,
    model?.brand_name || null, model?.id || null, parentId || null, JSON.stringify(images || []), JSON.stringify(specs), company]);
  ctx.created.add(id);
  return { id, sku, company_id: company };
}

async function colorImages(conn, modelId, company, color) {
  if (!color) return { images: [], color_id: null };
  const [rows] = await conn.query(`SELECT mci.color_id,mci.company_id,mci.images,mci.image_url,c.name AS color_name
    FROM model_color_images mci JOIN colors c ON c.id=mci.color_id
    WHERE mci.model_id=? AND (mci.company_id=? OR mci.company_id IS NULL)
    ORDER BY (mci.company_id=?) DESC, mci.updated_at DESC`, [modelId, company, company]);
  const row = rows.find(r => norm(r.color_name) === norm(color));
  if (!row) return { images: [], color_id: null };
  let saved = row.images;
  if (typeof saved === 'string') { try { saved = JSON.parse(saved); } catch { saved = []; } }
  const images = Array.isArray(saved) ? [...saved] : [];
  if (row.image_url && !images.includes(row.image_url)) images.push(row.image_url);
  return { images, color_id: row.color_id };
}

function itemPrices(item) {
  if (!completePrices(item.prices)) throw lineError('Informe varejo, revenda e atacado do produto novo.');
  return { source: 'item', prices: item.prices };
}

// Celular: o grupo da configuração manda. Sem grupo nem pares unânimes, o preço do item cria o grupo.
async function phonePrices(conn, item, priceModel, probe, rows) {
  const pick = product => Object.fromEntries(SALE.map(key => [key, Number(product[key])]));
  try {
    const result = await inheritSmartphonePrices(conn, probe, priceModel);
    return { source: 'group', prices: pick(result.product) };
  } catch (error) {
    if (error?.statusCode !== 409 || !/^Preços divergentes ou incompletos/.test(error.message)) throw error;
    // Mesmo critério de loadPeers: pares existentes com preços diferentes não se resolvem pelo preço do item.
    const config = core.configuration(probe, priceModel);
    const peers = config ? rows.filter(row => core.configuration(row, priceModel)?.id === config.id) : [];
    if (peers.length && !core.unanimousPrices(peers)) {
      throw lineError('Preços divergentes nesta configuração: revise em Modelos → Preços por configuração.');
    }
    if (!completePrices(item.prices)) throw lineError('Configuração sem preço: informe varejo, revenda e atacado.');
    const result = await inheritSmartphonePrices(conn, { ...probe, ...item.prices }, priceModel);
    return { source: 'group-new', prices: pick(result.product) };
  }
}

async function resolveFamily(ctx, item, line, phone) {
  const { conn } = ctx;
  const model = ctx.models.get(item.model_id);
  const priceModel = await loadModel(conn, model.id, true); // trava o modelo
  const company = scope(model.company_id, ctx.defaultCompanyId);
  const [rows] = await conn.query('SELECT * FROM products WHERE model_id=? ORDER BY id FOR UPDATE', [model.id]);
  const peers = rows.filter(row => scope(row.company_id, ctx.defaultCompanyId) === company);
  const children = peers.filter(row => !Number(row.is_parent) && !Number(row.is_print3d) && !Number(row.is_combo) && !row.offer_type);
  let parent = await findParent(conn, peers, children);
  const familyCreated = !parent;
  if (!parent) parent = await createParent(ctx, model, company);
  if (!parent.sku) throw lineError('O pai da família está sem SKU. Corrija o cadastro do pai.');
  line.family = familyCreated ? 'new' : 'existing';
  const specs = variantSpecs(item, core.object(model.template_values), phone);
  const probe = { model_id: model.id, company_id: company, is_parent: 0, specs };
  const key = variantKey(probe, model, phone);
  let variation = children.find(row => variantKey(row, model, phone) === key);
  const variationCreated = !variation;
  if (variation) {
    Object.assign(line, { variation: 'existing', price_source: 'existing', sku: variation.sku });
  } else {
    const price = phone ? await phonePrices(conn, item, priceModel, probe, rows) : itemPrices(item);
    const baseName = String(model.name).trim();
    const { sku, name } = await nextSku(conn, { name: baseName, parentSku: parent.sku });
    Object.assign(line, { variation: 'new', price_source: price.source, sku });
    const photos = await colorImages(conn, model.id, company, item.color);
    if (photos.color_id) specs.color_id = photos.color_id;
    variation = await insertProduct(ctx, { name, baseName, sku, model, categoryId: model.category_id, company,
      parentId: parent.id, prices: price.prices, cost: item.cost_cents, specs, images: photos.images });
  }
  await ensureSmartphoneModelFamily(conn, { modelId: model.id, companyId: company, defaultCompanyId: ctx.defaultCompanyId,
    productId: variation.id, anyCategory: !phone });
  return { id: variation.id, company_id: variation.company_id || company, familyCreated, variationCreated };
}

// Produto sem modelo: acha pelo nome exato na categoria ou cria um produto simples (sem família).
async function resolveSimple(ctx, item, line) {
  const { conn } = ctx;
  const category = ctx.categories.get(item.category_id);
  // Só produto simples: fora de família (sem modelo, sem pai, não é pai). Aceita o nome puro ou "<nome> - <SKU>".
  const [matches] = await conn.query(`SELECT id,sku,company_id FROM products WHERE category_id=?
    AND model_id IS NULL AND parent_id IS NULL AND COALESCE(is_parent,0)=0
    AND (LOWER(TRIM(name))=LOWER(?) OR LOWER(TRIM(name))=LOWER(CONCAT(?,' - ',sku)))
    ORDER BY id LIMIT 2 FOR UPDATE`, [category.id, item.name, item.name]);
  if (matches.length > 1) throw lineError('Mais de um produto com este nome nesta categoria; informe o modelo.');
  const found = matches[0];
  if (found) {
    Object.assign(line, { family: 'existing', variation: 'existing', price_source: 'existing', sku: found.sku });
    return { id: found.id, company_id: scope(found.company_id, ctx.defaultCompanyId), familyCreated: false, variationCreated: false };
  }
  const price = itemPrices(item);
  const { sku, name } = await nextSku(conn, { name: item.name });
  Object.assign(line, { family: 'new', variation: 'new', price_source: price.source, sku });
  const specs = variantSpecs(item, {}, false);
  const product = await insertProduct(ctx, { name, baseName: item.name, sku, model: null, categoryId: category.id, company: ctx.defaultCompanyId,
    parentId: null, prices: price.prices, cost: item.cost_cents, specs, images: [] });
  return { id: product.id, company_id: product.company_id, familyCreated: true, variationCreated: true };
}

async function addUnit(ctx, item, target, location) {
  const unitId = crypto.randomUUID();
  const notes = [`Entrada ${ctx.batchId}`, item.battery_health != null ? `Bateria ${item.battery_health}%` : null, item.condition_note]
    .filter(Boolean).join(' · ');
  await ctx.conn.query(`INSERT INTO units (id,product_id,imei_1,imei_2,serial,status,\`condition\`,internal_notes,cost_price,deposit_id,location_id)
    VALUES (?,?,?,?,?,'available',?,?,?,?,?)`,
  [unitId, target.id, item.identity.imei1, item.identity.imei2, item.identity.serial, item.configuration.condition, notes,
    item.cost_cents, location.deposit_id, location.id]);
  await ctx.deps.syncProductStock(target.id, ctx.conn);
  return unitId;
}

async function addQuantity(ctx, item, target, location) {
  const { conn } = ctx;
  const company = target.company_id || await ctx.deps.getDefaultCompanyId();
  const [rows] = await conn.query(`SELECT id,quantity FROM product_stock_locations
    WHERE product_id=? AND deposit_id=? AND location_id=? FOR UPDATE`, [target.id, location.deposit_id, location.id]);
  const previous = Number(rows[0]?.quantity || 0);
  const next = previous + item.quantity;
  if (rows[0]) await conn.query('UPDATE product_stock_locations SET quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [next, rows[0].id]);
  else await conn.query(`INSERT INTO product_stock_locations (id,company_id,product_id,deposit_id,location_id,quantity,reserved_quantity)
    VALUES (?,?,?,?,?,?,0)`, [crypto.randomUUID(), company, target.id, location.deposit_id, location.id, next]);
  await ctx.deps.insertStockMovement({ company_id: company, product_id: target.id, to_deposit_id: location.deposit_id,
    to_location_id: location.id, quantity: item.quantity, movement_type: 'in', reason: 'Entrada', reference_type: 'catalog_entry',
    reference_id: ctx.batchId, previous_to_quantity: previous, new_to_quantity: next, notes: item.condition_note || null }, conn);
  await ctx.deps.syncProductStockFromLocations(target.id, conn);
}

async function resolveItem(ctx, item, line) {
  const location = ctx.locations.get(item.location_id);
  if (!location) throw lineError('Local de estoque não encontrado.');
  const phone = isPhone(ctx, item);
  if (item.model_id && !ctx.models.get(item.model_id)) throw lineError('Modelo não encontrado.');
  if (!item.model_id) {
    if (!ctx.categories.get(item.category_id)) throw lineError('Categoria não encontrada.');
    if (phone) throw lineError('Celular precisa de modelo.');
  }
  if (line.stock.kind === 'unit') {
    if (item.quantity !== 1) throw lineError('Item com IMEI ou serial entra um por linha.');
    const hit = await findIdentifierConflict(ctx.conn, item.identity);
    if (hit) throw lineError(`${hit.label} ${hit.value} já cadastrado.`);
  }
  const target = item.model_id ? await resolveFamily(ctx, item, line, phone) : await resolveSimple(ctx, item, line);
  const kind = await productStockKind(ctx, target.id, phone, line.stock.kind);
  if (kind !== line.stock.kind) throw lineError(`Este produto controla estoque por ${STOCK_LABEL[kind]}; ajuste a linha.`);
  // Produto criado neste lote não tem id estável entre prévia e confirmação: o plano mostra só o SKU previsto.
  line.product_id = ctx.created.has(target.id) ? null : target.id;
  const unitId = line.stock.kind === 'unit' ? await addUnit(ctx, item, target, location) : null;
  if (!unitId) await addQuantity(ctx, item, target, location);
  return { line: item.line, product_id: target.id, unit_id: unitId, quantity: item.quantity,
    family_created: target.familyCreated ? 1 : 0, variation_created: target.variationCreated ? 1 : 0 };
}

async function recordBatch(conn, batchId, items, plan, hash, userId, writes) {
  const sources = [...new Set(items.map(item => item.source))];
  await conn.query('INSERT INTO catalog_entry_batches (id,source,created_by,plan_hash,line_count) VALUES (?,?,?,?,?)',
    [batchId, sources.length === 1 ? sources[0] : 'misto', userId || null, hash, plan.length]);
  for (const w of writes) {
    await conn.query(`INSERT INTO catalog_entry_lines (id,batch_id,line,product_id,unit_id,quantity,family_created,variation_created)
      VALUES (?,?,?,?,?,?,?,?)`, [crypto.randomUUID(), batchId, w.line, w.product_id, w.unit_id, w.quantity, w.family_created, w.variation_created]);
  }
}

async function runCatalogEntry(pool, rawItems, { commit = false, expectedHash, userId, deps } = {}) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw httpError(400, 'Envie ao menos um item.');
  await ensureCatalogEntrySchema(pool);
  await ensureSmartphonePriceGroupsSchema(pool);
  const defaultCompanyId = await deps.getDefaultCompanyId();
  const conn = await pool.getConnection();
  let locked = false;
  let open = false;
  let broken = false;
  try {
    const [locks] = await conn.query('SELECT GET_LOCK(?, 15) AS acquired', [SKU_LOCK]);
    locked = Number(locks[0]?.acquired) === 1;
    if (!locked) throw httpError(409, 'Não foi possível reservar o SKU. Tente novamente.');
    await conn.beginTransaction();
    open = true;
    const ctx = { conn, deps, defaultCompanyId, batchId: crypto.randomUUID(), created: new Set(),
      models: new Map(), categories: new Map(), locations: new Map() };
    const normalized = rawItems.map((raw, index) => normalizeEntryItem(raw, index));
    for (const item of normalized) await loadRefs(ctx, item);
    const items = validateEntryBatch(normalized, { isSmartphone: item => isPhone(ctx, item) });
    const plan = [];
    const writes = [];
    for (const item of items) {
      const line = { line: item.line, product_id: null, sku: null, family: null, variation: null, price_source: null,
        stock: { kind: stockKind(ctx, item), quantity: item.quantity }, errors: [...item.errors] };
      plan.push(line);
      if (line.errors.length) continue;
      const savepoint = `catalog_entry_line_${item.line}`;
      await conn.query(`SAVEPOINT ${savepoint}`);
      try {
        writes.push(await resolveItem(ctx, item, line));
        await conn.query(`RELEASE SAVEPOINT ${savepoint}`);
      } catch (error) {
        if (!isRuleError(error)) throw error;
        await conn.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        Object.assign(line, { product_id: null, sku: null, family: null, variation: null, price_source: null });
        line.errors.push(error.message);
      }
    }
    const hash = planHash(plan, normalized);
    const ok = plan.every(line => !line.errors.length);
    if (!commit || !ok) {
      await conn.rollback();
      open = false; // só depois do ROLLBACK confirmado
      return { ok, plan, hash };
    }
    if (hash !== expectedHash) throw httpError(409, 'O lote mudou desde a conferência. Confira novamente.');
    await recordBatch(conn, ctx.batchId, items, plan, hash, userId, writes);
    await conn.commit();
    open = false;
    return { ok: true, plan, hash, batch_id: ctx.batchId };
  } catch (error) {
    if (open) await conn.rollback().catch(() => { broken = true; });
    throw error;
  } finally {
    // Conexão com ROLLBACK falho pode estar no meio da transação: descarta (o MySQL solta o lock ao fechar).
    if (broken) conn.destroy();
    else { try { if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [SKU_LOCK]); } finally { conn.release(); } }
  }
}

const MAX_ITEMS = 500;

// getActorId(request) → id do usuário (ou null). O preHandler de auth não preenche request.user.
function registerCatalogEntryRoutes(fastify, { pool, auth, deps, getActorId }) {
  const opts = { preHandler: auth };
  const actor = async request => (typeof getActorId === 'function' ? (await getActorId(request)) || null : null);
  // Memoizado: o boot não bloqueia nem cai; cada handler espera o schema antes de usar.
  const ready = () => ensureCatalogEntrySchema(pool);
  ready().catch(() => {});

  function checkItems(body, reply) {
    const items = body?.items;
    if (!Array.isArray(items) || !items.length) { reply.code(400).send({ error: 'Envie a lista de itens.' }); return null; }
    if (items.length > MAX_ITEMS) { reply.code(400).send({ error: 'Lote acima de 500 itens.' }); return null; }
    return items;
  }
  function fail(reply, error) {
    const status = Number(error?.statusCode);
    if (status >= 400 && status < 500) return reply.code(status).send({ error: error.message });
    fastify.log?.error?.(error);
    return reply.code(500).send({ error: 'Erro ao processar a entrada.' });
  }

  fastify.post('/catalog-entries/preview', opts, async (request, reply) => {
    const items = checkItems(request.body, reply);
    if (!items) return reply;
    try {
      await ready();
      const { ok, plan, hash } = await runCatalogEntry(pool, items, { commit: false, deps });
      return reply.code(200).send({ ok, plan, hash });
    } catch (error) { return fail(reply, error); }
  });

  fastify.post('/catalog-entries', opts, async (request, reply) => {
    const items = checkItems(request.body, reply);
    if (!items) return reply;
    try {
      await ready();
      const result = await runCatalogEntry(pool, items, { commit: true, expectedHash: request.body.preview_hash,
        userId: await actor(request), deps });
      if (!result.ok) return reply.code(422).send({ plan: result.plan });
      return reply.code(201).send({ batch_id: result.batch_id, plan: result.plan });
    } catch (error) { return fail(reply, error); }
  });

  fastify.get('/catalog-entries/:id', opts, async (request, reply) => {
    try {
      await ready();
      const [[batch]] = await pool.query('SELECT * FROM catalog_entry_batches WHERE id=?', [request.params.id]);
      if (!batch) return reply.code(404).send({ error: 'Lote não encontrado.' });
      const [lines] = await pool.query('SELECT * FROM catalog_entry_lines WHERE batch_id=? ORDER BY line', [request.params.id]);
      return reply.send({ batch, lines });
    } catch (error) { return fail(reply, error); }
  });
}

module.exports = { ensureCatalogEntrySchema, runCatalogEntry, registerCatalogEntryRoutes };

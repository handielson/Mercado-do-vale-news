'use strict';

const crypto = require('crypto');
const core = require('./smartphonePriceGroupsCore.cjs');
const schemaPromises = new WeakMap();
const modelSpecsSanitized = Symbol('modelSpecsSanitized');
async function sanitizeModelSpecifications(product, model, existing = null, db) {
  if (!core.isSmartphoneCategory(model?.category_name) || Number(product.is_print3d) === 1 || Number(product.is_combo) === 1 || product.offer_type) return product;
  const { stripModelOwnedSpecs, stripModelTechnicalCustomFields, DEFAULT_PRODUCT_VERSION } = await import('./smartphoneModelSpecs.mjs');
  const template = core.object(model.template_values);
  // Financial metadata comes from locked DB state; a client cannot move its group.
  const reference = stripModelOwnedSpecs(existing ? existing.specs : {}, template);
  const mergedSpecs = { ...core.object(existing?.specs), ...core.object(product.specs) };
  delete mergedSpecs._price_group_network;
  const specs = stripModelOwnedSpecs(mergedSpecs, undefined, false);
  if (Number(product.is_parent) !== 1 && !String(specs.version || '').trim()) {
    const previousVersion = String(core.object(existing?.specs).version || '').trim();
    if (previousVersion) specs.version = previousVersion;
    else if (String(specs.versao || '').trim()) {
      const [versions] = await db.query('SELECT name FROM versions WHERE id=? OR name=? LIMIT 1', [specs.versao, specs.versao]);
      if (!versions[0]?.name) throw conflict('Confira a versão comercial deste aparelho antes de salvar.');
      specs.version = versions[0].name;
    } else specs.version = DEFAULT_PRODUCT_VERSION;
  }
  specs._price_group_network = reference._price_group_network;
  return { ...product, specs,
    custom_fields: stripModelTechnicalCustomFields({ ...core.object(existing?.custom_fields), ...core.object(product.custom_fields) }, template, mergedSpecs),
    [modelSpecsSanitized]: true };
}
function conflict(message) { return Object.assign(new Error(message), { statusCode: 409 }); }
function ensureSmartphonePriceGroupsSchema(pool) {
  if (!schemaPromises.has(pool)) {
    schemaPromises.set(pool, pool.query(`CREATE TABLE IF NOT EXISTS smartphone_price_groups (
      id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      model_id VARCHAR(64) NOT NULL,
      company_id VARCHAR(64) NULL,
      configuration JSON NOT NULL,
      price_retail INT NOT NULL,
      price_reseller INT NOT NULL,
      price_wholesale INT NOT NULL,
      revision INT NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_smartphone_prices_model (model_id)
    ) ENGINE=InnoDB`).catch((error) => {
      schemaPromises.delete(pool);
      throw error;
    }));
  }
  return schemaPromises.get(pool);
}
async function loadModel(db, id, lock = false) {
  const [rows] = await db.query(`SELECT m.id,m.name,m.company_id,m.template_values,c.name AS category_name
    FROM models m LEFT JOIN categories c ON c.id=m.category_id WHERE m.id=?${lock ? ' FOR UPDATE' : ''}`, [id]);
  return rows[0];
}
async function loadPeers(db, config, model, lock = false) {
  const [rows] = await db.query(`SELECT id,model_id,company_id,name,sku,specs,is_print3d,is_parent,is_combo,offer_type,status,stock_quantity,
    price_cost,price_retail,price_reseller,price_wholesale FROM products
    WHERE model_id=?${lock ? ' FOR UPDATE' : ''}`, [config.model_id]);
  return rows.filter(p => core.configuration(p, model)?.id === config.id);
}
async function loadGroup(db, id) {
  const [rows] = await db.query('SELECT * FROM smartphone_price_groups WHERE id=?', [id]);
  return rows[0] || null;
}
async function saveGroup(db, config, prices) {
  await db.query(`INSERT INTO smartphone_price_groups (id,model_id,company_id,configuration,price_retail,price_reseller,price_wholesale)
    VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE price_retail=VALUES(price_retail),
    price_reseller=VALUES(price_reseller),price_wholesale=VALUES(price_wholesale),revision=revision+1`,
  [config.id, config.model_id, config.company_id, JSON.stringify(config), ...core.SALE_FIELDS.map(f => prices[f])]);
}

// Caller owns the transaction and must lock the model before writing products.
async function inheritSmartphonePrices(db, product, model, existing = null) {
  if (Number(product.is_print3d) === 1 || !core.isSmartphoneCategory(model?.category_name)) return { product, controlled: false };
  const config = core.configuration(product, model);
  if (!config) {
    if (Number(product.is_parent) === 1 || Number(product.is_combo) === 1 || product.offer_type) return { product, controlled: false };
    throw conflict('Preencha modelo, RAM física e armazenamento do celular antes de salvar.');
  }
  const group = await loadGroup(db, config.id);
  let salePrices = core.prices(group);
  if (!group) {
    const peers = await loadPeers(db, config, model, true);
    // Existing rows, including the edited product, are the reference. An incoming cost never chooses a price.
    salePrices = peers.length ? core.unanimousPrices(peers) : core.prices(product);
    if (!salePrices && existing && core.configuration(existing, model)?.id === config.id) {
      // Keep stock/cost updates working while legacy divergence awaits explicit review.
      return { product: { ...product, ...Object.fromEntries(core.SALE_FIELDS.map(f => [f, existing[f]])) }, controlled: true, pending_review: true };
    }
    if (!salePrices) throw conflict('Preços divergentes ou incompletos neste grupo. Revise em Configurações → Modelos → Preços por configuração.');
    await saveGroup(db, config, salePrices);
  }
  if (!salePrices) throw conflict('Preço do grupo inválido. Revise os preços do modelo.');
  return { product: { ...product, ...salePrices }, controlled: true, group_id: config.id };
}

async function withSmartphonePriceWrite(pool, incoming, write, { transactional = false } = {}) {
  await ensureSmartphonePriceGroupsSchema(pool);
  let existing;
  if (incoming.id || incoming.sku) {
    const [rows] = await pool.query(`SELECT * FROM products WHERE ${incoming.id ? 'id' : 'sku'}=?`, [incoming.id || incoming.sku]);
    if (rows.length > 1) throw conflict('SKU duplicado. Identifique o produto pelo ID.');
    existing = rows[0];
  }
  const candidate = { ...existing, ...incoming, model_id: incoming.model_id || existing?.model_id };
  const model = candidate.model_id ? await loadModel(pool, candidate.model_id) : null;
  if (!candidate.model_id || !core.isSmartphoneCategory(model?.category_name)) {
    if (!transactional) return write(pool, incoming);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const output = await write(connection, incoming);
      await connection.commit();
      return output;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const lockedModel = await loadModel(connection, candidate.model_id, true);
    let current = existing;
    if (existing) {
      const [rows] = await connection.query('SELECT * FROM products WHERE id=? FOR UPDATE', [existing.id]);
      current = rows[0];
      if (!current || current.model_id !== existing.model_id) throw conflict('Produto alterado por outra operação. Recarregue e tente novamente.');
    }
    const prepared = await sanitizeModelSpecifications({ ...current, ...incoming, model_id: candidate.model_id }, lockedModel, current, connection);
    const result = await inheritSmartphonePrices(connection, prepared, lockedModel, current);
    const output = await write(connection, result.product);
    await connection.commit();
    return output;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

function presentGroup(config, saved, products, model) {
  const salePrices = saved ? core.prices(saved) : core.unanimousPrices(products);
  const costs = [];
  let stockCost = 0;
  let costedStock = 0;
  for (const product of products) {
    if (product.status && product.status !== 'active') continue;
    const quantity = Number(product.stock_quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (product.has_serialized_units) {
      for (const cost of product.unit_costs) {
        if (!Number.isSafeInteger(cost) || cost < 0) continue;
        costs.push(cost);
        stockCost += cost;
        costedStock += 1;
      }
    } else if (product.price_cost != null && Number.isSafeInteger(Number(product.price_cost)) && Number(product.price_cost) >= 0) {
      costs.push(Number(product.price_cost));
      stockCost += Number(product.price_cost) * quantity;
      costedStock += quantity;
    }
  }
  const lastPurchase = products.map(product => product.last_unit_purchase).filter(Boolean)
    .sort((a, b) => b.time - a.time || String(b.id).localeCompare(String(a.id)))[0];
  return {
    ...config, model_name: model.name, revision: core.revision(saved, products), prices: salePrices,
    confirmed: Boolean(saved), divergent: !salePrices || products.some(p => !core.samePrices(p, salePrices)),
    cost_min: costs.length ? Math.min(...costs) : null, cost_max: costs.length ? Math.max(...costs) : null,
    cost_average_in_stock: costedStock > 0 ? Math.round(stockCost / costedStock) : null,
    last_purchase_cost: lastPurchase?.cost ?? null,
    last_purchase_at: lastPurchase ? new Date(lastPurchase.time).toISOString() : null,
    products: products.map(p => ({ id: p.id, sku: p.sku, name: p.name, color: core.object(p.specs).color || core.object(p.specs).cor || '',
      stock_quantity: Number(p.stock_quantity || 0), price_cost: p.price_cost == null ? null : Number(p.price_cost), unit_costs: p.unit_costs || [], available_unit_count: p.available_unit_count || 0,
      ...Object.fromEntries(core.SALE_FIELDS.map(f => [f, p[f] == null ? null : Number(p[f])])) })),
  };
}

function registerSmartphonePriceGroupRoutes(fastify, { pool, requireSyncKey, inventoryCosts = require('./smartphoneMovingAverageServer.cjs').preview }) {
  fastify.addHook('onRequest', async (req, reply) => {
    const path = decodeURIComponent(String(req.url || '').split('?')[0]);
    if (/^\/table-data\/smartphone_(inventory_cost_state|inventory_cost_events|sale_cost_basis)(?:\/|$)/i.test(path)) {
      return reply.code(403).send({ error: 'Saldo e histórico de custo são controlados pelas vendas.' });
    }
  });
  fastify.get('/sales/:id/cost-basis', { preHandler: requireSyncKey }, async req =>
    require('./smartphoneMovingAverageServer.cjs').saleCostBasisInfo(pool, req.params.id));
  fastify.addHook('preHandler', async (req, reply) => {
    const path = decodeURIComponent(String(req.url || '').split('?')[0]);
    const saleMatch = path.match(/^\/table-data\/sales\/([^/]+)$/);
    if (req.method === 'PATCH' && saleMatch && ['cost_total','profit'].some(key => Object.hasOwn(req.body || {},key))) {
      const [[sale]] = await pool.query(`SELECT cost_total,profit,created_at < (SELECT MIN(initialized_at) FROM smartphone_inventory_cost_state) AS historical FROM sales WHERE id=?`,[saleMatch[1]]);
      if (Number(sale?.historical) && ['cost_total','profit'].some(key => Object.hasOwn(req.body || {},key) && Number(req.body[key]) !== Number(sale[key]))) {
        return reply.code(409).send({error:'Os custos e o lucro das vendas anteriores à ativação são preservados.'});
      }
    }
    const match = path.match(/^\/table-data\/sale_items\/([^/]+)$/);
    if (req.method !== 'PATCH' || !match || !Object.hasOwn(req.body || {}, 'unit_cost')) return;
    const [[old]] = await pool.query(`SELECT i.unit_cost,s.created_at < (SELECT MIN(initialized_at) FROM smartphone_inventory_cost_state) AS historical
      FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE i.id=?`, [match[1]]);
    if (Number(old?.historical) && Number(req.body.unit_cost) !== Number(old.unit_cost)) {
      return reply.code(409).send({error:'O custo das vendas anteriores à ativação é preservado.'});
    }
    const [[basis]] = await pool.query(`SELECT b.unit_cost FROM sale_items i JOIN smartphone_sale_cost_basis b
      ON b.sale_id=i.sale_id AND b.unit_id=i.serialized_unit_id WHERE i.id=?`, [match[1]]);
    if (basis && (basis.unit_cost == null || Number(req.body.unit_cost) !== Number(basis.unit_cost))) {
      return reply.code(409).send({ error: 'O custo médio registrado nesta venda é imutável.' });
    }
  });
  fastify.post('/models/:id/smartphone-price-reference', { preHandler: requireSyncKey }, async (req) => {
    await ensureSmartphonePriceGroupsSchema(pool);
    const model = await loadModel(pool, req.params.id);
    if (Number(req.body?.is_print3d) === 1 || !core.isSmartphoneCategory(model?.category_name)) return { controlled: false };
    const config = core.configuration({ ...req.body, model_id: req.params.id }, model);
    if (!config) return { controlled: true, prices: null, incomplete: true };
    const saved = await loadGroup(pool, config.id);
    const peers = await loadPeers(pool, config, model);
    const salePrices = saved ? core.prices(saved) : core.unanimousPrices(peers);
    const valuations = await inventoryCosts(pool, model);
    return { controlled: true, prices: salePrices, divergent: peers.length > 0 && !salePrices, group_id: config.id, established: Boolean(saved || peers.length),
      moving_average_cost: valuations[config.id]?.moving_average_cost ?? null };
  });
  fastify.get('/models/:id/smartphone-price-groups', { preHandler: requireSyncKey }, async (req, reply) => {
    await ensureSmartphonePriceGroupsSchema(pool);
    reply.header('Cache-Control', 'no-store');
    const model = await loadModel(pool, req.params.id);
    if (!model) return reply.code(404).send({ error: 'Modelo não encontrado' });
    if (!core.isSmartphoneCategory(model.category_name)) return { enabled: false, groups: [], unresolved: [] };
    const [products] = await pool.query(`SELECT id,model_id,company_id,name,sku,specs,is_print3d,is_parent,is_combo,offer_type,status,stock_quantity,
      price_cost,price_retail,price_reseller,price_wholesale FROM products WHERE model_id=? AND COALESCE(is_parent,0)=0 AND COALESCE(is_combo,0)=0 AND offer_type IS NULL`, [model.id]);
    const [saved] = await pool.query('SELECT * FROM smartphone_price_groups WHERE model_id=?', [model.id]);
    const [units] = await pool.query(`SELECT u.id,u.product_id,u.cost_price,u.status,u.created_at FROM units u JOIN products p ON p.id=u.product_id
      WHERE p.model_id=? ORDER BY u.product_id,u.cost_price`, [model.id]);
    const unitCosts = new Map();
    const unitCounts = new Map();
    const serializedProducts = new Set();
    const lastPurchases = new Map();
    for (const unit of units) {
      serializedProducts.add(unit.product_id);
      const cost = unit.cost_price == null ? null : Number(unit.cost_price);
      const time = unit.created_at ? new Date(unit.created_at).getTime() : NaN;
      const previous = lastPurchases.get(unit.product_id);
      if (cost != null && Number.isSafeInteger(cost) && cost >= 0 && Number.isFinite(time)
          && (!previous || time > previous.time || (time === previous.time && String(unit.id) > String(previous.id)))) {
        lastPurchases.set(unit.product_id, { cost, time, id: unit.id });
      }
      if (unit.status !== 'available') continue;
      unitCounts.set(unit.product_id, (unitCounts.get(unit.product_id) || 0) + 1);
      if (!unitCosts.has(unit.product_id)) unitCosts.set(unit.product_id, []);
      if (unit.cost_price != null) unitCosts.get(unit.product_id).push(Number(unit.cost_price));
    }
    for (const product of products) {
      product.unit_costs = unitCosts.get(product.id) || [];
      product.available_unit_count = unitCounts.get(product.id) || 0;
      product.has_serialized_units = serializedProducts.has(product.id);
      product.last_unit_purchase = lastPurchases.get(product.id) || null;
    }
    const groups = new Map();
    const unresolved = [];
    for (const p of products) {
      if (Number(p.is_print3d) === 1) continue;
      const config = core.configuration(p, model);
      if (!config) { unresolved.push({ id: p.id, sku: p.sku, name: p.name }); continue; }
      if (!groups.has(config.id)) groups.set(config.id, { config, products: [] });
      groups.get(config.id).products.push(p);
    }
    const valuations = await inventoryCosts(pool, model);
    return { enabled: true, unresolved, groups: [...groups.values()].map(g => ({
      ...presentGroup(g.config, saved.find(s => s.id === g.config.id), g.products, model), ...valuations[g.config.id],
    })) };
  });

  fastify.put('/models/:id/smartphone-price-groups/:groupId', { preHandler: requireSyncKey }, async (req, reply) => {
    await ensureSmartphonePriceGroupsSchema(pool);
    const salePrices = core.prices(req.body?.prices);
    if (!salePrices || !req.body?.revision || !req.body?.product_id) return reply.code(400).send({ error: 'Informe os três preços em centavos e recarregue o grupo antes de salvar.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const model = await loadModel(connection, req.params.id, true);
      if (!core.isSmartphoneCategory(model?.category_name)) throw conflict('Modelo não é um celular.');
      const [rows] = await connection.query('SELECT * FROM products WHERE id=? FOR UPDATE', [req.body.product_id]);
      const config = core.configuration(rows[0], model);
      if (!config || config.model_id !== req.params.id || config.id !== req.params.groupId) throw conflict('A configuração mudou. Recarregue os grupos.');
      const peers = await loadPeers(connection, config, model, true);
      const saved = await loadGroup(connection, config.id);
      if (core.revision(saved, peers) !== req.body.revision) throw conflict('Preços ou produtos alterados por outra operação. Recarregue antes de salvar.');
      await saveGroup(connection, config, salePrices);
      for (const p of peers) {
        if (core.samePrices(p, salePrices)) continue;
        await connection.query('UPDATE products SET price_retail=?,price_reseller=?,price_wholesale=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [...core.SALE_FIELDS.map(f => salePrices[f]), p.id]);
        await connection.query(`INSERT INTO product_price_history (id,product_id,price_cost,price_retail,price_reseller,price_wholesale)
          VALUES (?,?,?,?,?,?)`, [crypto.randomUUID(), p.id, p.price_cost, ...core.SALE_FIELDS.map(f => salePrices[f])]);
      }
      await connection.commit();
      return { ok: true, updated: peers.length };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  });
}
async function patchProductWithGroupPrices(pool, id, payload) {
  const [registeredProducts] = await pool.query('SELECT sku FROM products WHERE id=? LIMIT 1', [id]);
  const registeredSku = registeredProducts[0]?.sku ?? null;
  if (registeredProducts.length && Object.hasOwn(payload || {}, 'sku')
    && String(payload.sku ?? '').trim() !== String(registeredSku ?? '').trim()) {
    throw conflict('O SKU é definido pelo sistema no cadastro inicial e não pode ser alterado.');
  }
  const safePayload = { ...(payload || {}) };
  delete safePayload.sku;
  return withSmartphonePriceWrite(pool, { ...safePayload, id }, async (db, controlled) => {
    const keys = [...new Set([...Object.keys(safePayload).filter(k => k !== 'id'), ...core.SALE_FIELDS.filter(f => controlled[f] !== undefined), ...(controlled[modelSpecsSanitized] ? ['specs', 'custom_fields'] : [])])];
    if (!keys.length) return;
    if (keys.some(k => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k))) throw new Error('Campo inválido');
    await db.query(`UPDATE products SET ${keys.map(k => `\`${k}\`=?`).join(',')} WHERE id=?`,
      [...keys.map(k => controlled[k] != null && typeof controlled[k] === 'object' ? JSON.stringify(controlled[k]) : controlled[k] ?? null), id]);
  });
}
async function insertProductRecordsWithGroupPrices(pool, records, upsert = false, conflictColumn = 'id') {
  await ensureSmartphonePriceGroupsSchema(pool);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(conflictColumn)) throw new Error('Campo inválido');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const prepared = [];
    for (const row of records) {
      let existing;
      if (upsert && row[conflictColumn] != null) {
        const [found] = await connection.query(`SELECT * FROM products WHERE \`${conflictColumn}\`=?`, [row[conflictColumn]]);
        if (found.length > 1) throw conflict('Mais de um produto corresponde ao vínculo informado.');
        existing = found[0];
      }
      const incoming = { ...row, id: existing?.id || row.id || crypto.randomUUID() };
      prepared.push({ incoming, existing, modelId: row.model_id || existing?.model_id });
    }
    const models = new Map();
    for (const id of [...new Set(prepared.map(p => p.modelId).filter(Boolean))].sort()) models.set(id, await loadModel(connection, id, true));
    for (const item of prepared) {
      let existing = item.existing;
      if (existing) {
        const [current] = await connection.query('SELECT * FROM products WHERE id=? FOR UPDATE', [existing.id]);
        if (!current[0] || current[0].model_id !== existing.model_id) throw conflict('Produto alterado. Recarregue antes de salvar.');
        existing = current[0];
        if (Object.hasOwn(item.incoming, 'sku')
          && String(item.incoming.sku ?? '').trim() !== String(existing.sku ?? '').trim()) {
          throw conflict('O SKU é definido pelo sistema no cadastro inicial e não pode ser alterado.');
        }
        item.incoming.sku = existing.sku;
      }
      const prepared = await sanitizeModelSpecifications({ ...existing, ...item.incoming, model_id: item.modelId }, models.get(item.modelId), existing);
      const inherited = await inheritSmartphonePrices(connection, prepared, models.get(item.modelId), existing);
      const payload = { ...item.incoming, ...(inherited.controlled ? Object.fromEntries(core.SALE_FIELDS.map(f => [f, inherited.product[f]])) : {}),
        ...(prepared[modelSpecsSanitized] ? { specs: inherited.product.specs, custom_fields: inherited.product.custom_fields } : {}) };
      const keys = Object.keys(payload).filter(k => payload[k] !== undefined);
      if (keys.some(k => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k))) throw new Error('Campo inválido');
      const updates = keys.filter(k => k !== 'id' && k !== conflictColumn && (!existing || k !== 'sku')).map(k => `\`${k}\`=VALUES(\`${k}\`)`).join(',');
      await connection.query(`INSERT INTO products (${keys.map(k => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})${upsert ? ` ON DUPLICATE KEY UPDATE ${updates || 'id=id'}` : ''}`,
        keys.map(k => payload[k] != null && typeof payload[k] === 'object' ? JSON.stringify(payload[k]) : payload[k]));
    }
    await connection.commit();
    return prepared.map(p => p.incoming.id);
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
module.exports = { ensureSmartphonePriceGroupsSchema, inheritSmartphonePrices, withSmartphonePriceWrite, patchProductWithGroupPrices, insertProductRecordsWithGroupPrices, registerSmartphonePriceGroupRoutes, loadModel, presentGroup };

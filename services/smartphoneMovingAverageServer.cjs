'use strict';
const core = require('./smartphoneMovingAverageCore.cjs');
const prices = require('./smartphonePriceGroupsCore.cjs');
const EVENT_TYPES = "('unit_insert','unit_update','unit_delete','product_update','product_delete')";
const costTransaction = Symbol('smartphoneCostTransaction');
async function modelsForProducts(db, productIds) {
  if (!productIds.length) return [];
  const [rows] = await db.query(`SELECT DISTINCT m.id,m.name,m.company_id,m.template_values,c.name category_name
    FROM products p JOIN models m ON m.id=p.model_id LEFT JOIN categories c ON c.id=m.category_id
    WHERE p.id IN (?) ORDER BY m.id`, [productIds]);
  return rows.filter(m => prices.isSmartphoneCategory(m.category_name));
}
async function load(db, model, { lock = false } = {}) {
  if (lock) {
    const [[current]] = await db.query(`SELECT id,name,company_id,template_values FROM models WHERE id=? FOR UPDATE`, [model.id]);
    if (!current) throw Object.assign(new Error('Modelo não encontrado.'), { statusCode: 409 });
    model = { ...model, ...current };
  }
  const [[saved]] = await db.query(`SELECT state,initialized_at FROM smartphone_inventory_cost_state WHERE model_id=?${lock ? ' FOR UPDATE' : ''}`, [model.id]);
  const [events] = await db.query(`SELECT CAST(e.id AS CHAR) id,e.before_data,e.after_data FROM unit_journal_events e
    LEFT JOIN smartphone_inventory_cost_events done ON done.model_id=? AND done.event_id=e.id
    WHERE done.event_id IS NULL AND e.event_type IN ${EVENT_TYPES}
      AND (JSON_UNQUOTE(JSON_EXTRACT(e.after_data,'$.product.model_id'))=?
        OR JSON_UNQUOTE(JSON_EXTRACT(e.before_data,'$.product.model_id'))=?) ORDER BY e.id${lock ? ' FOR UPDATE' : ''}`, [model.id, model.id, model.id]);
  let state;
  const snapshots = [];
  if (saved) {
    state = prices.object(saved.state);
    if (state.version !== 1) throw new Error('Versão do saldo de custo não suportada.');
    for (const event of events) {
      const snapshot = core.applyEvent(state, event, model);
      if (snapshot) snapshots.push(snapshot);
    }
  } else {
    // A consistent transaction snapshot pairs this baseline with the journal IDs
    // already visible. IDs are acknowledged individually: late commits aren't lost
    // behind an AUTO_INCREMENT high-water mark.
    const [units] = await db.query(`SELECT u.id,u.product_id,u.status,u.cost_price FROM units u
      JOIN products p ON p.id=u.product_id WHERE p.model_id=? ORDER BY u.id${lock ? ' FOR UPDATE' : ''}`, [model.id]);
    const [products] = await db.query(`SELECT * FROM products WHERE model_id=?${lock ? ' FOR UPDATE' : ''}`, [model.id]);
    const byId = new Map(products.map(p => [p.id, p]));
    state = core.initialize(units.map(unit => ({ unit, product: byId.get(unit.product_id) })), model);
  }
  return { model, state, events, snapshots, initialized: Boolean(saved), initialized_at: saved?.initialized_at };
}
async function save(db, ledger, { skipSaleId = null } = {}) {
  await db.query(`INSERT INTO smartphone_inventory_cost_state (model_id,state) VALUES (?,?)
    ON DUPLICATE KEY UPDATE state=VALUES(state)`, [ledger.model.id, JSON.stringify(ledger.state)]);
  for (const event of ledger.events) await db.query('INSERT IGNORE INTO smartphone_inventory_cost_events (model_id,event_id) VALUES (?,?)', [ledger.model.id, event.id]);
  const eligible = [];
  for (const snapshot of ledger.snapshots) {
    if (snapshot.sale_id !== skipSaleId && ledger.initialized_at) {
      const [[prior]] = await db.query('SELECT id FROM sales WHERE id=? AND created_at<?', [snapshot.sale_id, ledger.initialized_at]);
      if (prior) continue;
    }
    await db.query(`INSERT IGNORE INTO smartphone_sale_cost_basis
      (sale_id,unit_id,configuration_id,unit_cost,purchase_cost) VALUES (?,?,?,?,?)`,
    [snapshot.sale_id, snapshot.unit_id, snapshot.configuration_id, snapshot.unit_cost, snapshot.purchase_cost]);
    eligible.push(snapshot);
  }
  // Journal-backed sales from other unit writers get the same immutable basis.
  // Only sales created after activation may be adjusted; earlier sales are untouched.
  for (const snapshot of eligible) {
    if (snapshot.sale_id === skipSaleId || snapshot.unit_cost == null || !ledger.initialized_at) continue;
    const [[sale]] = await db.query('SELECT * FROM sales WHERE id=? AND created_at>=? FOR UPDATE', [snapshot.sale_id, ledger.initialized_at]);
    if (!sale) continue;
    const [[fixed]] = await db.query('SELECT unit_cost FROM smartphone_sale_cost_basis WHERE sale_id=? AND unit_id=?', [snapshot.sale_id, snapshot.unit_id]);
    if (fixed?.unit_cost == null) continue;
    await db.query('UPDATE sale_items SET unit_cost=? WHERE sale_id=? AND serialized_unit_id=?', [fixed.unit_cost, snapshot.sale_id, snapshot.unit_id]);
    const [[cost]] = await db.query('SELECT COALESCE(SUM(unit_cost*quantity),0) total FROM sale_items WHERE sale_id=?', [snapshot.sale_id]);
    const payments = typeof sale.payment_methods === 'string' ? JSON.parse(sale.payment_methods || '[]') : sale.payment_methods || [];
    const fees = payments.reduce((sum, p) => sum + Number(p.operator_fee_amount || 0), 0);
    const profit = Number(sale.total) - Number(cost.total) - fees - Number(sale.delivery_total || 0);
    await db.query('UPDATE sales SET cost_total=?,profit=? WHERE id=?', [cost.total, profit, sale.id]);
  }
}
async function prepareSale(db, sale, items) {
  const models = await modelsForProducts(db, items.filter(i => i.serialized_unit_id).map(i => i.product_id));
  const ledgers = [];
  // Same model lock precedes all product/unit locks; stable across multi-model sales.
  for (const model of models) ledgers.push(await load(db, model, { lock: true }));
  db[costTransaction] = true;
  return {
    ledgers,
    apply(product, unit, item) {
      const ledger = ledgers.find(l => l.model.id === product.model_id);
      if (!ledger) return false;
      if (!prices.configuration(product, ledger.model)) throw Object.assign(new Error('Confira memória, versão e configuração do aparelho antes de vender.'), { statusCode: 409 });
      const snapshot = core.applyUnit(ledger.state, product, { ...unit, status: 'sold', sale_id: sale.id }, ledger.model, { strictSale: true });
      if (!snapshot || snapshot.unit_cost == null) throw Object.assign(new Error('Custo médio indisponível. Confira as entradas desta configuração.'), { statusCode: 409 });
      item.unit_cost = snapshot.unit_cost;
      ledger.snapshots.push(snapshot);
      return true;
    },
    async persist() { for (const ledger of ledgers) await save(db, ledger, { skipSaleId: sale.id }); },
    release() { delete db[costTransaction]; },
  };
}
async function saleBasis(db, saleId) {
  const [rows] = await db.query('SELECT unit_id,configuration_id,unit_cost,purchase_cost FROM smartphone_sale_cost_basis WHERE sale_id=?', [saleId]);
  return rows;
}
async function saleCostBasisInfo(db, saleId) {
  const rows = await saleBasis(db, saleId);
  const [[sale]] = await db.query(`SELECT s.created_at < (SELECT MIN(initialized_at) FROM smartphone_inventory_cost_state) AS historical
    FROM sales s WHERE s.id=?`, [saleId]);
  return { rows, historical: Boolean(Number(sale?.historical)) };
}
async function preview(pool, model) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const ledger = await load(db, model);
    await db.rollback();
    return Object.fromEntries(Object.entries(ledger.state.groups).map(([id, g]) => [id, {
      moving_average_cost: core.average(g), moving_average_quantity: g.quantity,
      moving_average_initialized: ledger.initialized, moving_average_unknown_costs: g.unknown,
    }]));
  } catch (e) { await db.rollback(); throw e; }
  finally { db.release(); }
}
async function synchronizeProduct(pool, productId, transaction = null) {
  if (transaction?.[costTransaction]) return;
  const db = transaction || await pool.getConnection();
  try {
    if (!transaction) await db.beginTransaction();
    const models = await modelsForProducts(db, [productId]);
    for (const model of models) await save(db, await load(db, model, { lock: true }));
    if (!transaction) await db.commit();
  } catch (error) { if (!transaction) await db.rollback(); throw error; }
  finally { if (!transaction) db.release(); }
}
module.exports = { modelsForProducts, load, save, prepareSale, preview, saleBasis, saleCostBasisInfo, synchronizeProduct };

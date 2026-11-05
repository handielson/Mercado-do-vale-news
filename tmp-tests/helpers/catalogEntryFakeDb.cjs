'use strict';
function fakeDb(seed = {}) {
  const state = {
    models: [
      { id: 'm1', name: 'Redmi Note 14', category_id: 'cat-phone', company_id: 'c', template_values: '{}', brand_name: 'Xiaomi', category_name: 'Smartphones' },
      { id: 'm2', name: 'Capa Silicone', category_id: 'cat-acc', company_id: 'c', template_values: '{}', brand_name: null, category_name: 'Acessórios' },
    ],
    categories: [{ id: 'cat-phone', name: 'Smartphones' }, { id: 'cat-acc', name: 'Acessórios' }],
    locations: [{ id: 'L1', company_id: 'c', deposit_id: 'D1' }],
    products: [], units: [], psl: [], groups: [], images: [], batches: [], lines: [], movements: [],
    intakes: [], // smartphone_photo_intakes (fila de cadastro por foto)
    // Colunas/índices já existentes em catalog_entry_batches (tabela antiga: passe schema: { columns: [], indexes: [] }).
    schema: { columns: ['client_batch_id', 'client_items_hash'], indexes: ['uq_catalog_entry_batches_client'] },
    ...structuredClone(seed),
  };
  const log = [];
  // concurrentBatch: { batch, lines } gravado por "outra conexão" logo antes do INSERT do lote (corrida de reenvio).
  // alterError: erro lançado no próximo ALTER TABLE.
  const control = { failRollback: false, concurrentBatch: null, alterError: null };
  const calls = { syncStock: [], syncLocations: [] };
  const TABLES = ['products', 'units', 'psl', 'groups', 'batches', 'lines', 'movements', 'intakes'];
  const snap = () => structuredClone(Object.fromEntries(TABLES.map(t => [t, state[t]])));
  const restore = s => Object.assign(state, structuredClone(s));
  let tx = null; const savepoints = new Map();
  const TABLE_OF = { products: 'products', units: 'units', product_stock_locations: 'psl', catalog_entry_batches: 'batches', catalog_entry_lines: 'lines' };
  function genericInsert(sql, args) {
    const m = sql.match(/INSERT INTO (\w+)\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)/);
    const cols = m[2].split(',').map(c => c.trim().replace(/`/g, ''));
    const vals = m[3].split(',').map(v => v.trim());
    let i = 0; const row = {};
    cols.forEach((c, k) => {
      const v = vals[k];
      row[c] = v === '?' ? args[i++] : v === 'NULL' ? null : /^'.*'$/.test(v) ? v.slice(1, -1) : Number(v);
    });
    state[TABLE_OF[m[1]]].push(row);
    return [{ affectedRows: 1 }];
  }
  const byModel = id => state.products.filter(p => p.model_id === id).sort((a, b) => a.id.localeCompare(b.id));
  async function query(sql, args = []) {
    log.push(sql);
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^CREATE TABLE/.test(s)) return [{}];
    if (s.includes('FROM information_schema.COLUMNS')) return [[{ n: state.schema.columns.includes(args[0]) ? 1 : 0 }]];
    if (s.includes('FROM information_schema.STATISTICS')) return [[{ n: state.schema.indexes.includes(args[0]) ? 1 : 0 }]];
    if (/^ALTER TABLE catalog_entry_batches/.test(s)) {
      if (control.alterError) { const e = control.alterError; control.alterError = null; throw e; }
      const col = s.match(/ADD COLUMN (\w+)/); if (col) state.schema.columns.push(col[1]);
      const idx = s.match(/ADD UNIQUE INDEX (\w+)/); if (idx) state.schema.indexes.push(idx[1]);
      return [{}];
    }
    if (s.startsWith('SELECT id,client_items_hash FROM catalog_entry_batches WHERE client_batch_id=?'))
      return [structuredClone(state.batches.filter(b => b.client_batch_id === args[0]))];
    if (s.startsWith('SELECT l.line,l.product_id')) {
      return [state.lines.filter(l => l.batch_id === args[0]).sort((a, b) => a.line - b.line)
        .map(l => ({ ...structuredClone(l), sku: state.products.find(p => p.id === l.product_id)?.sku ?? null }))];
    }
    if (s.startsWith('INSERT INTO catalog_entry_batches')) {
      if (control.concurrentBatch) {
        const { batch, lines = [] } = control.concurrentBatch; control.concurrentBatch = null;
        for (const target of [state, tx].filter(Boolean)) { target.batches.push(structuredClone(batch)); target.lines.push(...structuredClone(lines)); }
      }
      const id = args[args.length - 2];
      if (id != null && state.batches.some(b => b.client_batch_id === id)) {
        throw Object.assign(new Error(`Duplicate entry '${id}' for key 'uq_catalog_entry_batches_client'`), { code: 'ER_DUP_ENTRY', errno: 1062 });
      }
    }
    if (/GET_LOCK/.test(s)) return [[{ acquired: 1 }]];
    if (/RELEASE_LOCK/.test(s)) return [[{}]];
    if (/^SAVEPOINT (\w+)/.test(s)) { savepoints.set(s.split(' ')[1], snap()); return [{}]; }
    if (/^ROLLBACK TO SAVEPOINT (\w+)/.test(s)) { restore(savepoints.get(s.split(' ')[3])); return [{}]; }
    if (/^RELEASE SAVEPOINT/.test(s)) return [{}];
    if (s === 'SELECT id FROM models WHERE id=? FOR UPDATE') return [state.models.filter(m => m.id === args[0]).map(m => ({ id: m.id }))];
    if (s.includes('FROM models m')) return [structuredClone(state.models.filter(m => m.id === args[0]))];
    if (s.startsWith('SELECT id,name FROM categories')) return [state.categories.filter(c => c.id === args[0])];
    if (s.includes('FROM stock_locations')) return [state.locations.filter(l => l.id === args[0])];
    if (/FROM products WHERE model_id=\?/.test(s)) return [structuredClone(byModel(args[0]))];
    if (s.includes('FROM products WHERE bling_id=')) return [structuredClone(state.products.filter(p => p.bling_id === args[0] && p.is_parent === 1))];
    if (s.includes('FROM products WHERE id=')) return [structuredClone(state.products.filter(p => p.id === args[0]))];
    if (s.includes('FROM products WHERE sku=')) return [state.products.filter(p => p.sku === args[0]).map(p => ({ id: p.id }))];
    if (s.includes('FROM products WHERE parent_id=')) return [structuredClone(state.products.filter(p => p.parent_id === args[0]))];
    if (s.includes('FROM products WHERE sku LIKE')) return [state.products.filter(p => p.sku.toUpperCase().startsWith(args[0].slice(0, -1).toUpperCase())).map(p => ({ sku: p.sku }))];
    if (s.includes('FROM products WHERE category_id=?')) {
      if (!/model_id IS NULL/.test(s) || !/parent_id IS NULL/.test(s) || !/LIMIT 2/.test(s)) throw new Error('resolveSimple sem filtro de família: ' + s);
      const low = v => String(v ?? '').trim().toLowerCase();
      return [structuredClone(state.products.filter(p => p.category_id === args[0] && !p.model_id && !p.parent_id && !Number(p.is_parent)
        && (low(p.name) === low(args[1]) || low(p.name) === low(`${args[2]} - ${p.sku}`))).slice(0, 2))];
    }
    if (s.startsWith('SELECT id,imei_1,imei_2,serial FROM units WHERE imei_1 IN (?) OR imei_2 IN (?) OR serial IN (?)')) {
      const vals = args[0].map(v => String(v).toUpperCase());
      const has = v => v != null && vals.includes(String(v).toUpperCase());
      return [structuredClone(state.units.filter(u => has(u.imei_1) || has(u.imei_2) || has(u.serial)).slice(0, 1))];
    }
    if (s.startsWith('SELECT (SELECT COUNT(*) FROM units WHERE product_id=?) AS units')) {
      return [[{ units: state.units.filter(u => u.product_id === args[0]).length, locations: state.psl.filter(r => r.product_id === args[1]).length }]];
    }
    // Cadastro por foto (finalizePhotoIntake).
    if (s.startsWith('SHOW COLUMNS')) return [['matched_color_id', 'review_confirmed', 'review_confirmed_at', 'intake_photo_path', 'intake_id'].map(Field => ({ Field }))];
    if (s.startsWith('SELECT * FROM smartphone_photo_intakes WHERE status IN')) return [[]];
    if (/^SELECT (\*|id,status) FROM smartphone_photo_intakes WHERE id ?= ?\?/.test(s)) return [structuredClone(state.intakes.filter(i => i.id === args[0]))];
    if (s.startsWith("SELECT id FROM companies WHERE slug='mercado-do-vale'")) return [[{ id: 'c' }]];
    if (s.startsWith('SELECT id FROM units WHERE (imei_1 IN')) {
      const n = (args.length - 1) / 3; const vals = args.slice(0, n).map(String); const own = args[args.length - 1];
      const has = v => v != null && vals.includes(String(v));
      return [state.units.filter(u => (has(u.imei_1) || has(u.imei_2) || has(u.serial)) && (u.intake_id == null || u.intake_id !== own)).map(u => ({ id: u.id }))];
    }
    if (s.startsWith('SELECT id,model_id,specs,company_id,is_parent FROM products WHERE bling_id=? OR sku=?'))
      return [structuredClone(state.products.filter(p => (p.bling_id != null && String(p.bling_id) === String(args[0])) || p.sku === args[1]))];
    if (s.startsWith('UPDATE products SET ean=?,alternative_eans=?')) { Object.assign(state.products.find(p => p.id === args[2]), { ean: args[0], alternative_eans: args[1] }); return [{}]; }
    if (s.startsWith('UPDATE products SET bling_id=?,bling_parent_id=?')) { Object.assign(state.products.find(p => p.id === args[2]), { bling_id: args[0], bling_parent_id: args[1] }); return [{}]; }
    if (s.startsWith('UPDATE products SET price_cost=?,price_retail=?,price_reseller=?,price_wholesale=?')) {
      const p = state.products.find(r => r.id === args[5]);
      Object.assign(p, { price_cost: args[0], price_retail: args[1], price_reseller: args[2], price_wholesale: args[3], status: 'active',
        stock_quantity: state.units.filter(u => u.product_id === args[4] && u.status === 'available').length });
      return [{}];
    }
    if (s.startsWith('UPDATE smartphone_photo_intakes SET status=?,matched_product_id=?,unit_id=?')) {
      Object.assign(state.intakes.find(i => i.id === args[6]), { status: args[0], matched_product_id: args[1], unit_id: args[2],
        price_retail: args[3], price_reseller: args[4], price_wholesale: args[5], completed_at: 'NOW' });
      return [{ affectedRows: 1 }];
    }
    if (s.startsWith('INSERT INTO products') || s.startsWith('INSERT INTO units') || s.startsWith('INSERT INTO catalog_entry')) return genericInsert(s, args);
    if (s.startsWith('UPDATE products SET parent_id=')) { state.products.find(p => p.id === args[1]).parent_id = args[0]; return [{}]; }
    if (s.startsWith('UPDATE products SET model_id=')) { state.products.find(p => p.id === args[1]).model_id = args[0]; return [{}]; }
    if (s.startsWith('UPDATE products SET company_id=')) { state.products.find(p => p.id === args[1]).company_id = args[0]; return [{}]; }
    if (s.startsWith('SELECT * FROM smartphone_price_groups WHERE id=?')) return [state.groups.filter(g => g.id === args[0])];
    if (s.startsWith('INSERT INTO smartphone_price_groups')) {
      state.groups.push({ id: args[0], model_id: args[1], company_id: args[2], configuration: args[3], price_retail: args[4], price_reseller: args[5], price_wholesale: args[6] });
      return [{}];
    }
    if (s.includes('FROM model_color_images')) return [state.images.filter(i => i.model_id === args[0])];
    if (s.includes('FROM product_stock_locations WHERE product_id=? AND deposit_id=? AND location_id=?'))
      return [structuredClone(state.psl.filter(r => r.product_id === args[0] && r.deposit_id === args[1] && r.location_id === args[2]))];
    if (s.startsWith('INSERT INTO product_stock_locations')) return genericInsert(s, args);
    if (s.startsWith('SELECT * FROM catalog_entry_batches WHERE id=?')) return [structuredClone(state.batches.filter(b => b.id === args[0]))];
    if (s.startsWith('SELECT * FROM catalog_entry_lines WHERE batch_id=?')) return [structuredClone(state.lines.filter(l => l.batch_id === args[0]))];
    if (s.startsWith('UPDATE product_stock_locations SET quantity=')) { state.psl.find(r => r.id === args[1]).quantity = args[0]; return [{}]; }
    throw new Error('Unexpected SQL ' + s);
  }
  const connection = {
    query,
    beginTransaction: async () => { log.push('BEGIN'); tx = snap(); },
    commit: async () => { log.push('COMMIT'); tx = null; },
    rollback: async () => {
      if (control.failRollback) { log.push('ROLLBACK_FAILED'); throw Object.assign(new Error('rollback falhou'), { code: 'PROTOCOL_CONNECTION_LOST' }); }
      log.push('ROLLBACK'); if (tx) restore(tx); tx = null;
    },
    release: () => { log.push('RELEASE'); },
    destroy: () => { log.push('DESTROY'); },
  };
  const pool = { query, getConnection: async () => connection };
  const deps = {
    syncProductStock: async (id) => { calls.syncStock.push(id); const p = state.products.find(r => r.id === id); p.stock_quantity = state.units.filter(u => u.product_id === id && u.status === 'available').length; },
    syncProductStockFromLocations: async (id) => { calls.syncLocations.push(id); const p = state.products.find(r => r.id === id); p.stock_quantity = state.psl.filter(r => r.product_id === id).reduce((a, r) => a + Number(r.quantity), 0); },
    insertStockMovement: async (row) => { state.movements.push(row); },
    getDefaultCompanyId: async () => 'c',
  };
  return { state, log, calls, pool, deps, control };
}

module.exports = { fakeDb };

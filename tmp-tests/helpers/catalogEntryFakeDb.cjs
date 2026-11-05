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
    ...structuredClone(seed),
  };
  const log = [];
  const calls = { syncStock: [], syncLocations: [] };
  const TABLES = ['products', 'units', 'psl', 'groups', 'batches', 'lines', 'movements'];
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
    if (s.includes('FROM products WHERE category_id=?')) return [structuredClone(state.products.filter(p => p.category_id === args[0]
      && String(p.name).toLowerCase() === String(args[1]).toLowerCase() && !Number(p.is_parent)))];
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
    rollback: async () => { log.push('ROLLBACK'); if (tx) restore(tx); tx = null; },
    release: () => { log.push('RELEASE'); },
  };
  const pool = { query, getConnection: async () => connection };
  const deps = {
    conflict: null,
    findUnitConflict: async (ids) => deps.conflict || null,
    syncProductStock: async (id) => { calls.syncStock.push(id); const p = state.products.find(r => r.id === id); p.stock_quantity = state.units.filter(u => u.product_id === id && u.status === 'available').length; },
    syncProductStockFromLocations: async (id) => { calls.syncLocations.push(id); const p = state.products.find(r => r.id === id); p.stock_quantity = state.psl.filter(r => r.product_id === id).reduce((a, r) => a + Number(r.quantity), 0); },
    insertStockMovement: async (row) => { state.movements.push(row); },
    getDefaultCompanyId: async () => 'c',
  };
  return { state, log, calls, pool, deps };
}

module.exports = { fakeDb };

'use strict';
// ensureDefaultStockLocation só faz UPDATE quando o depósito/local padrão difere do esperado:
// dentro da transação da Entrada (inclusive na prévia), um UPDATE sem mudança prenderia as linhas padrão até o commit.
// Roda a função real recortada de vps_server.js e vps_server.cjs com banco falso.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const DESCRIPTION = 'Local padrao criado automaticamente para migracao inicial de estoque.';
const TARGET = {
  stock_deposits: { name: 'Loja Principal', type: 'store', is_default: 1, is_active: 1 },
  stock_locations: { name: 'Estoque Geral', description: DESCRIPTION, is_default: 1, is_active: 1 },
};

function extract(file) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const from = src.indexOf('async function ensureDefaultStockLocation(');
  const to = src.indexOf('async function ensureIncomingStockLocation(', from);
  assert.ok(from >= 0 && to > from, `${file}: ensureDefaultStockLocation não encontrada`);
  return src.slice(from, to);
}

// Banco falso: UPDATE com guarda "AND NOT (col <=> valor AND ...)" só grava se alguma coluna difere (semântica do MySQL);
// UPDATE sem guarda grava sempre (como o MySQL, que trava a linha mesmo sem mudança).
function fakePool(seed) {
  const state = { stock_deposits: [], stock_locations: [], ...structuredClone(seed) };
  const updates = [];
  const pool = {
    async query(sql, args = []) {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.startsWith('SELECT id FROM stock_deposits')) return [state.stock_deposits.filter(r => r.company_id === args[0] && r.code === args[1])];
      if (s.startsWith('SELECT id FROM stock_locations')) return [state.stock_locations.filter(r => r.deposit_id === args[0] && r.code === args[1])];
      if (s.startsWith('INSERT INTO stock_deposits')) { state.stock_deposits.push({ id: args[0], company_id: args[1], code: 'LOJA-PRINCIPAL', ...TARGET.stock_deposits }); return [{ affectedRows: 1 }]; }
      if (s.startsWith('INSERT INTO stock_locations')) { state.stock_locations.push({ id: args[0], company_id: args[1], deposit_id: args[2], code: 'ESTOQUE-GERAL', ...TARGET.stock_locations }); return [{ affectedRows: 1 }]; }
      const m = s.match(/^UPDATE (stock_deposits|stock_locations) SET/);
      if (m) {
        const table = m[1];
        const row = state[table].find(r => r.id === args[0]);
        const guard = s.match(/WHERE id=\? AND NOT \((.*)\)$/);
        if (guard) for (const col of Object.keys(TARGET[table])) assert.match(guard[1], new RegExp(`\\b${col} <=> `), `${table}: guarda sem ${col}`);
        const differs = Object.entries(TARGET[table]).some(([col, value]) => row[col] !== value);
        if (guard && !differs) return [{ affectedRows: 0 }];
        Object.assign(row, TARGET[table], { updated_at: 'NOW' });
        updates.push(table);
        return [{ affectedRows: 1 }];
      }
      throw new Error('Unexpected SQL ' + s);
    },
  };
  return { pool, state, updates };
}

function load(file, pool) {
  const context = { pool, crypto: require('node:crypto'), getDefaultStockCompanyId: async () => 'c' };
  vm.createContext(context);
  vm.runInContext(`${extract(file)}\nthis.ensureDefaultStockLocation = ensureDefaultStockLocation;`, context);
  return context.ensureDefaultStockLocation;
}

const deposit = (patch = {}) => ({ id: 'D1', company_id: 'c', code: 'LOJA-PRINCIPAL', ...TARGET.stock_deposits, ...patch });
const location = (patch = {}) => ({ id: 'L1', company_id: 'c', deposit_id: 'D1', code: 'ESTOQUE-GERAL', ...TARGET.stock_locations, ...patch });

test('vps_server.js e vps_server.cjs têm a mesma ensureDefaultStockLocation', () => {
  assert.equal(extract('vps_server.js'), extract('vps_server.cjs'));
});

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  test(`${file}: depósito e local padrão já corretos não recebem UPDATE que grava`, async () => {
    const db = fakePool({ stock_deposits: [deposit()], stock_locations: [location()] });
    const result = await load(file, db.pool)('c');
    assert.deepEqual({ ...result }, { depositId: 'D1', locationId: 'L1', companyId: 'c' });
    assert.deepEqual(db.updates, []);
    assert.equal(db.state.stock_deposits[0].updated_at, undefined);
    assert.equal(db.state.stock_locations[0].updated_at, undefined);
  });

  test(`${file}: valor diferente (ou NULL) ainda é corrigido`, async () => {
    const db = fakePool({ stock_deposits: [deposit({ is_active: 0 })], stock_locations: [location({ description: null })] });
    await load(file, db.pool)('c');
    assert.deepEqual(db.updates, ['stock_deposits', 'stock_locations']);
    assert.equal(db.state.stock_deposits[0].is_active, 1);
    assert.equal(db.state.stock_locations[0].description, DESCRIPTION);
  });

  test(`${file}: sem depósito/local padrão, cria os dois (empresa padrão quando não informada)`, async () => {
    const db = fakePool({});
    const result = await load(file, db.pool)();
    assert.equal(result.companyId, 'c');
    assert.equal(db.state.stock_deposits.length, 1); assert.equal(db.state.stock_locations.length, 1);
    assert.equal(db.state.stock_locations[0].deposit_id, result.depositId);
    assert.deepEqual(db.updates, []);
  });
}

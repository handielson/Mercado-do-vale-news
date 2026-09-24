const test = require('node:test');
const assert = require('node:assert/strict');
const { configureNfceSequence, reserveNfceForSale } = require('../services/fiscalNfceNumbering.cjs');

const profileId = '11111111-1111-4111-8111-111111111111';
const settingsId = '22222222-2222-4222-8222-222222222222';
const saleId = '33333333-3333-4333-8333-333333333333';

function fakePool() {
  const state = { profile: { id: profileId, settings_id: settingsId }, sale: { id: saleId, company_id: settingsId, status: 'completed', payment_status: 'paid' }, importedLast: 124, sequences: new Map(), issuances: new Map(), rollbacks: 0 };
  return {
    state,
    async getConnection() {
      return {
        async beginTransaction() {}, async commit() {}, async rollback() { state.rollbacks += 1; }, release() {},
        async query(sql, params = []) {
          if (sql.startsWith('SELECT id,settings_id FROM company_fiscal_profiles')) return [[state.profile].filter(Boolean)];
          if (sql.startsWith('SELECT id FROM company_fiscal_profiles')) return [[state.profile].filter(Boolean)];
          if (sql.startsWith('SELECT MAX(CAST(document_number')) return [[{ last_number: state.importedLast }]];
          if (sql.startsWith('SELECT next_number FROM company_fiscal_nfce_sequences')) return [[state.sequences.get(`${params[0]}:${params[1]}:${params[2]}`)].filter(Boolean)];
          if (sql.startsWith('INSERT INTO company_fiscal_nfce_sequences')) { state.sequences.set(`${params[0]}:${params[1]}:${params[2]}`, { next_number: params[3] }); return [{}]; }
          if (sql.startsWith('UPDATE company_fiscal_nfce_sequences')) { state.sequences.set(`${params[1]}:${params[2]}:${params[3]}`, { next_number: params[0] }); return [{}]; }
          if (sql.startsWith('SELECT id,company_id,status,payment_status FROM sales')) return [[state.sale].filter(row => row && row.id === params[0])];
          if (sql.startsWith('SELECT id,series,document_number,status FROM company_fiscal_nfce_issuances')) return [[state.issuances.get(`${params[0]}:${params[1]}:${params[2]}`)].filter(Boolean)];
          if (sql.startsWith('INSERT INTO company_fiscal_nfce_issuances')) { state.issuances.set(`${params[1]}:${params[2]}:${params[3]}`, { id: params[0], series: params[4], document_number: params[5], status: 'reserved' }); return [{}]; }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
      };
    },
  };
}

test('reserva NFC-e isolada por ambiente, confronta Bling e nunca repete número da venda', async () => {
  const pool = fakePool();
  await assert.rejects(configureNfceSequence(pool, { profileId, environment: 'production', series: 1, blingLastNumber: 124, actor: 'teste' }), /conferência final/);
  await assert.rejects(configureNfceSequence(pool, { profileId, environment: 'production', series: 1, blingLastNumber: 123, actor: 'teste', cutoverConfirmed: true }), /menor que o histórico/);
  assert.equal((await configureNfceSequence(pool, { profileId, environment: 'production', series: 1, blingLastNumber: 124, actor: 'teste', cutoverConfirmed: true })).nextNumber, 125);
  assert.equal((await configureNfceSequence(pool, { profileId, environment: 'homologation', series: 1, blingLastNumber: 0, actor: 'teste' })).nextNumber, 1);
  const first = await reserveNfceForSale(pool, { profileId, saleId, environment: 'homologation', series: 1 });
  const repeated = await reserveNfceForSale(pool, { profileId, saleId, environment: 'homologation', series: 1 });
  assert.equal(first.document_number, 1);
  assert.equal(first.id, repeated.id);
  assert.equal(repeated.existing, true);
  assert.equal(pool.state.sequences.get(`${profileId}:homologation:1`).next_number, 2);
  await assert.rejects(configureNfceSequence(pool, { profileId, environment: 'homologation', series: 1, blingLastNumber: 0, actor: 'teste' }), /não pode retroceder/);
  assert.equal(pool.state.rollbacks, 2);
});

test('não reserva para empresa adicional, venda cancelada ou série sem conferência', async () => {
  const pool = fakePool();
  await assert.rejects(reserveNfceForSale(pool, { profileId, saleId, environment: 'production', series: 1 }), /ainda não conferida/);
  pool.state.profile.settings_id = null;
  await assert.rejects(reserveNfceForSale(pool, { profileId, saleId, environment: 'homologation', series: 1 }), /empresas adicionais/);
  pool.state.profile.settings_id = settingsId;
  pool.state.sale.status = 'cancelled';
  await assert.rejects(reserveNfceForSale(pool, { profileId, saleId, environment: 'homologation', series: 1 }), /cancelada/);
  assert.equal(pool.state.issuances.size, 0);
});

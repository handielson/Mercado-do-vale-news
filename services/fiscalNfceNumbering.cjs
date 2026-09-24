const { randomUUID } = require('node:crypto');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail = (message, statusCode = 409) => { throw Object.assign(new Error(message), { statusCode }); };
const validEnvironment = value => {
  if (!['homologation', 'production'].includes(value)) fail('Ambiente de NFC-e inválido.', 400);
  return value;
};
const positiveNumber = (value, label, max) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) fail(`${label} inválido.`, 400);
  return value;
};

async function inTransaction(pool, work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

/** Conferência de corte: Bling é piso histórico, não autoridade para avançar sem pausa de emissão. */
async function configureNfceSequence(pool, { profileId, environment, series, blingLastNumber, actor, cutoverConfirmed = false }) {
  if (!UUID.test(profileId || '')) fail('Perfil fiscal inválido.', 400);
  validEnvironment(environment);
  positiveNumber(series, 'Série', 999);
  positiveNumber(blingLastNumber, 'Último número do Bling', 999999998);
  if (!String(actor || '').trim()) fail('Responsável pela conferência ausente.', 400);
  if (environment === 'production' && cutoverConfirmed !== true) fail('A série de produção exige conferência final do Bling e pausa de emissão simultânea.');
  return inTransaction(pool, async db => {
    const [profiles] = await db.query('SELECT id FROM company_fiscal_profiles WHERE id=? FOR UPDATE', [profileId]);
    if (!profiles[0]) fail('Empresa fiscal não encontrada.', 404);
    // Os documentos históricos importados são de produção; não contam na série de homologação.
    let importedLast = 0;
    if (environment === 'production') {
      const [imported] = await db.query(
        "SELECT MAX(CAST(document_number AS UNSIGNED)) AS last_number FROM company_fiscal_documents WHERE profile_id=? AND model='65' AND source='bling_import' AND series=? AND document_number REGEXP '^[0-9]{1,9}$'",
        [profileId, String(series)]
      );
      importedLast = Number(imported[0]?.last_number || 0);
    }
    if (blingLastNumber < importedLast) fail('Número informado é menor que o histórico NFC-e importado do Bling.');
    const [rows] = await db.query('SELECT next_number FROM company_fiscal_nfce_sequences WHERE profile_id=? AND environment=? AND series=? FOR UPDATE', [profileId, environment, series]);
    const nextNumber = blingLastNumber + 1;
    if (rows[0] && nextNumber < Number(rows[0].next_number)) fail('A numeração não pode retroceder ou reutilizar uma reserva anterior.');
    if (rows[0]) await db.query('UPDATE company_fiscal_nfce_sequences SET next_number=?,bling_last_number=?,checked_by=?,checked_at=NOW() WHERE profile_id=? AND environment=? AND series=?', [nextNumber, blingLastNumber, String(actor), profileId, environment, series]);
    else await db.query('INSERT INTO company_fiscal_nfce_sequences (profile_id,environment,series,next_number,bling_last_number,checked_by,checked_at) VALUES (?,?,?,?,?,?,NOW())', [profileId, environment, series, nextNumber, blingLastNumber, String(actor)]);
    return { profileId, environment, series, nextNumber, importedLast };
  });
}

/** Reserva idempotente e permanente; falha posterior exige reconciliação ou inutilização, jamais reuso. */
async function reserveNfceForSale(pool, { profileId, saleId, environment, series }, options = {}) {
  if (!UUID.test(profileId || '') || !UUID.test(saleId || '')) fail('Empresa ou venda inválida.', 400);
  validEnvironment(environment);
  positiveNumber(series, 'Série', 999);
  return inTransaction(pool, async db => {
    const [profiles] = await db.query('SELECT id,settings_id FROM company_fiscal_profiles WHERE id=? FOR UPDATE', [profileId]);
    const profile = profiles[0];
    if (!profile) fail('Empresa fiscal não encontrada.', 404);
    // As vendas do PDV ainda pertencem à loja principal; empresas adicionais exigem segregação operacional.
    if (!profile.settings_id) fail('Vendas de empresas adicionais ainda não estão segregadas.');
    const [sales] = await db.query('SELECT id,company_id,status,payment_status FROM sales WHERE id=? FOR UPDATE', [saleId]);
    const sale = sales[0];
    if (!sale) fail('Venda não encontrada.', 404);
    if (sale.company_id && String(sale.company_id) !== String(profile.settings_id)) fail('Venda pertence a outra empresa.');
    if (/cancel|refund|return/i.test(`${sale.status || ''} ${sale.payment_status || ''}`)) fail('Venda cancelada ou estornada não pode gerar NFC-e.');
    const validation = options.validate ? await options.validate(db, profile) : null;
    if (validation && !validation.saleDataReady) fail('Venda ainda possui pendências fiscais; não foi reservado número.');
    const [existing] = await db.query('SELECT id,series,document_number,status FROM company_fiscal_nfce_issuances WHERE profile_id=? AND sale_id=? AND environment=? FOR UPDATE', [profileId, saleId, environment]);
    if (existing[0]) return { ...existing[0], existing: true, ...(validation ? { validation } : {}) };
    const [sequences] = await db.query('SELECT next_number FROM company_fiscal_nfce_sequences WHERE profile_id=? AND environment=? AND series=? FOR UPDATE', [profileId, environment, series]);
    if (!sequences[0]) fail('Numeração fiscal ainda não conferida com o Bling para esta série e ambiente.');
    const number = Number(sequences[0].next_number);
    if (!Number.isSafeInteger(number) || number < 1 || number > 999999999) fail('Série esgotada ou sequência inválida.');
    const id = randomUUID();
    await db.query('INSERT INTO company_fiscal_nfce_issuances (id,profile_id,sale_id,environment,series,document_number,status) VALUES (?,?,?,?,?, ?,\'reserved\')', [id, profileId, saleId, environment, series, number]);
    await db.query('UPDATE company_fiscal_nfce_sequences SET next_number=? WHERE profile_id=? AND environment=? AND series=?', [number + 1, profileId, environment, series]);
    return { id, series, document_number: number, status: 'reserved', existing: false, ...(validation ? { validation } : {}) };
  });
}

module.exports = { configureNfceSequence, reserveNfceForSale };

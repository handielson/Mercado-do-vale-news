const { createHash } = require('node:crypto');
const vault = require('./fiscalCertificateVault.cjs');
const { signHomologationNfce } = require('./fiscalNfceSigning.cjs');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail = message => { throw Object.assign(new Error(message), { statusCode:409 }); };

/** Prepara uma única tentativa reservada. A chave e o XML assinado tornam-se imutáveis antes da rede. */
async function prepareReservedNfce(pool, { issuanceId, draft }, options = {}) {
  if (!UUID.test(issuanceId || '') || !draft?.xml || !draft?.accessKey) fail('Reserva ou rascunho da NFC-e inválido.');
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [rows] = await db.query(`SELECT i.id,i.profile_id,i.environment,i.series,i.document_number,i.status,i.access_key,i.signed_xml,p.cnpj
      FROM company_fiscal_nfce_issuances i JOIN company_fiscal_profiles p ON p.id=i.profile_id WHERE i.id=? FOR UPDATE`, [issuanceId]);
    const row = rows[0];
    if (!row || row.environment !== 'homologation') fail('Reserva de homologação não encontrada.');
    if (row.status === 'prepared' && row.access_key === draft.accessKey && row.signed_xml) {
      await db.commit();
      return { issuanceId, accessKey:row.access_key, signedXmlSha256:createHash('sha256').update(row.signed_xml).digest('hex'), existing:true };
    }
    if (row.status !== 'reserved') fail('Tentativa já avançou; consultar o estado existente, sem gerar outra chave.');
    const key = draft.accessKey;
    if (!/^26\d{42}$/.test(key) || key.slice(6, 20) !== row.cnpj || key.slice(20, 22) !== '65'
      || Number(key.slice(22, 25)) !== Number(row.series) || Number(key.slice(25, 34)) !== Number(row.document_number)
      || draft.environment !== 'homologation') fail('Rascunho não corresponde à empresa, série ou número reservado.');
    const stored = await (options.readCertificate || vault.readCertificate)(row.profile_id, options.vaultOptions || {});
    const signed = await (options.sign || signHomologationNfce)(draft, stored.pfx, stored.password);
    if (signed.accessKey !== key || typeof signed.xml !== 'string' || !signed.xml) fail('Assinatura não corresponde à chave reservada.');
    await db.query("UPDATE company_fiscal_nfce_issuances SET status='prepared',access_key=?,signed_xml=?,last_error=NULL WHERE id=? AND status='reserved'", [key, signed.xml, issuanceId]);
    await db.commit();
    return { issuanceId, accessKey:key, signedXmlSha256:createHash('sha256').update(signed.xml).digest('hex'), existing:false };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally { db.release(); }
}

module.exports = { prepareReservedNfce };

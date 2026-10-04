const { createHash, randomUUID } = require('node:crypto');
const { problem } = require('./companyFiscalCore.cjs');
const { validateArchivedXml } = require('./fiscalDocumentArchive.cjs');

// Shared by reviewed historical imports and the temporary Bling synchronizer.
async function saveBlingFiscalDocuments(pool, { profile, documents, from, to, actor, automatic = false, connection }) {
  for (const document of documents) {
    if (automatic && !document.authorizedXml) throw problem('XML original obrigatório na sincronização automática.', 422);
    if (document.authorizedXml) validateArchivedXml(document.authorizedXml, {
      access_key: document.accessKey, model: document.model, document_number: document.documentNumber, series: document.series,
    }, profile.cnpj, automatic ? document.totalCents : undefined);
  }
  const db = connection || await pool.getConnection();
  try {
    await db.beginTransaction();
    for (const document of documents) {
      let channel = 'bling';
      let externalSaleId = document.marketplaceOrderId || document.externalSaleId;
      if (document.marketplaceOrderId) {
        const [candidates] = await db.query("SELECT DISTINCT channel, external_id FROM mobile_sale_events WHERE external_id=? AND channel IN ('shopee','tiktok')", [document.marketplaceOrderId]);
        const matches = [...new Set(candidates.filter(row => String(row.external_id) === document.marketplaceOrderId).map(row => row.channel))];
        if (matches.length === 1) { channel = matches[0]; externalSaleId = document.marketplaceOrderId; }
      }
      // A global access-key collision must never overwrite a different company's document.
      const [collisions] = await db.query('SELECT id,profile_id FROM company_fiscal_documents WHERE access_key=? FOR UPDATE', [document.accessKey]);
      if (collisions.some(row => String(row.profile_id) !== String(profile.id))) throw problem('Chave fiscal vinculada a outra empresa.', 409);
      await db.query(`INSERT INTO company_fiscal_documents
        (id,profile_id,channel,external_sale_id,model,status,access_key,document_number,series,issued_at,total_cents,source,source_reference,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE channel=VALUES(channel),external_sale_id=VALUES(external_sale_id),status=IF(status='cancelled','cancelled',VALUES(status)),access_key=COALESCE(VALUES(access_key),access_key),document_number=VALUES(document_number),series=VALUES(series),issued_at=VALUES(issued_at),total_cents=VALUES(total_cents),updated_at=CURRENT_TIMESTAMP`,
      [randomUUID(), profile.id, channel, externalSaleId, document.model, document.status, document.accessKey, document.documentNumber, document.series, document.issuedAt, document.totalCents, document.source, document.sourceReference, actor]);
      if (document.authorizedXml) {
        const [saved] = await db.query('SELECT id FROM company_fiscal_documents WHERE profile_id=? AND source=? AND source_reference=? AND model=? LIMIT 1', [profile.id, document.source, document.sourceReference, document.model]);
        if (!saved[0]) throw problem('Não foi possível localizar a nota importada para arquivar o XML.', 409);
        const digest = createHash('sha256').update(document.authorizedXml).digest('hex');
        await db.query('INSERT IGNORE INTO company_fiscal_document_xmls (document_id,profile_id,authorized_xml,xml_sha256,archived_by) VALUES (?,?,?,?,?)', [saved[0].id, profile.id, document.authorizedXml, digest, actor]);
        const [archives] = await db.query('SELECT xml_sha256 FROM company_fiscal_document_xmls WHERE document_id=? AND profile_id=?', [saved[0].id, profile.id]);
        if (archives[0]?.xml_sha256 !== digest) throw problem('O XML importado diverge do original arquivado. Importação interrompida.', 409);
      }
    }
    await db.query('INSERT INTO company_fiscal_events (profile_id,actor,event,details) VALUES (?,?,?,?)', [profile.id, actor, automatic ? 'bling_fiscal_auto_sync' : 'bling_fiscal_documents_import', JSON.stringify({ from, to, documents: documents.length })]);
    await db.commit();
    return { imported: documents.length, authorized: documents.filter(d => d.status === 'authorized').length, cancelled: documents.filter(d => d.status === 'cancelled').length, from, to, source: 'bling_import' };
  } catch (error) { await db.rollback(); throw error; }
  finally { if (!connection) db.release(); }
}

module.exports = { saveBlingFiscalDocuments };

const { createHash } = require('node:crypto');
const vault = require('./fiscalCertificateVault.cjs');
const { parseNfceProcForDanfe } = require('./danfeNfceCore.cjs');
const { verifyHomologationNfce } = require('./fiscalNfceSigning.cjs');
const auth = require('./fiscalNfceAuthorization.cjs');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail = message => { throw Object.assign(new Error(message), { statusCode:409 }); };
const safeError = error => String(error?.message || 'Resultado não confirmado.').slice(0, 900);
const sqlDate = value => new Date(value).toISOString().slice(0, 19).replace('T', ' ');

function processedXml(signedXml, protocolXml) {
  const note = signedXml.replace(/^\s*<\?xml[^>]*>\s*/i, '');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${note}${protocolXml}</nfeProc>`;
  parseNfceProcForDanfe(xml);
  return xml;
}

async function issuance(pool, issuanceId) {
  if (!UUID.test(issuanceId || '')) fail('Tentativa fiscal inválida.');
  const [rows] = await pool.query(`SELECT id,profile_id,environment,status,access_key,signed_xml,authorization_protocol,authorized_xml_sha256 FROM company_fiscal_nfce_issuances WHERE id=?`, [issuanceId]);
  const row = rows[0];
  if (!row || row.environment !== 'homologation' || !row.access_key || !row.signed_xml) fail('NFC-e de homologação ainda não preparada.');
  return row;
}

async function saveResult(pool, row, result, responseXml) {
  const state = result.state === 'authorized' ? 'authorized' : result.state === 'denied' ? 'denied'
    : result.state === 'rejected' ? 'rejected' : result.state === 'cancelled' ? 'cancelled' : 'uncertain';
  const authorizedXml = state === 'authorized' ? processedXml(row.signed_xml, result.protocolXml) : null;
  const hash = authorizedXml ? createHash('sha256').update(authorizedXml).digest('hex') : null;
  const [updated] = await pool.query(`UPDATE company_fiscal_nfce_issuances SET status=?,sefaz_response_xml=?,authorized_xml=?,authorized_xml_sha256=?,authorization_protocol=?,authorized_at=?,last_error=?
    WHERE id=? AND status IN ('sending','uncertain')`, [state, responseXml || null, authorizedXml, hash,
    state === 'authorized' ? result.protocol : null, state === 'authorized' ? sqlDate(result.authorizedAt) : null,
    state === 'authorized' ? null : String(result.reason || 'Resultado ainda não confirmado.').slice(0, 1000), row.id]);
  if (updated.affectedRows !== 1) fail('Estado fiscal mudou durante a consulta; reler a tentativa.');
  return { issuanceId:row.id, accessKey:row.access_key, state, status:result.status, reason:result.reason,
    authorizationProtocol:state === 'authorized' ? result.protocol : null, authorizedXmlSha256:hash };
}

async function uncertain(pool, row, error) {
  await pool.query("UPDATE company_fiscal_nfce_issuances SET status='uncertain',last_error=? WHERE id=? AND status='sending'", [safeError(error), row.id]);
  const latest = await issuance(pool, row.id);
  if (['authorized','rejected','denied','cancelled'].includes(latest.status)) return { issuanceId:row.id, accessKey:row.access_key,
    state:latest.status, authorizationProtocol:latest.authorization_protocol || null, authorizedXmlSha256:latest.authorized_xml_sha256 || null };
  return { issuanceId:row.id, accessKey:row.access_key, state:'uncertain', reason:'Resposta não confirmada; consultar a mesma chave na SEFAZ.' };
}

/** Envia uma única vez. Marcar sending antes da chamada evita que timeout crie outro número ou reenvie automaticamente. */
async function transmitPreparedNfce(pool, issuanceId, options = {}) {
  if (!UUID.test(issuanceId || '')) fail('Tentativa fiscal inválida.');
  const [claimed] = await pool.query("UPDATE company_fiscal_nfce_issuances SET status='sending',last_error=NULL WHERE id=? AND environment='homologation' AND status='prepared' AND access_key IS NOT NULL AND signed_xml IS NOT NULL", [issuanceId]);
  if (claimed.affectedRows !== 1) fail('Tentativa não está preparada; não reenviar automaticamente. Consulte a chave.');
  const row = await issuance(pool, issuanceId);
  try {
    const stored = await (options.readCertificate || vault.readCertificate)(row.profile_id, options.vaultOptions || {});
    await verifyHomologationNfce(row.signed_xml, row.access_key, stored.pfx, stored.password);
    const body = auth.authorizationSoap({ signedXml:row.signed_xml, accessKey:row.access_key, lotId:String(options.lotId || row.access_key.slice(25, 34)) });
    const response = await (options.request || vault.requestSoap)(auth.AUTHORIZATION_HOMOLOGATION_URL, body, stored.pfx, stored.password, auth.AUTHORIZATION_SOAP_ACTION);
    if (response.statusCode !== 200) throw new Error(`HTTP ${response.statusCode} na autorização fiscal.`);
    const result = auth.parseAuthorizationResponse(response.body, { accessKey:row.access_key, lotId:String(options.lotId || row.access_key.slice(25, 34)) });
    return await saveResult(pool, row, result, response.body);
  } catch (error) { return uncertain(pool, row, error); }
}

/** Só consulta; inclusive 217 permanece inconclusivo e nunca dispara segundo envio. */
async function reconcileNfceByKey(pool, issuanceId, options = {}) {
  const row = await issuance(pool, issuanceId);
  if (!['sending','uncertain'].includes(row.status)) fail('A tentativa não está pendente de conciliação.');
  try {
    const stored = await (options.readCertificate || vault.readCertificate)(row.profile_id, options.vaultOptions || {});
    const response = await (options.request || vault.requestSoap)(auth.CONSULTATION_HOMOLOGATION_URL,
      auth.consultationSoap(row.access_key), stored.pfx, stored.password, auth.CONSULTATION_SOAP_ACTION);
    if (response.statusCode !== 200) throw new Error(`HTTP ${response.statusCode} na consulta fiscal.`);
    const result = auth.parseConsultationResponse(response.body, row.access_key);
    return await saveResult(pool, row, result, response.body);
  } catch (error) {
    await pool.query("UPDATE company_fiscal_nfce_issuances SET status='uncertain',last_error=? WHERE id=? AND status IN ('sending','uncertain')", [safeError(error), row.id]);
    const latest = await issuance(pool, row.id);
    if (['authorized','rejected','denied','cancelled'].includes(latest.status)) return { issuanceId:row.id, accessKey:row.access_key,
      state:latest.status, authorizationProtocol:latest.authorization_protocol || null, authorizedXmlSha256:latest.authorized_xml_sha256 || null };
    return { issuanceId:row.id, accessKey:row.access_key, state:'uncertain', reason:'Consulta não confirmada; manter a mesma chave.' };
  }
}

module.exports = { transmitPreparedNfce, reconcileNfceByKey };

const { createHash } = require('node:crypto');
const { parseNfceProcForDanfe } = require('./danfeNfceCore.cjs');

const fail = (message, statusCode = 409) => { throw Object.assign(new Error(message), { statusCode }); };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Entrega apenas o nfeProc autorizado da venda e empresa solicitadas. */
async function authorizedDanfeForSale(pool, { profileId, saleId, cnpj, environment = 'homologation', allowCancelled = false }) {
  if (!['homologation', 'production'].includes(environment)) fail('Ambiente inválido.', 400);
  if (!UUID.test(profileId || '') || !UUID.test(saleId || '')) fail('Empresa ou venda inválida.', 400);
  const [rows] = await pool.query(`SELECT id,sale_id,status,environment,access_key,authorization_protocol,
    authorized_xml,authorized_xml_sha256 FROM company_fiscal_nfce_issuances
    WHERE profile_id=? AND sale_id=? AND environment='${environment}' LIMIT 1`, [profileId,saleId]);
  const row = rows[0];
  if (!row || !(row.status === 'authorized' || (allowCancelled && row.status === 'cancelled')) || !row.authorized_xml) fail(`Nenhuma NFC-e autorizada em ${environment === 'production' ? 'produção' : 'homologação'} para esta venda.`, 404);
  const xml = String(row.authorized_xml);
  const hash = createHash('sha256').update(xml).digest('hex');
  if (hash !== row.authorized_xml_sha256) fail('XML autorizado diverge do hash persistido.');
  let data;
  try { data = parseNfceProcForDanfe(xml); } catch { fail('XML autorizado não passou pela conferência do DANFE.'); }
  if (data.environment !== (environment === 'production' ? '1' : '2') || row.environment !== environment || row.sale_id !== saleId || data.key !== row.access_key || data.protocol !== row.authorization_protocol
    || data.issuer.cnpj !== String(cnpj || '').replace(/\D/g,'')) fail('Identidade da NFC-e não corresponde à venda e empresa selecionadas.');
  return { issuanceId:row.id, saleId, environment, status:row.status, accessKey:data.key,
    authorizationProtocol:data.protocol, authorizedXmlSha256:hash, authorizedXml:xml };
}

module.exports = { authorizedDanfeForSale };

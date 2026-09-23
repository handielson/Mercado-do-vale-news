const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const forge = require('node-forge');

const MAX_PFX_BYTES = 5 * 1024 * 1024;
const SAFE_PROFILE_ID = /^[a-f0-9-]{36}$/i;
const SEFAZ_PE = {
  production: 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeStatusServico4',
  homologation: 'https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeStatusServico4',
};

function config(options = {}) {
  const vaultDir = options.vaultDir || process.env.FISCAL_CERTIFICATE_VAULT_DIR || path.join(process.cwd(), '.secrets', 'fiscal-certificates');
  const rawKey = options.masterKey || process.env.FISCAL_CERTIFICATE_MASTER_KEY || '';
  const key = /^[a-f0-9]{64}$/i.test(rawKey) ? Buffer.from(rawKey, 'hex') : Buffer.from(rawKey, 'base64');
  if (key.length !== 32) throw Object.assign(new Error('Cofre fiscal não configurado no servidor.'), { statusCode: 503 });
  return { vaultDir, key };
}

function profilePath(profileId, options) {
  if (!SAFE_PROFILE_ID.test(profileId || '')) throw Object.assign(new Error('Perfil fiscal inválido para o cofre.'), { statusCode: 400 });
  return path.join(config(options).vaultDir, `${profileId}.vault`);
}

function findCnpj(cert) {
  const attributes = cert.subject.attributes || [];
  const candidates = values => [...new Set(values.flatMap(value => String(value || '').match(/\d{14}/g) || []))];
  const preferred = candidates(attributes
    .filter(attribute => attribute.shortName === 'CN' || attribute.name === 'commonName' || attribute.type === '2.5.4.3')
    .map(attribute => attribute.value));
  if (preferred.length === 1) return preferred[0];
  if (preferred.length > 1) return '';

  const serialNumber = candidates(attributes
    .filter(attribute => attribute.shortName === 'SERIALNUMBER' || attribute.name === 'serialNumber' || attribute.type === '2.5.4.5')
    .map(attribute => attribute.value));
  if (serialNumber.length === 1) return serialNumber[0];
  if (serialNumber.length > 1) return '';

  const fallback = candidates(attributes.map(attribute => attribute.value));
  return fallback.length === 1 ? fallback[0] : '';
}

function sameLocalKeyId(certBag, keyBag) {
  const certId = certBag?.attributes?.localKeyId?.[0];
  const keyId = keyBag?.attributes?.localKeyId?.[0];
  return Boolean(certId && keyId && certId === keyId);
}

function certificateMatchesPrivateKey(certBag, keyBag) {
  const publicKey = certBag?.cert?.publicKey;
  const privateKey = keyBag?.key;
  if (publicKey?.n && privateKey?.n) return publicKey.n.toString(16) === privateKey.n.toString(16);
  return sameLocalKeyId(certBag, keyBag);
}

function distinguishedName(attributes) {
  return attributes.map(attribute => `${attribute.shortName || attribute.name || attribute.type}=${attribute.value}`).join(', ');
}

function inspectPfx(pfx, password) {
  if (!Buffer.isBuffer(pfx) || pfx.length === 0 || pfx.length > MAX_PFX_BYTES) throw Object.assign(new Error('Arquivo PFX/P12 inválido ou maior que 5 MB.'), { statusCode: 400 });
  if (typeof password !== 'string' || password.length < 1 || password.length > 256) throw Object.assign(new Error('Informe a senha do certificado.'), { statusCode: 400 });
  let p12;
  try {
    const asn1 = forge.asn1.fromDer(pfx.toString('binary'));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch {
    throw Object.assign(new Error('Não foi possível abrir o certificado. Confira o arquivo e a senha.'), { statusCode: 400 });
  }
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ];
  if (certBags.length === 0 || keyBags.length === 0) throw Object.assign(new Error('O arquivo precisa conter certificado e chave privada.'), { statusCode: 400 });
  const leaf = certBags.find(certBag => keyBags.some(keyBag => certificateMatchesPrivateKey(certBag, keyBag)))
    || (certBags.length === 1 && keyBags.length === 1 ? certBags[0] : null);
  if (!leaf?.cert) throw Object.assign(new Error('Não foi possível associar o certificado à chave privada do arquivo.'), { statusCode: 400 });
  const der = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(leaf.cert)).getBytes(), 'binary');
  return {
    cnpj: findCnpj(leaf.cert),
    validFrom: leaf.cert.validity.notBefore.toISOString().slice(0, 10),
    validUntil: leaf.cert.validity.notAfter.toISOString().slice(0, 10),
    subjectName: distinguishedName(leaf.cert.subject.attributes),
    issuerName: distinguishedName(leaf.cert.issuer.attributes),
    serialNumber: String(leaf.cert.serialNumber || '').toUpperCase(),
    fingerprintSha256: crypto.createHash('sha256').update(der).digest('hex').toUpperCase().match(/.{2}/g).join(':'),
    hasPrivateKey: true,
  };
}

function encrypt(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return JSON.stringify({ version: 1, algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
}

function decrypt(raw, key) {
  const record = JSON.parse(raw);
  if (record.version !== 1 || record.algorithm !== 'aes-256-gcm') throw new Error('Formato do cofre fiscal não reconhecido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}

async function installCertificate(profileId, pfx, password, expectedCnpj, options = {}) {
  const metadata = inspectPfx(pfx, password);
  if (!metadata.cnpj || metadata.cnpj !== String(expectedCnpj || '').replace(/\D/g, '')) {
    throw Object.assign(new Error('O CNPJ do certificado não corresponde à empresa selecionada.'), { statusCode: 409 });
  }
  const { vaultDir, key } = config(options);
  await fs.mkdir(vaultDir, { recursive: true, mode: 0o700 });
  const target = profilePath(profileId, options);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  const payload = encrypt({ pfx: pfx.toString('base64'), password, installedAt: new Date().toISOString() }, key);
  await fs.writeFile(temporary, payload, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await fs.rename(temporary, target);
  await fs.chmod(target, 0o600);
  return { ...metadata, storageRef: path.basename(target) };
}

async function readCertificate(profileId, options = {}) {
  const { key } = config(options);
  const value = decrypt(await fs.readFile(profilePath(profileId, options), 'utf8'), key);
  return { pfx: Buffer.from(value.pfx, 'base64'), password: value.password, installedAt: value.installedAt };
}

async function exportCertificate(profileId, password, options = {}) {
  const stored = await readCertificate(profileId, options).catch(error => {
    if (error?.code === 'ENOENT') throw Object.assign(new Error('Certificado não está instalado no servidor.'), { statusCode: 404 });
    throw error;
  });
  if (stored.password !== password) throw Object.assign(new Error('Senha do certificado incorreta.'), { statusCode: 403 });
  inspectPfx(stored.pfx, password);
  return stored.pfx;
}

async function deleteCertificate(profileId, password, options = {}) {
  await exportCertificate(profileId, password, options);
  await fs.rm(profilePath(profileId, options), { force: true });
}

function statusSoap(environment) {
  const tpAmb = environment === 'production' ? '1' : '2';
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><cUF>26</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><cUF>26</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

function xmlValue(xml, name) {
  const match = String(xml).match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([^<]*)<\\/(?:\\w+:)?${name}>`, 'i'));
  return match ? match[1].trim() : '';
}

async function testSefaz(profileId, environment = 'homologation', options = {}) {
  if (!['homologation', 'production'].includes(environment)) throw Object.assign(new Error('Ambiente da SEFAZ inválido.'), { statusCode: 400 });
  const stored = await readCertificate(profileId, options).catch(error => {
    if (error?.code === 'ENOENT') throw Object.assign(new Error('Instale o certificado antes de testar a SEFAZ.'), { statusCode: 404 });
    throw error;
  });
  const endpoint = (options.endpoints || SEFAZ_PE)[environment];
  const body = statusSoap(environment);
  const response = await (options.request || requestSoap)(endpoint, body, stored.pfx, stored.password);
  const cStat = xmlValue(response.body, 'cStat');
  const reason = xmlValue(response.body, 'xMotivo') || `HTTP ${response.statusCode}`;
  if (!cStat) throw Object.assign(new Error(`A SEFAZ não retornou um status fiscal reconhecido: ${reason}`), { statusCode: 502 });
  return { environment, endpoint, cStat, reason, operational: cStat === '107', checkedAt: new Date().toISOString() };
}

function requestSoap(endpoint, body, pfx, passphrase) {
  return new Promise((resolve, reject) => {
    const request = https.request(endpoint, { method: 'POST', pfx, passphrase, minVersion: 'TLSv1.2', timeout: 20000, headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(body), SOAPAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF' } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('timeout', () => request.destroy(new Error('Tempo limite da SEFAZ excedido.')));
    request.on('error', error => reject(Object.assign(new Error(`Falha de comunicação mTLS com a SEFAZ: ${error.message}`), { statusCode: 502 })));
    request.end(body);
  });
}

module.exports = { MAX_PFX_BYTES, SEFAZ_PE, inspectPfx, installCertificate, readCertificate, exportCertificate, deleteCertificate, testSefaz, statusSoap, xmlValue };

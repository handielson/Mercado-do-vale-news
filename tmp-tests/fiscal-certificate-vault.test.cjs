const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const forge = require('node-forge');
const vault = require('../services/fiscalCertificateVault.cjs');

const CNPJ = '11222333000181';
const PROFILE = '11111111-2222-4333-8444-555555555555';

function fixture(password = 'senha-segura') {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const authorityKeys = forge.pki.rsa.generateKeyPair(1024);
  const authority = forge.pki.createCertificate();
  authority.publicKey = authorityKeys.publicKey; authority.serialNumber = '10';
  authority.validity.notBefore = new Date('2025-01-01T00:00:00Z'); authority.validity.notAfter = new Date('2035-01-01T00:00:00Z');
  authority.setSubject([{ name: 'commonName', value: 'AC TESTE' }, { name: 'organizationalUnitName', value: '11471380000169' }]);
  authority.setIssuer(authority.subject.attributes);
  authority.sign(authorityKeys.privateKey, forge.md.sha256.create());
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey; cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2026-01-01T00:00:00Z'); cert.validity.notAfter = new Date('2027-03-02T23:59:59Z');
  cert.setSubject([
    { name: 'organizationalUnitName', value: '11471380000169' },
    { name: 'commonName', value: `EMPRESA TESTE:${CNPJ}` },
  ]);
  cert.setIssuer(authority.subject.attributes);
  cert.sign(authorityKeys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [authority, cert], password, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary');
}

test('cofre A1 valida CNPJ, cifra em repouso, exporta e exclui com senha', async t => {
  const vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-vault-test-'));
  t.after(() => fs.rm(vaultDir, { recursive: true, force: true }));
  const options = { vaultDir, masterKey: crypto.randomBytes(32).toString('hex') };
  const pfx = fixture();
  const metadata = vault.inspectPfx(pfx, 'senha-segura');
  assert.equal(metadata.cnpj, CNPJ); assert.equal(metadata.validUntil, '2027-03-02'); assert.equal(metadata.hasPrivateKey, true);
  assert.match(metadata.subjectName, /EMPRESA TESTE/);
  await assert.rejects(() => vault.installCertificate(PROFILE, pfx, 'senha-segura', '99888777000166', options), /não corresponde/);
  const installed = await vault.installCertificate(PROFILE, pfx, 'senha-segura', CNPJ, options);
  assert.match(installed.fingerprintSha256, /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/);
  const raw = await fs.readFile(path.join(vaultDir, `${PROFILE}.vault`), 'utf8');
  assert.doesNotMatch(raw, /senha-segura|EMPRESA TESTE|MII/);
  await assert.rejects(() => vault.exportCertificate(PROFILE, 'errada', options), /incorreta/);
  assert.deepEqual(await vault.exportCertificate(PROFILE, 'senha-segura', options), pfx);
  await vault.deleteCertificate(PROFILE, 'senha-segura', options);
  await assert.rejects(() => vault.readCertificate(PROFILE, options), /ENOENT/);
});

test('consulta SEFAZ usa o A1 do cofre e interpreta código 107', async t => {
  const vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-vault-sefaz-'));
  t.after(() => fs.rm(vaultDir, { recursive: true, force: true }));
  const options = { vaultDir, masterKey: crypto.randomBytes(32).toString('hex') };
  await vault.installCertificate(PROFILE, fixture(), 'senha-segura', CNPJ, options);
  const result = await vault.testSefaz(PROFILE, 'homologation', { ...options, endpoints: { homologation: 'https://sefaz.test/status' }, request: async (endpoint, body, pfx, password) => {
    assert.equal(endpoint, 'https://sefaz.test/status'); assert.match(body, /<tpAmb>2<\/tpAmb>/); assert(pfx.length > 0); assert.equal(password, 'senha-segura');
    return { statusCode: 200, body: '<retConsStatServ><tpAmb>2</tpAmb><cStat>107</cStat><xMotivo>Servico em Operacao</xMotivo></retConsStatServ>' };
  } });
  assert.equal(result.operational, true); assert.equal(result.cStat, '107');
});

test('cliente SEFAZ confia na raiz SSL oficial da ICP-Brasil sem remover as raízes padrão', () => {
  const root = new crypto.X509Certificate(vault.ICP_BRASIL_V10_ROOT);
  assert.equal(root.ca, true);
  assert.match(root.subject, /Autoridade Certificadora Raiz Brasileira v10/);
  assert.equal(root.fingerprint256, '6E:0B:FF:06:9A:26:99:4C:15:DE:2C:48:88:CC:54:AF:84:88:2E:54:95:B7:FB:F6:6B:E9:CC:FF:EC:74:89:F6');
  const authorities = vault.trustedAuthorities();
  assert(authorities.length > 100);
  assert.equal(authorities.at(-1), vault.ICP_BRASIL_V10_ROOT);
});

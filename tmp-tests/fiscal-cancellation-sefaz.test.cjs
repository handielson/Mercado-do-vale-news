const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const forge = require('node-forge');
const vault = require('../services/fiscalCertificateVault.cjs');
const event = require('../services/fiscalCancellationSefaz.cjs');

const cnpj = '11222333000181';
const profileId = '11111111-2222-4333-8444-555555555555';
const accessKey = `262609${cnpj}550010000006991123456780`;
const input = { accessKey, cnpj, authorizationProtocol:'126260000000001', justification:'Desistencia do cliente antes do envio; operacao comercial nao realizada.', environment:'homologation', occurredAt:'2026-09-24T13:00:00Z', lotId:'123' };

function pfxFixture() {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date('2025-01-01T00:00:00Z');
  cert.validity.notAfter = new Date('2027-01-01T00:00:00Z');
  cert.setSubject([{ name:'commonName', value:`EMPRESA TESTE:${cnpj}` }]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'senha-teste', { algorithm:'3des' })).getBytes(), 'binary');
}

test('evento 110111 assinado pelo A1 usa chave, protocolo, ambiente e justificativa corretos', async t => {
  const vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-event-test-'));
  t.after(() => fs.rm(vaultDir, { recursive:true, force:true }));
  const options = { vaultDir, masterKey:crypto.randomBytes(32).toString('hex'), endpoints:{ homologation:'https://sefaz.test/event' } };
  const pfx = pfxFixture();
  await vault.installCertificate(profileId, pfx, 'senha-teste', cnpj, options);
  const result = await event.transmitCancellationEvent(profileId, input, { ...options, request: async (endpoint, body, cert, password, action) => {
    assert.equal(endpoint, 'https://sefaz.test/event');
    assert.equal(password, 'senha-teste');
    assert(cert.length > 0);
    assert.match(action, /nfeRecepcaoEvento$/);
    assert.match(body, /<tpAmb>2<\/tpAmb>/);
    assert.match(body, /<Signature/);
    assert.match(body, /<nProt>126260000000001<\/nProt>/);
    return { statusCode:200, body:`<retEnvEvento><tpAmb>2</tpAmb><cStat>128</cStat><retEvento><infEvento><tpAmb>2</tpAmb><chNFe>${accessKey}</chNFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><cStat>135</cStat><xMotivo>Evento registrado</xMotivo><nProt>126260000000002</nProt></infEvento></retEvento></retEnvEvento>` };
  } });
  assert.equal(result.accepted,true);
  assert.equal(result.eventId,`ID110111${accessKey}01`);
  assert.equal(result.protocol,'126260000000002');
});

test('resposta rejeitada ou de outra nota não é homologação do cancelamento', () => {
  const body = `<retEnvEvento><tpAmb>2</tpAmb><cStat>128</cStat><retEvento><infEvento><chNFe>${'9'.repeat(44)}</chNFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><cStat>135</cStat></infEvento></retEvento></retEnvEvento>`;
  assert.equal(event.parseCancellationResponse(body,input).accepted,false);
  assert.equal(event.parseCancellationResponse(body.replace('135','999').replace('9'.repeat(44),accessKey),input).accepted,false);
  assert.throws(() => event.unsignedCancellationEvent({ ...input, justification:'curta' }),/Justificativa/);
  assert.throws(() => event.unsignedCancellationEvent({ ...input, cnpj:'99888777000166' }),/emitente/);
});

test('HTTP de erro não é tratado como homologação mesmo se trouxer XML de sucesso', async t => {
  const vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-event-http-test-'));
  t.after(() => fs.rm(vaultDir, { recursive:true, force:true }));
  const options = { vaultDir, masterKey:crypto.randomBytes(32).toString('hex') };
  await vault.installCertificate(profileId, pfxFixture(), 'senha-teste', cnpj, options);
  const result = await event.transmitCancellationEvent(profileId, input, { ...options, request:async () => ({ statusCode:500,
    body:`<retEnvEvento><tpAmb>2</tpAmb><cStat>128</cStat><retEvento><infEvento><tpAmb>2</tpAmb><chNFe>${accessKey}</chNFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><cStat>135</cStat><nProt>126260000000002</nProt></infEvento></retEvento></retEnvEvento>` }) });
  assert.equal(result.accepted,false);
});

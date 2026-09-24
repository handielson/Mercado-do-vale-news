const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { validateCsc, installCsc, readCsc, cscStatus } = require('../services/fiscalCscVault.cjs');
const removeTestVault = async vaultDir => {
  const resolved = path.resolve(vaultDir);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('mdv-csc-')) throw new Error('Unsafe test cleanup target');
  await fs.rm(resolved, { recursive: true, force: true });
};

test('CSC fica criptografado por empresa e ambiente, sem segredo na consulta de status', async () => {
  const vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-csc-'));
  const options = { vaultDir, masterKey: crypto.randomBytes(32).toString('hex') };
  const profileId = crypto.randomUUID();
  const otherProfileId = crypto.randomUUID();
  const secret = 'ABCDEF0123456789ABCDEF0123456789';
  try {
    const saved = await installCsc(profileId, 'homologation', '000001', secret, options);
    assert.equal(saved.identifier, '000001');
    assert.equal(JSON.stringify(saved).includes(secret), false);
    assert.deepEqual(await cscStatus(profileId, 'production', options), { configured: false, environment: 'production', identifier: '', updatedAt: '' });
    assert.equal((await readCsc(profileId, 'homologation', options)).code, secret);
    assert.equal((await cscStatus(profileId, 'homologation', options)).configured, true);
    assert.equal((await cscStatus(otherProfileId, 'homologation', options)).configured, false);
    const file = path.join(vaultDir, `${profileId}.homologation.csc.vault`);
    assert.equal((await fs.readFile(file, 'utf8')).includes(secret), false);
    if (process.platform !== 'win32') assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  } finally { await removeTestVault(vaultDir); }
});

test('CSC rejeita ambiente, identificador e código inválidos sem gravar', async () => {
  const vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-csc-'));
  const options = { vaultDir, masterKey: crypto.randomBytes(32).toString('hex') };
  try {
    assert.throws(() => validateCsc('abc', 'ABCDEF0123456789'), /identificador/);
    assert.throws(() => validateCsc('1', 'curto'), /CSC/);
    assert.throws(() => validateCsc('1', 'ABCD-EF0123456789'), /CSC/);
    await assert.rejects(installCsc(crypto.randomUUID(), 'unknown', '1', 'ABCDEF0123456789', options), /ambiente/);
    assert.equal((await fs.readdir(vaultDir)).length, 0);
  } finally { await removeTestVault(vaultDir); }
});

test('CSC no formato UUID do e-Fisco mantém hífens e maiúsculas no cofre', async () => {
  const vaultDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-csc-'));
  const options = { vaultDir, masterKey: crypto.randomBytes(32).toString('hex') };
  const profileId = crypto.randomUUID();
  const secret = 'ABCDEF01-2345-6789-ABCD-EF0123456789';
  try {
    assert.deepEqual(validateCsc('1', secret), { identifier: '1', code: secret });
    await installCsc(profileId, 'homologation', '1', secret, options);
    assert.equal((await readCsc(profileId, 'homologation', options)).code, secret);
  } finally { await removeTestVault(vaultDir); }
});

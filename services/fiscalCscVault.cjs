const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fiscalVaultConfig, encryptVaultRecord, decryptVaultRecord } = require('./fiscalCertificateVault.cjs');

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const environments = new Set(['homologation', 'production']);
const problem = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

function cscPath(profileId, environment, options = {}) {
  if (!UUID.test(profileId || '') || !environments.has(environment)) throw problem('Empresa ou ambiente fiscal inválido.');
  return path.join(fiscalVaultConfig(options).vaultDir, `${profileId}.${environment}.csc.vault`);
}

function validateCsc(identifier, code) {
  const id = String(identifier ?? '').trim();
  const secret = String(code ?? '').trim();
  if (!/^\d{1,6}$/.test(id)) throw problem('O identificador do CSC deve ter de 1 a 6 dígitos.');
  if (!/^[A-Za-z0-9]{16,64}$/.test(secret)) throw problem('O CSC deve conter de 16 a 64 caracteres alfanuméricos.');
  return { identifier: id, code: secret };
}

async function installCsc(profileId, environment, identifier, code, options = {}) {
  const values = validateCsc(identifier, code);
  const { vaultDir, key } = fiscalVaultConfig(options);
  const target = cscPath(profileId, environment, options);
  await fs.mkdir(vaultDir, { recursive: true, mode: 0o700 });
  const updatedAt = new Date().toISOString();
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, encryptVaultRecord({ ...values, updatedAt }, key), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, target);
    await fs.chmod(target, 0o600);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
  return { configured: true, environment, identifier: values.identifier, updatedAt };
}

async function readCsc(profileId, environment, options = {}) {
  const { key } = fiscalVaultConfig(options);
  return decryptVaultRecord(await fs.readFile(cscPath(profileId, environment, options), 'utf8'), key);
}

async function cscStatus(profileId, environment, options = {}) {
  try {
    const value = await readCsc(profileId, environment, options);
    return { configured: true, environment, identifier: value.identifier, updatedAt: value.updatedAt };
  } catch (error) {
    if (error?.code === 'ENOENT') return { configured: false, environment, identifier: '', updatedAt: '' };
    throw error;
  }
}

module.exports = { validateCsc, installCsc, readCsc, cscStatus };

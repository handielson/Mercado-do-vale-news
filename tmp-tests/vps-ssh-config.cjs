const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local') });
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
} catch {
  // dotenv is optional when env vars are injected by the caller.
}

function getVpsSshConfig() {
  const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY || '';
  const config = {
    host: process.env.VPS_SITE_HOST || process.env.VPS_HOST,
    port: Number(process.env.VPS_SITE_PORT || process.env.VPS_PORT || 22),
    username: process.env.VPS_SITE_USER || process.env.VPS_USER,
    password: process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD,
    privateKey: privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined,
  };

  const missing = [];
  if (!config.host) missing.push('VPS_SITE_HOST');
  if (!config.username) missing.push('VPS_SITE_USER');
  if (!config.password && !config.privateKey) missing.push('VPS_SITE_PASSWORD or VPS_SITE_PRIVATE_KEY');
  if (missing.length > 0) {
    throw new Error(`Missing required VPS SSH env vars: ${missing.join(', ')}`);
  }

  return config;
}

function readLegacyVpsConst(name) {
  const config = getVpsSshConfig();
  if (name === 'VpsHost') return config.host;
  if (name === 'VpsUser') return config.username;
  if (name === 'VpsPass' && config.password) return config.password;
  throw new Error(`Missing ${name} in VPS SSH env config`);
}

module.exports = {
  getVpsSshConfig,
  readLegacyVpsConst,
};

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const ROOT = path.resolve(__dirname, '..');
const LOCAL_CONFIG = path.join(ROOT, 'infra', 'nginx', 'mdv-api-ssl.conf');
const REMOTE_AVAILABLE = '/etc/nginx/sites-available/mdv-api-ssl';
const REMOTE_ENABLED = '/etc/nginx/sites-enabled/mdv-api-ssl';
const CONFIRMATION = process.env.CONFIRM_MDV_API_NGINX_INSTALL || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_MDV_API_NGINX_INSTALL';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const config = {
  host: process.env.VPS_SITE_HOST || process.env.VPS_HOST,
  port: Number(process.env.VPS_SITE_PORT || 22),
  username: process.env.VPS_SITE_USER || process.env.VPS_USER,
  password: process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD,
  privateKey: process.env.VPS_SITE_PRIVATE_KEY ? fs.readFileSync(process.env.VPS_SITE_PRIVATE_KEY) : undefined,
};

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function validateInput() {
  if (!fs.existsSync(LOCAL_CONFIG)) return 'missing_local_nginx_config';
  if (!config.host) return 'missing_VPS_SITE_HOST';
  if (!config.username) return 'missing_VPS_SITE_USER';
  if (!config.password && !config.privateKey) return 'missing_VPS_SITE_PASSWORD_or_VPS_SITE_PRIVATE_KEY';
  return null;
}

function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    conn.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey,
      readyTimeout: 20000,
    });
  });
}

function execRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk.toString(); });
      stream.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      stream.on('close', (code) => {
        if (code !== 0) return reject(new Error(`Remote command failed (${code}): ${stderr || stdout}`));
        resolve({ stdout, stderr });
      });
    });
  });
}

function uploadConfig(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((error, sftp) => {
      if (error) return reject(error);
      const remoteTemporary = `/tmp/mdv-api-ssl.conf.${Date.now()}`;
      sftp.fastPut(LOCAL_CONFIG, remoteTemporary, (uploadError) => {
        sftp.end();
        if (uploadError) reject(uploadError);
        else resolve(remoteTemporary);
      });
    });
  });
}

async function run() {
  const validationReason = validateInput();
  if (validationReason) {
    console.log(JSON.stringify({ ok: true, installed: false, dry_run: DRY_RUN, reason: validationReason }, null, 2));
    return;
  }

  if (DRY_RUN || CONFIRMATION !== EXPECTED_CONFIRMATION) {
    console.log(JSON.stringify({
      ok: true,
      installed: false,
      dry_run: true,
      reason: DRY_RUN ? 'dry_run_enabled' : 'missing_explicit_confirmation',
      remote_available: REMOTE_AVAILABLE,
      remote_enabled: REMOTE_ENABLED,
      checks: ['backup existing config', 'upload config', 'enable symlink', 'nginx -t', 'reload nginx'],
    }, null, 2));
    return;
  }

  const conn = await connect();
  try {
    const remoteTemporary = await uploadConfig(conn);
    const backup = `${REMOTE_AVAILABLE}.backup.$(date +%Y%m%d%H%M%S)`;
    const command = [
      `if [ -f ${shellQuote(REMOTE_AVAILABLE)} ]; then cp ${shellQuote(REMOTE_AVAILABLE)} ${backup}; fi`,
      `mv ${shellQuote(remoteTemporary)} ${shellQuote(REMOTE_AVAILABLE)}`,
      `ln -sfn ${shellQuote(REMOTE_AVAILABLE)} ${shellQuote(REMOTE_ENABLED)}`,
      'nginx -t',
      'systemctl reload nginx || nginx -s reload',
    ].join(' && ');
    await execRemote(conn, command);
    console.log(JSON.stringify({
      ok: true,
      installed: true,
      dry_run: false,
      remote_available: REMOTE_AVAILABLE,
      remote_enabled: REMOTE_ENABLED,
      backup: true,
    }, null, 2));
  } finally {
    conn.end();
  }
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, installed: false, error: error.message }, null, 2));
  process.exit(1);
});

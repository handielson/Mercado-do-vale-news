const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local') });
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
} catch {
  // dotenv is optional when env vars are injected by the caller.
}

const ROOT = path.resolve(__dirname, '..');
const LOCAL_CONFIG_RELATIVE = 'infra/nginx/mdv-site-production.conf';
const LOCAL_CONFIG = path.join(ROOT, ...LOCAL_CONFIG_RELATIVE.split('/'));
const REMOTE_AVAILABLE = '/etc/nginx/sites-available/mdv-site-production.conf';
const REMOTE_ENABLED = '/etc/nginx/sites-enabled/mdv-site-production.conf';
const CONFIRMATION = process.env.CONFIRM_NGINX_PRODUCTION_INSTALL || '';
const EXPECTED_CONFIRMATION = 'I_UNDERSTAND_NGINX_PRODUCTION_INSTALL';
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
    });
  });
}

function execRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk.toString(); });
      stream.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      stream.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Remote command failed (${code}): ${stderr || stdout}`));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  });
}

function uploadConfig(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const tmpRemote = `/tmp/mdv-site-production.conf.${Date.now()}`;
      sftp.fastPut(LOCAL_CONFIG, tmpRemote, (uploadErr) => {
        sftp.end();
        if (uploadErr) reject(uploadErr);
        else resolve(tmpRemote);
      });
    });
  });
}

async function run() {
  const validationReason = validateInput();
  if (validationReason) {
    console.log(JSON.stringify({
      ok: true,
      installed: false,
      dry_run: DRY_RUN,
      reason: validationReason,
    }, null, 2));
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
      checks: ['backup existing config', 'upload config', 'enable symlink', 'nginx -t', 'systemctl reload nginx'],
    }, null, 2));
    return;
  }

  const conn = await connect();
  try {
    const tmpRemote = await uploadConfig(conn);
    const backupPath = `${REMOTE_AVAILABLE}.backup.$(date +%Y%m%d%H%M%S)`;
    const command = [
      `if [ -f ${shellQuote(REMOTE_AVAILABLE)} ]; then cp ${shellQuote(REMOTE_AVAILABLE)} ${backupPath}; fi`,
      `mv ${shellQuote(tmpRemote)} ${shellQuote(REMOTE_AVAILABLE)}`,
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

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, installed: false, error: err.message }, null, 2));
  process.exit(1);
});

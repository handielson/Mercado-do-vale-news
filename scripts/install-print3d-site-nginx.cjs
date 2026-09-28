'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['.env.vps.local', '.env.local']) {
  require('dotenv').config({ path: path.join(ROOT, file), quiet: true });
}

const LOCAL_CONFIG = path.join(ROOT, 'infra', 'nginx', 'print3d-site-production.conf');
const REMOTE_AVAILABLE = '/etc/nginx/sites-available/print3d-site-production.conf';
const REMOTE_ENABLED = '/etc/nginx/sites-enabled/print3d-site-production.conf';
const APPLY = process.env.APPLY_PRINT3D_NGINX === '1';
const config = {
  host: process.env.VPS_SITE_HOST || process.env.VPS_HOST,
  port: Number(process.env.VPS_SITE_PORT || 22),
  username: process.env.VPS_SITE_USER || process.env.VPS_USER,
  password: process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD,
  privateKey: process.env.VPS_SITE_PRIVATE_KEY ? fs.readFileSync(process.env.VPS_SITE_PRIVATE_KEY) : undefined,
};

const quote = value => `'${String(value).replace(/'/g, `'\\''`)}'`;
function connect() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    conn.connect({ ...config, readyTimeout: 20000 });
  });
}
function execRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '', stderr = '';
    stream.on('data', chunk => { stdout += chunk; });
    stream.stderr.on('data', chunk => { stderr += chunk; });
    stream.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || stdout)));
  }));
}
function upload(conn, local, remote) {
  return new Promise((resolve, reject) => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    sftp.fastPut(local, remote, uploadError => {
      sftp.end();
      uploadError ? reject(uploadError) : resolve();
    });
  }));
}

async function main() {
  if (!fs.existsSync(LOCAL_CONFIG)) throw new Error('Configuração Nginx 3D não encontrada.');
  if (!config.host || !config.username || (!config.password && !config.privateKey)) throw new Error('Credenciais da VPS não configuradas.');
  if (!APPLY) {
    console.log(JSON.stringify({ ok: true, installed: false, dry_run: true, target: REMOTE_AVAILABLE }, null, 2));
    return;
  }
  const conn = await connect();
  const temporary = `/tmp/print3d-site-production.${Date.now()}.conf`;
  try {
    await upload(conn, LOCAL_CONFIG, temporary);
    const result = await execRemote(conn, [
      `if test -f ${quote(REMOTE_AVAILABLE)}; then cp ${quote(REMOTE_AVAILABLE)} ${quote(REMOTE_AVAILABLE + '.previous')}; fi`,
      `mv ${quote(temporary)} ${quote(REMOTE_AVAILABLE)}`,
      `ln -sfn ${quote(REMOTE_AVAILABLE)} ${quote(REMOTE_ENABLED)}`,
      'nginx -t',
      'systemctl reload nginx || nginx -s reload',
    ].join(' && '));
    console.log(JSON.stringify({ ok: true, installed: true, target: REMOTE_AVAILABLE, nginx: result.stderr || result.stdout }, null, 2));
  } finally {
    conn.end();
  }
}

main().catch(error => { console.error(error.message); process.exit(1); });

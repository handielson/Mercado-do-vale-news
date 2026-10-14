'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('ssh2');

const ROOT = path.resolve(__dirname, '..');
for (const file of ['.env.vps.local', '.env.local']) {
  require('dotenv').config({ path: path.join(ROOT, file), quiet: true });
}

const BOOTSTRAP = process.argv.includes('--bootstrap');
const CONFIG_NAME = BOOTSTRAP ? 'gcode3d-acme-bootstrap.conf' : 'print3d-site-production.conf';
const LOCAL_CONFIG = path.join(ROOT, 'infra', 'nginx', CONFIG_NAME);
const REMOTE_AVAILABLE = '/etc/nginx/sites-available/' + CONFIG_NAME;
const REMOTE_ENABLED = '/etc/nginx/sites-enabled/' + CONFIG_NAME;
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
function writeRemote(conn, content, remote) {
  return new Promise((resolve, reject) => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    const stream = sftp.createWriteStream(remote);
    stream.on('error', reject);
    stream.on('close', () => { sftp.end(); resolve(); });
    stream.end(content);
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
    if (!BOOTSTRAP) await execRemote(conn, 'test -f /etc/letsencrypt/live/gcode3d.com.br/fullchain.pem');
    const backup = REMOTE_AVAILABLE + '.backup-' + Date.now();
    const hadOriginal = (await execRemote(conn, `if test -f ${quote(REMOTE_AVAILABLE)}; then printf yes; fi`)).stdout === 'yes';
    const bootstrapEnabled = '/etc/nginx/sites-enabled/gcode3d-acme-bootstrap.conf';
    const hadBootstrap = !BOOTSTRAP && (await execRemote(conn, `if test -L ${quote(bootstrapEnabled)}; then printf yes; fi`)).stdout === 'yes';
    const apiConfig = '/etc/nginx/sites-available/mdv-api-ssl';
    const corsTemporary = temporary + '.cors';
    const apiBackup = apiConfig + '.backup-' + Date.now();
    let corsChanged = false;
    if (!BOOTSTRAP) {
      const original = (await execRemote(conn, `cat ${quote(apiConfig)}`)).stdout;
      const updated = patchApiCors(original);
      if (updated !== original) {
        await writeRemote(conn, updated, corsTemporary);
        if ((await execRemote(conn, `cat ${quote(apiConfig)}`)).stdout !== original) throw new Error('API CORS changed during staging');
        await execRemote(conn, `cp -p ${quote(apiConfig)} ${quote(apiBackup)}`);
        corsChanged = true;
      }
    }
    try {
    const result = await execRemote(conn, [
      hadOriginal ? `cp -p ${quote(REMOTE_AVAILABLE)} ${quote(backup)}` : 'true',
      `mv ${quote(temporary)} ${quote(REMOTE_AVAILABLE)}`,
      `ln -sfn ${quote(REMOTE_AVAILABLE)} ${quote(REMOTE_ENABLED)}`,
      corsChanged ? `mv ${quote(corsTemporary)} ${quote(apiConfig)}` : 'true',
      hadBootstrap ? `unlink ${quote(bootstrapEnabled)}` : 'true',
      'nginx -t',
      'systemctl reload nginx || nginx -s reload',
    ].join(' && '));
    console.log(JSON.stringify({ ok: true, installed: true, target: REMOTE_AVAILABLE, nginx: result.stderr || result.stdout }, null, 2));
    } catch (error) {
      if (corsChanged) await execRemote(conn, `cp -p ${quote(apiBackup)} ${quote(apiConfig)}`);
      await execRemote(conn, hadOriginal ? `cp -p ${quote(backup)} ${quote(REMOTE_AVAILABLE)}` : `unlink ${quote(REMOTE_ENABLED)}`);
      if (hadBootstrap) await execRemote(conn, `ln -sfn /etc/nginx/sites-available/gcode3d-acme-bootstrap.conf ${quote(bootstrapEnabled)}`);
      await execRemote(conn, 'nginx -t && (systemctl reload nginx || nginx -s reload)');
      throw error;
    }
  } finally {
    conn.end();
  }
}

function patchApiCors(source) {
  const oldHost = '3dmv\\.com\\.br';
  const newHost = 'gcode3d\\.com\\.br';
  const occurrences = source.split(oldHost).length - 1;
  if (occurrences === 0 && source.split(newHost).length - 1 === 2) return source;
  if (occurrences !== 2) throw new Error('API CORS configuration drift');
  return source.split(oldHost).join(newHost);
}
module.exports = { patchApiCors };
if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1); });

'use strict';

const { Client } = require('ssh2');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['.env.vps.local', '.env.local']) {
  require('dotenv').config({ path:path.join(__dirname, '..', file), quiet:true });
}

const apply = process.argv.includes('--apply');
const host = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const username = process.env.VPS_SITE_USER || process.env.VPS_USER;
const password = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;
const appDir = '/var/www/mdv-api';
const desiredFolder = '/home/SynologyDrive/producao-3d';
if (!host || !username || (!password && !privateKey)) throw new Error('Missing VPS SSH configuration');

const quote = value => `'${String(value).replace(/'/g, `'\\''`)}'`;
const connection = new Client();
function exec(command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '', stderr = '';
    stream.on('data', chunk => { stdout += chunk.toString(); });
    stream.stderr.on('data', chunk => { stderr += chunk.toString(); });
    stream.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || `Remote command failed (${code})`)));
  }));
}
function nodeCommand(source) {
  const encoded = Buffer.from(source).toString('base64');
  return `cd ${quote(appDir)} && node -e ${quote(`eval(Buffer.from('${encoded}','base64').toString())`)}`;
}

async function remoteSource(shouldApply, targetFolder) {
  const fs = require('node:fs');
  const crypto = require('node:crypto');
  const dotenv = require('dotenv');
  const envPath = '.env';
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = dotenv.parse(raw);
  const validFolder = /^\/(?:home|volume\d+)\/[A-Za-z0-9._/-]+\/producao-3d$/.test(targetFolder)
    && !targetFolder.split('/').some((part, index) => index > 0 && (!part || part === '.' || part === '..'));
  if (!validFolder || targetFolder.includes('/web/')) throw new Error('Invalid private Print3D folder');
  if (!env.SYNOLOGY_URL || !env.SYNOLOGY_USER || !env.SYNOLOGY_PASS) {
    throw new Error('Synology private API configuration is incomplete');
  }
  const featureKeys = Object.keys(env).filter(key => /^MDV_PRINT3D_.*_ENABLED$/.test(key));
  if (featureKeys.some(key => env[key] === '1')) {
    throw new Error('Print3D features must remain disabled during storage configuration');
  }
  const alreadyConfigured = String(env.MDV_PRINT3D_SYNOLOGY_FOLDER || '') === targetFolder;
  let backup = null;
  if (shouldApply && !alreadyConfigured) {
    const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
    backup = `.deploy-backups/print3d-storage-${stamp}-${crypto.randomBytes(3).toString('hex')}.env`;
    fs.mkdirSync('.deploy-backups', { recursive:true, mode:0o700 });
    fs.copyFileSync(envPath, backup, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(backup, 0o600);
    const line = `MDV_PRINT3D_SYNOLOGY_FOLDER=${targetFolder}`;
    const next = /^MDV_PRINT3D_SYNOLOGY_FOLDER=.*$/m.test(raw)
      ? raw.replace(/^MDV_PRINT3D_SYNOLOGY_FOLDER=.*$/m, line)
      : `${raw.replace(/\s*$/, '')}\n${line}\n`;
    const temporary = `.env.print3d-storage-${process.pid}`;
    fs.writeFileSync(temporary, next, { mode:0o600, flag:'wx' });
    fs.renameSync(temporary, envPath);
  }
  const verified = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
  const configured = String(verified.MDV_PRINT3D_SYNOLOGY_FOLDER || '') === targetFolder;
  if (shouldApply && !configured) throw new Error('Storage configuration verification failed');
  return {
    mode:shouldApply ? 'apply' : 'plan',
    configured,
    already_configured:alreadyConfigured,
    private_folder:targetFolder,
    synology_api_configured:true,
    public_web_folder:false,
    feature_flags_enabled:featureKeys.filter(key => verified[key] === '1'),
    runtime_restart_required:shouldApply && !alreadyConfigured,
    backup:backup ? `/var/www/mdv-api/${backup}` : null,
  };
}

async function main() {
  await new Promise((resolve, reject) => {
    connection.on('ready', resolve);
    connection.on('error', reject);
    connection.connect({ host, port:22, username, password, privateKey, readyTimeout:20000 });
  });
  const processes = JSON.parse(await exec('pm2 jlist'));
  const api = processes.filter(item => item.name === 'mdv-api');
  if (api.length !== 1 || api[0].pm2_env?.pm_cwd !== appDir) throw new Error('Unexpected API target');
  const source = `(${remoteSource.toString()})(${JSON.stringify(apply)},${JSON.stringify(desiredFolder)})`
    + `.then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exit(1)})`;
  const result = JSON.parse((await exec(nodeCommand(source))).trim());
  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => connection.end()).catch(error => { console.error(error.message); process.exitCode = 1; });

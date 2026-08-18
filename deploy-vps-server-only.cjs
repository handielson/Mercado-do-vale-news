const { Client } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.vps.local') });
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.vps.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') });

const host = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const username = process.env.VPS_SITE_USER || process.env.VPS_USER;
const password = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;
const localServer = path.join(__dirname, 'vps_server.js');
const localServerCjs = path.join(__dirname, 'vps_server.cjs');
const firebaseServiceAccountPath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
const mobileSalesServicePath = 'services/mobileSalesPushService.cjs';
const marketingCampaignServicePath = 'services/marketingCampaignApi.cjs';
const smartphonePhotoIntakeServiceFiles = [
  'services/physicalRamCore.cjs',
  'services/smartphonePhotoIntakeCore.cjs',
  'services/smartphonePhotoIntakeServer.cjs',
];
const autoresponderEngineFiles = [
  'services/autoresponder/engine/types.js',
  'services/autoresponder/engine/state.js',
  'services/autoresponder/engine/router.js',
  'services/autoresponder/engine/fallbacks.js',
  'services/autoresponder/engine/messages.js',
  'services/autoresponder/engine/flows/delivery.js',
  'services/autoresponder/engine/flows/product-search.js',
  'services/autoresponder/engine/flows/purchase.js',
];
const adminEmail = process.env.MDV_ADMIN_EMAIL || process.env.ADMIN_EMAIL || process.env.VPS_ADMIN_EMAIL || process.env.DEFAULT_ADMIN_EMAIL;
const adminPassword = process.env.MDV_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || process.env.VPS_ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD;
const wahaStatusServerUrl = process.env.WAHA_STATUS_SERVER_URL || 'http://127.0.0.1:18082';

if (!host || !username || (!password && !privateKey)) {
  throw new Error('Missing VPS SSH env vars');
}

const conn = new Client();

function exec(command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk.toString(); });
      stream.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      stream.on('close', (code) => {
        if (code && code !== 0) {
          reject(new Error(`${command} failed with code ${code}: ${stderr || stdout}`));
        } else {
          resolve(stdout);
        }
      });
    });
  });
}

function upload(local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(local, remote, (uploadErr) => {
        sftp.end();
        if (uploadErr) reject(uploadErr);
        else resolve();
      });
    });
  });
}

function withSftp(callback) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      callback(sftp)
        .then(resolve, reject)
        .finally(() => sftp.end());
    });
  });
}

function readRemoteText(sftp, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.readFile(remotePath, 'utf8', (err, data) => {
      if (err && err.code === 2) return resolve('');
      if (err) return reject(err);
      resolve(String(data || ''));
    });
  });
}

function writeRemoteText(sftp, remotePath, content) {
  return new Promise((resolve, reject) => {
    sftp.writeFile(remotePath, content, 'utf8', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function quoteEnvValue(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function remotePathJoin(...parts) {
  return parts.join('/').replace(/\/+/g, '/');
}

async function uploadAutoresponderEngineFiles(appDir) {
  await exec(`mkdir -p ${appDir}/services/autoresponder/engine ${appDir}/services/autoresponder/engine/flows`);
  for (const relativePath of autoresponderEngineFiles) {
    await upload(path.join(__dirname, relativePath), remotePathJoin(appDir, relativePath));
    console.log(`Uploaded ${relativePath}`);
  }
}

async function uploadSignedWarrantyFiles(appDir) {
  const relativePath = 'services/signedWarrantyDocumentCore.cjs';
  await exec(`mkdir -p ${appDir}/services`);
  await upload(path.join(__dirname, relativePath), remotePathJoin(appDir, relativePath));
  console.log(`Uploaded ${relativePath}`);
}

async function uploadMobileSalesPushFiles(appDir) {
  await exec(`mkdir -p ${appDir}/services`);
  await upload(
    path.join(__dirname, mobileSalesServicePath),
    remotePathJoin(appDir, mobileSalesServicePath),
  );
  console.log(`Uploaded ${mobileSalesServicePath}`);
}

async function uploadMarketingCampaignFiles(appDir) {
  await exec(`mkdir -p ${appDir}/services`);
  await upload(
    path.join(__dirname, marketingCampaignServicePath),
    remotePathJoin(appDir, marketingCampaignServicePath),
  );
  console.log(`Uploaded ${marketingCampaignServicePath}`);
}

async function uploadSmartphonePhotoIntakeFiles(appDir) {
  await exec(`mkdir -p ${appDir}/services`);
  for (const relativePath of smartphonePhotoIntakeServiceFiles) {
    await upload(path.join(__dirname, relativePath), remotePathJoin(appDir, relativePath));
    console.log(`Uploaded ${relativePath}`);
  }
}

async function ensureRemoteFirebaseCredentials(appDir) {
  if (!firebaseServiceAccountPath) return null;
  if (!fs.existsSync(firebaseServiceAccountPath)) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH does not exist');
  }
  const remoteSecretDir = `${appDir}/.secrets`;
  const remoteSecretPath = `${remoteSecretDir}/gestao-mdv-firebase.json`;
  await exec(`mkdir -p ${remoteSecretDir} && chmod 700 ${remoteSecretDir}`);
  await upload(firebaseServiceAccountPath, remoteSecretPath);
  await exec(`chmod 600 ${remoteSecretPath}`);
  console.log('Firebase service account uploaded to protected runtime directory');
  return remoteSecretPath;
}

function upsertEnv(content, entries) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const seen = new Set();
  const next = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !(match[1] in entries)) return line;
    seen.add(match[1]);
    return `${match[1]}=${quoteEnvValue(entries[match[1]])}`;
  });

  for (const [key, value] of Object.entries(entries)) {
    if (!seen.has(key)) next.push(`${key}=${quoteEnvValue(value)}`);
  }

  return `${next.join('\n').replace(/\n+$/, '')}\n`;
}

function readEnvValue(content, key) {
  const match = String(content || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .find((line) => line.startsWith(`${key}=`));
  if (!match) return '';
  return match
    .slice(key.length + 1)
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

async function ensureRemoteAdminEnv(appDir, remoteFirebaseCredentialPath = null) {
  const remoteEnv = `${appDir}/.env`;
  let wahaStatusApiKey = String(process.env.WAHA_STATUS_API_KEY || '').trim();
  if (!wahaStatusApiKey) {
    try {
      wahaStatusApiKey = String(await exec(
        "docker inspect waha_status_canary --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^WAHA_API_KEY=//p' | head -1"
      )).trim();
    } catch {
      // Mantem o valor remoto atual; a validacao pos-deploy acusara se a chave estiver ausente.
    }
  }
  await withSftp(async (sftp) => {
    const current = await readRemoteText(sftp, remoteEnv);
    const currentMetaEncryptionKey = readEnvValue(current, 'META_TOKEN_ENCRYPTION_KEY');
    const entries = {
      WAHA_STATUS_SERVER_URL: wahaStatusServerUrl,
      WAHA_STATUS_TIMEOUT_MS: process.env.WAHA_STATUS_TIMEOUT_MS || '90000',
      WAHA_STATUS_MEDIA_INTERVAL_MS: process.env.WAHA_STATUS_MEDIA_INTERVAL_MS || '8000',
      WHATSAPP_STATUS_STALE_SENDING_SECONDS: process.env.WHATSAPP_STATUS_STALE_SENDING_SECONDS || '120',
      META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION || readEnvValue(current, 'META_GRAPH_API_VERSION') || 'v25.0',
      META_OAUTH_REDIRECT_URI: process.env.META_OAUTH_REDIRECT_URI || readEnvValue(current, 'META_OAUTH_REDIRECT_URI') || 'https://api.xiaomipetrolina.com.br/integrations/meta/oauth/callback',
      META_TOKEN_ENCRYPTION_KEY: process.env.META_TOKEN_ENCRYPTION_KEY || currentMetaEncryptionKey || crypto.randomBytes(32).toString('hex'),
    };
    if (process.env.META_APP_ID) entries.META_APP_ID = process.env.META_APP_ID;
    if (process.env.META_APP_SECRET) entries.META_APP_SECRET = process.env.META_APP_SECRET;
    if (wahaStatusApiKey) entries.WAHA_STATUS_API_KEY = wahaStatusApiKey;
    entries.WAHA_STATUS_SESSION = process.env.WAHA_STATUS_SESSION || 'statusloja-wpp';
    if (adminEmail && adminPassword) {
      entries.MDV_ADMIN_EMAIL = adminEmail;
      entries.MDV_ADMIN_PASSWORD = adminPassword;
    }
    if (remoteFirebaseCredentialPath) {
      entries.FIREBASE_SERVICE_ACCOUNT_PATH = remoteFirebaseCredentialPath;
    }
    const next = upsertEnv(current, entries);
    await writeRemoteText(sftp, remoteEnv, next);
    const requiredMetaKeys = [
      'META_GRAPH_API_VERSION',
      'META_APP_ID',
      'META_APP_SECRET',
      'META_OAUTH_REDIRECT_URI',
      'META_TOKEN_ENCRYPTION_KEY',
    ];
    const missingMetaKeys = requiredMetaKeys.filter((key) => !readEnvValue(next, key));
    console.log(missingMetaKeys.length
      ? `Meta runtime configuration pending: ${missingMetaKeys.join(', ')}`
      : 'Meta runtime configuration ready');
  });
  console.log(`Remote runtime env synced at ${remoteEnv}`);
}

async function ensureRemoteMediaDocumentDependencies(appDir) {
  const checkCommand = `cd ${appDir} && node -e "require.resolve('sharp'); require.resolve('pdf-lib'); require.resolve('ffmpeg-static')"`;
  try {
    await exec(checkCommand);
    console.log('Remote image, video and PDF dependencies already available');
    return;
  } catch {
    console.log('Installing remote image, video and PDF dependencies');
  }

  await exec(`cd ${appDir} && npm install sharp pdf-lib ffmpeg-static@5.3.0 --omit=dev`);
}

async function ensureRemoteMobileSalesDependencies(appDir) {
  try {
    await exec(`cd ${appDir} && node -e "require.resolve('firebase-admin')"`);
    console.log('Remote Firebase Admin dependency already available');
    return;
  } catch {
    console.log('Installing remote Firebase Admin dependency');
  }
  await exec(`cd ${appDir} && npm install firebase-admin@13.10.0 --omit=dev`);
}

async function main() {
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host, port: 22, username, password, privateKey, readyTimeout: 20000 });
  });

  const pm2Raw = await exec('pm2 jlist');
  const pm2List = JSON.parse(pm2Raw);
  const apiProc = pm2List.find((p) =>
    String(p.pm2_env?.pm_exec_path || '').includes('server')
    || String(p.name || '').includes('api')
    || String(p.name || '').includes('vps')
  );
  if (!apiProc) throw new Error('Unable to locate target PM2 app');

  const appDir = apiProc.pm2_env.pm_cwd;
  console.log(`Uploading server to ${appDir}`);
  await upload(localServer, `${appDir}/vps_server.js`);
  await upload(localServerCjs, `${appDir}/vps_server.cjs`);
  await upload(localServer, `${appDir}/server.js`);
  await uploadAutoresponderEngineFiles(appDir);
  await uploadSignedWarrantyFiles(appDir);
  await uploadMobileSalesPushFiles(appDir);
  await uploadMarketingCampaignFiles(appDir);
  await uploadSmartphonePhotoIntakeFiles(appDir);
  const remoteFirebaseCredentialPath = await ensureRemoteFirebaseCredentials(appDir);
  await ensureRemoteAdminEnv(appDir, remoteFirebaseCredentialPath);
  await ensureRemoteMediaDocumentDependencies(appDir);
  await ensureRemoteMobileSalesDependencies(appDir);
  const restartOutput = await exec(`pm2 restart ${apiProc.name} --update-env`);
  console.log(restartOutput.trim());
  conn.end();
}

main().catch((err) => {
  console.error(err.message);
  conn.end();
  process.exit(1);
});

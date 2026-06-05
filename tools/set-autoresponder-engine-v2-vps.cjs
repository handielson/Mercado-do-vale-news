#!/usr/bin/env node

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const host = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const username = process.env.VPS_SITE_USER || process.env.VPS_USER;
const password = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;
const apply = process.env.AUTORESPONDER_ENGINE_V2_APPLY === '1';
const desiredValue = process.env.AUTORESPONDER_ENGINE_V2_VALUE === '0' ? '0' : '1';

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
        if (code && code !== 0) reject(new Error(`${command} failed with code ${code}: ${stderr || stdout}`));
        else resolve(stdout);
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
  const pattern = new RegExp(`^${key}=(.*)$`, 'm');
  const match = String(content || '').match(pattern);
  return match ? match[1].replace(/^"|"$/g, '') : '';
}

async function locateApiProcess() {
  const pm2Raw = await exec('pm2 jlist');
  const pm2List = JSON.parse(pm2Raw);
  const apiProc = pm2List.find((p) =>
    String(p.pm2_env?.pm_exec_path || '').includes('server')
    || String(p.name || '').includes('api')
    || String(p.name || '').includes('vps')
  );
  if (!apiProc) throw new Error('Unable to locate target PM2 app');
  return apiProc;
}

async function main() {
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host, port: 22, username, password, privateKey, readyTimeout: 20000 });
  });

  const apiProc = await locateApiProcess();
  const appDir = apiProc.pm2_env.pm_cwd;
  const remoteEnv = `${appDir}/.env`;

  await withSftp(async (sftp) => {
    const current = await readRemoteText(sftp, remoteEnv);
    const currentValue = readEnvValue(current, 'AUTORESPONDER_ENGINE_V2') || '(unset)';
    const next = upsertEnv(current, { AUTORESPONDER_ENGINE_V2: desiredValue });
    console.log(`PM2 app: ${apiProc.name}`);
    console.log(`Remote env: ${remoteEnv}`);
    console.log(`Current AUTORESPONDER_ENGINE_V2: ${currentValue}`);
    console.log(`Desired AUTORESPONDER_ENGINE_V2: ${desiredValue}`);

    if (!apply) {
      console.log('Dry run only. Set AUTORESPONDER_ENGINE_V2_APPLY=1 to write .env and restart PM2.');
      return;
    }

    const backupPath = `${remoteEnv}.autoresponder-engine-v2-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
    await writeRemoteText(sftp, backupPath, current);
    await writeRemoteText(sftp, remoteEnv, next);
    console.log(`Backup written: ${backupPath}`);
  });

  if (apply) {
    const restartOutput = await exec(`pm2 restart ${apiProc.name} --update-env`);
    console.log(restartOutput.trim());
  }

  conn.end();
}

main().catch((err) => {
  console.error(err.message);
  conn.end();
  process.exit(1);
});

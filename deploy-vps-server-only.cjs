const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.vps.local') });
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const host = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const username = process.env.VPS_SITE_USER || process.env.VPS_USER;
const password = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;
const localServer = path.join(__dirname, 'vps_server.js');

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
  await upload(localServer, `${appDir}/server.js`);
  const restartOutput = await exec(`pm2 restart ${apiProc.name} --update-env`);
  console.log(restartOutput.trim());
  conn.end();
}

main().catch((err) => {
  console.error(err.message);
  conn.end();
  process.exit(1);
});

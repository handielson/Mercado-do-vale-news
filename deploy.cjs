const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env.vps.local') });
  require('dotenv').config({ path: path.join(__dirname, '.env.local') });
} catch {
  // dotenv is optional when env vars are injected by the caller.
}

const conn = new Client();

const VpsHost = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const VpsUser = process.env.VPS_SITE_USER || process.env.VPS_USER;
const VpsPass = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const VpsPrivateKey = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;

function requireConfig() {
  const missing = [];
  if (!VpsHost) missing.push('VPS_SITE_HOST');
  if (!VpsUser) missing.push('VPS_SITE_USER');
  if (!VpsPass && !VpsPrivateKey) missing.push('VPS_SITE_PASSWORD or VPS_SITE_PRIVATE_KEY');
  if (missing.length > 0) {
    throw new Error(`Missing required VPS SSH env vars: ${missing.join(', ')}`);
  }
}

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
      console.log(`Uploading ${path.relative(__dirname, local)} -> ${remote}`);
      sftp.fastPut(local, remote, (uploadErr) => {
        sftp.end();
        if (uploadErr) {
          reject(uploadErr);
        } else {
          console.log(`Uploaded ${path.basename(local)}`);
          resolve();
        }
      });
    });
  });
}

async function main() {
  requireConfig();
  console.log(`Connecting to VPS (${VpsHost})...`);

  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({
      host: VpsHost,
      port: 22,
      username: VpsUser,
      password: VpsPass,
      privateKey: VpsPrivateKey ? fs.readFileSync(VpsPrivateKey) : undefined,
      readyTimeout: 20000
    });
  });

  console.log('SSH connected');

  const pm2Raw = await exec('pm2 jlist');
  const pm2List = JSON.parse(pm2Raw);
  if (pm2List.length === 0) {
    throw new Error('No PM2 process found');
  }

  const apiProc = pm2List.find((p) =>
    p.pm2_env?.pm_exec_path?.includes('server') || p.name.includes('api') || p.name.includes('vps')
  );

  if (!apiProc) {
    console.log('Unable to locate target PM2 app');
    console.log(pm2List.map((p) => ({ name: p.name, cwd: p.pm2_env?.pm_cwd })));
    conn.end();
    return;
  }

  const appDir = apiProc.pm2_env.pm_cwd;
  console.log(`PM2 app found at ${appDir}`);

  // Ensure directories exist
  await exec(`mkdir -p ${appDir}/services`);

  const remoteFiles = [
    {
      local: path.join(__dirname, 'vps_server.js'),
      remote: `${appDir}/vps_server.js`,
    },
    {
      local: path.join(__dirname, 'vps_server.js'),
      remote: `${appDir}/server.js`,
    },
    {
      local: path.join(__dirname, 'services', 'synologyNasStatusService.js'),
      remote: `${appDir}/services/synologyNasStatusService.js`,
    },
    {
      local: path.join(__dirname, 'services', 'synologyCommandQueueService.js'),
      remote: `${appDir}/services/synologyCommandQueueService.js`,
    },
    {
      local: path.join(__dirname, 'services', 'vpsUploadPathPolicy.cjs'),
      remote: `${appDir}/services/vpsUploadPathPolicy.cjs`,
    },
  ];

  for (const file of remoteFiles) {
    await upload(file.local, file.remote);
  }

  const restartCmd = `pm2 restart ${apiProc.name}`;
  console.log(`Restarting app: ${restartCmd}`);
  const restartOutput = await exec(restartCmd);
  console.log(restartOutput.trim());

  console.log('Deploy completed successfully!');
  conn.end();
}

main().catch((err) => {
  console.error('Deploy error:', err.message || err);
  conn.end();
  process.exit(1);
});

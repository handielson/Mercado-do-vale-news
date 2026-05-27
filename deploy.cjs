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

function finishAndClose() {
  conn.end();
}

function uploadFilesSequentially(sftp, files, done) {
  const [current, ...rest] = files;
  if (!current) return done(null);

  console.log(`Uploading ${path.relative(__dirname, current.local)} -> ${current.remote}`);
  sftp.fastPut(current.local, current.remote, (err) => {
    if (err) return done(err);
    console.log(`Uploaded ${path.basename(current.local)}`);
    uploadFilesSequentially(sftp, rest, done);
  });
}

console.log(`Connecting to VPS (${VpsHost})...`);
requireConfig();

conn.on('ready', () => {
  console.log('SSH connected');

  conn.exec('pm2 jlist', (err, stream) => {
    if (err) throw err;

    let data = '';
    stream.on('data', (chunk) => {
      data += chunk.toString();
    });

    stream.on('close', () => {
      try {
        const pm2List = JSON.parse(data);
        if (pm2List.length === 0) {
          console.log('No PM2 process found');
          return finishAndClose();
        }

        const apiProc = pm2List.find((p) =>
          p.pm2_env.pm_exec_path.includes('server') || p.name.includes('api') || p.name.includes('vps')
        );

        if (!apiProc) {
          console.log('Unable to locate target PM2 app');
          console.log(pm2List.map((p) => ({ name: p.name, cwd: p.pm2_env.pm_cwd })));
          return finishAndClose();
        }

        const appDir = apiProc.pm2_env.pm_cwd;
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

        console.log(`PM2 app found at ${appDir}`);

        conn.exec(`mkdir -p ${appDir}/services`, (mkdirErr, mkdirStream) => {
          if (mkdirErr) throw mkdirErr;

          mkdirStream.on('close', () => {
            conn.sftp((sftpErr, sftp) => {
              if (sftpErr) throw sftpErr;

              uploadFilesSequentially(sftp, remoteFiles, (uploadErr) => {
                if (uploadErr) {
                  console.log('Upload error:', uploadErr);
                  sftp.end();
                  return finishAndClose();
                }

                const restartCmd = `pm2 restart ${apiProc.name}`;
                console.log(`Restarting app: ${restartCmd}`);
                conn.exec(restartCmd, (restartErr, restartStream) => {
                  if (restartErr) throw restartErr;

                  restartStream
                    .on('close', () => {
                      console.log(`App ${apiProc.name} restarted`);
                      sftp.end();
                      conn.end();
                    })
                    .on('data', (chunk) => {
                      console.log(chunk.toString().trim());
                    });
                });
              });
            });
          });
        });
      } catch (parseError) {
        console.log('Error parsing PM2 output');
        console.log(data);
        console.log(parseError);
        conn.end();
      }
    });
  });
}).connect({
  host: VpsHost,
  port: 22,
  username: VpsUser,
  password: VpsPass,
  privateKey: VpsPrivateKey ? fs.readFileSync(VpsPrivateKey) : undefined,
});

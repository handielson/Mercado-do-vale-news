const { Client } = require('ssh2');
const path = require('path');

const conn = new Client();

const VpsHost = '76.13.232.162';
const VpsUser = 'root';
const VpsPass = '@@@@Jsj2865@@@@';

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
});

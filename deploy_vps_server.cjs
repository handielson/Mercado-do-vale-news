/**
 * deploy_vps_server.cjs
 * Uploads vps_server.js and its runtime support files to the VPS, then restarts PM2.
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '76.13.232.162';
const USER = 'root';
const PASS = '@@@@Jsj2865@@@@';
const APP_DIR = '/var/www/mdv-api';

const FILES = [
  {
    local: path.join(__dirname, 'vps_server.js'),
    remote: `${APP_DIR}/server.js`,
  },
  {
    local: path.join(__dirname, 'services', 'vpsUploadPathPolicy.cjs'),
    remote: `${APP_DIR}/services/vpsUploadPathPolicy.cjs`,
  },
  {
    local: path.join(__dirname, 'fix-expired-images.cjs'),
    remote: `${APP_DIR}/fix-expired-images.cjs`,
  },
];

function uploadFilesSequentially(sftp, files, done) {
  const [current, ...rest] = files;
  if (!current) return done(null);

  const content = fs.readFileSync(current.local);
  const stream = sftp.createWriteStream(current.remote);
  stream.on('close', () => {
    console.log(`Uploaded ${path.relative(__dirname, current.local)} -> ${current.remote}`);
    uploadFilesSequentially(sftp, rest, done);
  });
  stream.on('error', done);
  stream.end(content);
}

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to VPS. Uploading files...');
  conn.exec(`mkdir -p ${APP_DIR}/services`, (mkdirErr, mkdirStream) => {
    if (mkdirErr) {
      console.error('Exec error:', mkdirErr);
      process.exit(1);
    }

    mkdirStream.on('close', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          console.error('SFTP error:', err);
          process.exit(1);
        }

        uploadFilesSequentially(sftp, FILES, (uploadErr) => {
          if (uploadErr) {
            console.error('Upload error:', uploadErr);
            process.exit(1);
          }

          console.log('Files uploaded. Restarting PM2...');
          conn.exec('pm2 restart all', (err2, stream) => {
            if (err2) {
              console.error('Exec error:', err2);
              process.exit(1);
            }

            stream.on('data', d => process.stdout.write(d.toString()));
            stream.stderr.on('data', d => process.stderr.write(d.toString()));
            stream.on('close', code => {
              console.log(`PM2 restarted. Exit: ${code}`);
              sftp.end();
              conn.end();
            });
          });
        });
      });
    });
  });
}).on('error', err => {
  console.error('SSH connection error:', err.message);
  process.exit(1);
}).connect({ host: HOST, port: 22, username: USER, password: PASS });

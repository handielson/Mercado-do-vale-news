/**
 * deploy_server.cjs
 * Uploads the VPS API files and restarts PM2.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const HOST = '76.13.232.162';
const USER = 'root';
const PASS = '@@@@Jsj2865@@@@';
const REMOTE_ROOT = '/var/www/mdv-api';
const FILES = [
  { local: path.join(__dirname, 'server.js'), remote: `${REMOTE_ROOT}/server.js` },
  { local: path.join(__dirname, 'utils', 'video-file-name.cjs'), remote: `${REMOTE_ROOT}/utils/video-file-name.cjs` },
];

function uploadFile(sftp, file) {
  return new Promise((resolve, reject) => {
    const content = fs.readFileSync(file.local);
    const stream = sftp.createWriteStream(file.remote);
    stream.on('close', () => {
      console.log(`${path.relative(__dirname, file.local)} enviado!`);
      resolve(null);
    });
    stream.on('error', reject);
    stream.end(content);
  });
}

async function run() {
  try { require.resolve('ssh2'); } catch (_) {
    console.log('Instalando ssh2...');
    execSync('npm install ssh2 --no-save', { stdio: 'inherit' });
  }

  const { Client } = require('ssh2');
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('Conectado a VPS. Enviando arquivos da API...');
      conn.exec(`mkdir -p ${REMOTE_ROOT}/utils`, (mkdirErr, mkdirStream) => {
        if (mkdirErr) return reject(mkdirErr);
        mkdirStream.on('close', () => {
          conn.sftp(async (err, sftp) => {
            if (err) return reject(err);

            try {
              for (const file of FILES) {
                await uploadFile(sftp, file);
              }
              sftp.end();
            } catch (uploadErr) {
              sftp.end();
              return reject(uploadErr);
            }

            conn.exec('pm2 restart mdv-api', (err2, stream2) => {
              if (err2) return reject(err2);
              stream2.on('data', (d) => process.stdout.write(d.toString()));
              stream2.stderr.on('data', (d) => process.stderr.write(d.toString()));
              stream2.on('close', () => {
                console.log('PM2 reiniciado!');
                conn.end();
                resolve(null);
              });
            });
          });
        });
      });
    });
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS });
  });
}

run().catch(err => { console.error('Erro:', err.message); process.exit(1); });

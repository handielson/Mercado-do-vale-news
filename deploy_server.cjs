/**
 * deploy_server.cjs
 * Faz upload do server.js para a VPS via SSH e reinicia o PM2.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const HOST = '76.13.232.162';
const USER = 'root';
const PASS = '@@@@Jsj2865@@@@';
const REMOTE_PATH = '/var/www/mdv-api/server.js';
const LOCAL_FILE = path.join(__dirname, 'server.js');

async function run() {
  const content = fs.readFileSync(LOCAL_FILE, 'utf-8');

  // Instala o ssh2 se não estiver disponível
  try { require.resolve('ssh2'); } catch (_) {
    console.log('Instalando ssh2...');
    execSync('npm install ssh2 --no-save', { stdio: 'inherit' });
  }

  const { Client } = require('ssh2');
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('Conectado à VPS. Enviando server.js...');
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        const stream = sftp.createWriteStream(REMOTE_PATH);
        stream.on('close', () => {
          console.log('✅ server.js enviado!');
          conn.exec('pm2 restart mdv-api', (err2, stream2) => {
            if (err2) return reject(err2);
            stream2.on('data', (d) => process.stdout.write(d.toString()));
            stream2.stderr.on('data', (d) => process.stderr.write(d.toString()));
            stream2.on('close', () => {
              console.log('✅ PM2 reiniciado!');
              conn.end();
              resolve(null);
            });
          });
        });
        stream.on('error', reject);
        stream.end(content);
      });
    });
    conn.on('error', reject);
    conn.connect({ host: HOST, port: 22, username: USER, password: PASS });
  });
}

run().catch(err => { console.error('Erro:', err.message); process.exit(1); });

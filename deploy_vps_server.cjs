/**
 * deploy_vps_server.cjs
 * Envia vps_server.js para a VPS e reinicia o PM2.
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = '76.13.232.162';
const USER = 'root';
const PASS = '@@@@Jsj2865@@@@';
const REMOTE_PATH = '/var/www/mdv-api/server.js';
const LOCAL_FILE = path.join(__dirname, 'vps_server.js');

const content = fs.readFileSync(LOCAL_FILE);

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ Conectado à VPS. Enviando vps_server.js...');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); process.exit(1); }
    const stream = sftp.createWriteStream(REMOTE_PATH);
    stream.on('close', () => {
      console.log('✅ vps_server.js enviado! Reiniciando PM2...');
      conn.exec('pm2 restart all', (err2, s) => {
        if (err2) { console.error('Exec error:', err2); process.exit(1); }
        s.on('data', d => process.stdout.write(d.toString()));
        s.stderr.on('data', d => process.stderr.write(d.toString()));
        s.on('close', code => {
          console.log(`✅ PM2 reiniciado! (exit: ${code})`);
          conn.end();
        });
      });
    });
    stream.on('error', err => { console.error('Stream error:', err); process.exit(1); });
    stream.end(content);
  });
}).on('error', err => {
  console.error('❌ Erro de conexão SSH:', err.message);
  process.exit(1);
}).connect({ host: HOST, port: 22, username: USER, password: PASS });

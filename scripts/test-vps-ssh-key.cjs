// Testa o acesso SSH a VPS usando SOMENTE a chave (sem senha), como os deploys vao fazer.
// Uso: node scripts/test-vps-ssh-key.cjs
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local') });
const host = process.env.VPS_SITE_HOST;
const username = process.env.VPS_SITE_USER;
const keyPath = process.env.VPS_SITE_PRIVATE_KEY;
if (!host || !username || !keyPath) { console.error('Faltando VPS_SITE_HOST/USER/PRIVATE_KEY no .env.vps.local'); process.exit(1); }
let privateKey;
try { privateKey = fs.readFileSync(keyPath); } catch (e) { console.error('Nao consegui ler a chave:', keyPath, '-', e.message); process.exit(1); }
const c = new Client();
c.on('ready', () => {
  c.exec('whoami && hostname', (err, stream) => {
    if (err) { console.error('ERRO exec:', err.message); c.end(); process.exit(1); }
    stream.on('data', d => process.stdout.write('VPS: ' + d)).on('close', () => { console.log('OK: entrou na VPS so com a chave.'); c.end(); });
  });
}).on('error', e => { console.error('FALHOU:', e.message, '\n(Se falar em passphrase, a chave tem senha e o deploy nao vai conseguir usar sozinho.)'); process.exit(1); })
  .connect({ host, port: 22, username, privateKey, readyTimeout: 20000 });

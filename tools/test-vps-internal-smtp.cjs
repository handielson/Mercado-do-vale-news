const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const host = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const username = process.env.VPS_SITE_USER || process.env.VPS_USER || 'root';
const password = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;

if (!host || !username || (!password && !privateKey)) throw new Error('Missing VPS SSH env vars');

const script = String.raw`
set -euo pipefail

node - <<'NODE'
const fs = require('fs');
const net = require('net');

const lines = fs.readFileSync('/root/contato-mailbox-credentials.txt', 'utf8').trim().split(/\n/);
const creds = Object.fromEntries(lines.map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));

const socket = net.createConnection(2525, '127.0.0.1');
let buffer = '';

function readResponse() {
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (/^\d{3} /.test(last)) {
        socket.off('data', onData);
        const output = buffer;
        buffer = '';
        resolve(output);
      }
    };
    socket.on('data', onData);
    socket.once('error', reject);
  });
}

async function command(line) {
  socket.write(line + '\r\n');
  return readResponse();
}

(async () => {
  await readResponse();
  await command('EHLO api.local');
  await command('AUTH LOGIN');
  await command(Buffer.from('contato').toString('base64'));
  const auth = await command(Buffer.from(creds.password).toString('base64'));
  if (!auth.startsWith('235')) throw new Error('auth_failed');
  await command('MAIL FROM:<contato@mercadodovale.com.br>');
  await command('RCPT TO:<handielson@gmail.com>');
  await command('DATA');
  socket.write([
    'From: Mercado do Vale <contato@mercadodovale.com.br>',
    'To: <handielson@gmail.com>',
    'Subject: Teste SMTP VPS Mercado do Vale',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    'SMTP interno da VPS funcionando.',
    '.',
    '',
  ].join('\r\n'));
  const data = await readResponse();
  if (!data.startsWith('250')) throw new Error('data_failed ' + data);
  await command('QUIT').catch(() => null);
  socket.end();
  console.log('smtp_internal_send_ok');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
NODE

sleep 8
echo QUEUE
mailq | sed -n '1,20p'
echo LOG
tail -n 24 /var/log/mail.log 2>/dev/null || journalctl -u postfix --no-pager -n 24
`;

function exec(conn, command, stdin) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk.toString(); });
      stream.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      stream.on('close', (code) => {
        if (code && code !== 0) reject(new Error(stderr || stdout || `ssh command failed: ${code}`));
        else resolve({ stdout, stderr });
      });
      stream.end(stdin);
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host, port: 22, username, password, privateKey, readyTimeout: 20000 });
  });
  const { stdout, stderr } = await exec(conn, 'bash -s', script);
  conn.end();
  console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

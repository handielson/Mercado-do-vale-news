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
const tls = require('tls');

const lines = fs.readFileSync('/root/contato-mailbox-credentials.txt', 'utf8').trim().split(/\n/);
const creds = Object.fromEntries(lines.map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));

const socket = tls.connect({
  host: 'mail.mercadodovale.com.br',
  port: 993,
  servername: 'mail.mercadodovale.com.br',
  rejectUnauthorized: true,
});

let buffer = '';
function waitFor(pattern) {
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      if (pattern.test(buffer)) {
        socket.off('data', onData);
        const value = buffer;
        buffer = '';
        resolve(value);
      }
    };
    socket.on('data', onData);
    socket.once('error', reject);
  });
}

(async () => {
  await waitFor(/^\* OK/m);
  socket.write('a1 LOGIN "contato@mercadodovale.com.br" "' + creds.password.replace(/(["\\])/g, '\\$1') + '"\r\n');
  const login = await waitFor(/^a1 /m);
  if (!/^a1 OK/m.test(login)) throw new Error('imap_login_failed');
  socket.write('a2 LOGOUT\r\n');
  socket.end();
  console.log('imap_tls_login_ok');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
NODE
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

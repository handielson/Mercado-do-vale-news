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

if (!host || !username || (!password && !privateKey)) {
  throw new Error('Missing VPS SSH env vars');
}

const script = String.raw`
set -euo pipefail

python3 - <<'PY'
from pathlib import Path

conf = Path('/etc/opendkim.conf')
text = conf.read_text()
lines = []
seen = False
for line in text.splitlines():
    if line.strip().startswith('Socket'):
        lines.append('Socket                  inet:8891@localhost')
        seen = True
    else:
        lines.append(line)
if not seen:
    lines.append('Socket                  inet:8891@localhost')
conf.write_text('\n'.join(lines) + '\n')

defaults = Path('/etc/default/opendkim')
if defaults.exists():
    text = defaults.read_text()
else:
    text = ''
lines = []
seen = False
for line in text.splitlines():
    if line.startswith('SOCKET='):
        lines.append('SOCKET=inet:8891@localhost')
        seen = True
    else:
        lines.append(line)
if not seen:
    lines.append('SOCKET=inet:8891@localhost')
defaults.write_text('\n'.join(lines) + '\n')
PY

postconf -e "milter_default_action = accept"
postconf -e "milter_protocol = 6"
postconf -e "smtpd_milters = inet:localhost:8891"
postconf -e "non_smtpd_milters = inet:localhost:8891"

systemctl restart opendkim
systemctl restart postfix
sleep 2

echo SERVICES
systemctl is-active opendkim postfix
echo SOCKET
ss -ltnp | grep ':8891 ' || true
echo POSTFIX
postconf smtpd_milters non_smtpd_milters
`;

function exec(conn, command, stdin = '') {
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
      if (stdin) stream.end(stdin);
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

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

APP_DIR="/var/www/mdv-api"
ENV_FILE="$APP_DIR/.env"
CREDS_FILE="/root/contato-mailbox-credentials.txt"

if [ ! -f "$CREDS_FILE" ]; then
  echo "missing_mailbox_credentials" >&2
  exit 1
fi

MAIL_PASS="$(grep '^password=' "$CREDS_FILE" | sed 's/^password=//')"
if [ -z "$MAIL_PASS" ]; then
  echo "missing_mailbox_password" >&2
  exit 1
fi
export MAIL_PASS

postconf -M "127.0.0.1:2525/inet=127.0.0.1:2525 inet n - y - - smtpd"
postconf -P "127.0.0.1:2525/inet/syslog_name=postfix/internal-submission"
postconf -P "127.0.0.1:2525/inet/smtpd_tls_security_level=none"
postconf -P "127.0.0.1:2525/inet/smtpd_sasl_auth_enable=yes"
postconf -P "127.0.0.1:2525/inet/smtpd_recipient_restrictions=permit_sasl_authenticated,reject"
systemctl restart postfix

python3 - <<'PY'
import os
from pathlib import Path

env_file = Path('/var/www/mdv-api/.env')
password = os.environ['MAIL_PASS']
entries = {
    'SMTP_HOST': '127.0.0.1',
    'SMTP_PORT': '2525',
    'SMTP_SECURE': 'false',
    'SMTP_STARTTLS': 'false',
    'SMTP_USER': 'contato',
    'SMTP_PASS': password,
    'SMTP_FROM': 'contato@mercadodovale.com.br',
    'SMTP_FROM_NAME': 'Mercado do Vale',
}

lines = env_file.read_text().splitlines() if env_file.exists() else []
seen = set()
next_lines = []
for line in lines:
    key = line.split('=', 1)[0] if '=' in line else ''
    if key in entries:
        value = entries[key].replace('\\', '\\\\').replace('"', '\\"')
        next_lines.append(f'{key}="{value}"')
        seen.add(key)
    else:
        next_lines.append(line)
for key, value in entries.items():
    if key not in seen:
        value = value.replace('\\', '\\\\').replace('"', '\\"')
        next_lines.append(f'{key}="{value}"')
env_file.write_text('\n'.join(next_lines).rstrip() + '\n')
PY

pm2 restart mdv-api --update-env >/tmp/mdv-api-smtp-restart.log

echo INTERNAL_SMTP
ss -ltnp | grep ':2525 ' || true
echo API_ENV
grep -E '^SMTP_(HOST|PORT|SECURE|STARTTLS|USER|FROM|FROM_NAME)=' "$ENV_FILE" | sed 's/SMTP_PASS=.*/SMTP_PASS=*** /'
echo PM2
pm2 jlist | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const p=JSON.parse(d).find(x=>x.name==='mdv-api'); console.log(JSON.stringify({name:p?.name,status:p?.pm2_env?.status,restart_time:p?.pm2_env?.restart_time}));})"
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
  const { stdout, stderr } = await exec(conn, 'MAIL_PASS="$(grep \'^password=\' /root/contato-mailbox-credentials.txt | sed \'s/^password=//\')" bash -s', script);
  conn.end();
  console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

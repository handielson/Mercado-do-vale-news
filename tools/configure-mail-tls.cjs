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

MAIL_HOST="mail.mercadodovale.com.br"
CERT_DIR="/etc/letsencrypt/live/$MAIL_HOST"

mkdir -p /var/www/certbot
cat >/etc/nginx/sites-available/mail-acme.conf <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name mail.mercadodovale.com.br;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 204;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/mail-acme.conf /etc/nginx/sites-enabled/mail-acme.conf
nginx -t
systemctl reload nginx

if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  certbot certonly --webroot -w /var/www/certbot -d "$MAIL_HOST" --non-interactive --agree-tos --register-unsafely-without-email
else
  certbot renew --cert-name "$MAIL_HOST" --deploy-hook "systemctl reload dovecot postfix" || true
fi

postconf -e "smtpd_tls_cert_file = $CERT_DIR/fullchain.pem"
postconf -e "smtpd_tls_key_file = $CERT_DIR/privkey.pem"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtpd_tls_security_level = may"
postconf -M "smtps/inet=smtps inet n - y - - smtpd"
postconf -P "smtps/inet/syslog_name=postfix/smtps"
postconf -P "smtps/inet/smtpd_tls_wrappermode=yes"
postconf -P "smtps/inet/smtpd_sasl_auth_enable=yes"
postconf -P "smtps/inet/smtpd_recipient_restrictions=permit_sasl_authenticated,reject"

python3 - <<'PY'
from pathlib import Path

path = Path('/etc/dovecot/conf.d/10-ssl.conf')
text = path.read_text()
replacements = {
    'ssl =': 'ssl = required',
    'ssl_cert =': 'ssl_cert = </etc/letsencrypt/live/mail.mercadodovale.com.br/fullchain.pem',
    'ssl_key =': 'ssl_key = </etc/letsencrypt/live/mail.mercadodovale.com.br/privkey.pem',
}
lines = []
seen = {k: False for k in replacements}
for line in text.splitlines():
    stripped = line.strip()
    matched = False
    for key, value in replacements.items():
        if stripped.startswith(key):
            lines.append(value)
            seen[key] = True
            matched = True
            break
    if not matched:
        lines.append(line)
for key, value in replacements.items():
    if not seen[key]:
        lines.append(value)
path.write_text('\n'.join(lines) + '\n')
PY

systemctl restart dovecot
systemctl restart postfix
sleep 2

echo SERVICES
systemctl is-active dovecot postfix
echo PORTS
ss -ltnp | grep -E ':(25|465|587|993) ' || true
echo CERT
openssl x509 -in "$CERT_DIR/fullchain.pem" -noout -subject -issuer -dates
echo POSTFIX_TLS
postconf smtpd_tls_cert_file smtpd_tls_key_file
echo DOVECOT_TLS
doveconf -n | grep -E 'ssl_cert|ssl_key|ssl ='
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

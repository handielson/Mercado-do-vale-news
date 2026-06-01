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

python3 - <<'PY'
from pathlib import Path

path = Path('/etc/dovecot/conf.d/10-master.conf')
text = path.read_text()

listener = """  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
"""

active_socket = any(
    '/var/spool/postfix/private/auth' in line and not line.lstrip().startswith('#')
    for line in text.splitlines()
)

if not active_socket:
    text = text.replace(
        """  # Postfix smtp-auth
  #unix_listener /var/spool/postfix/private/auth {
  #  mode = 0666
  #}
""",
        """  # Postfix smtp-auth
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
""",
    )
    marker = 'service auth {'
    if '/var/spool/postfix/private/auth' not in text and marker in text:
        text = text.replace(marker, marker + '\n' + listener, 1)
    elif '/var/spool/postfix/private/auth' not in text:
        text += '\nservice auth {\n' + listener + '}\n'

path.write_text(text)

auth = Path('/etc/dovecot/conf.d/10-auth.conf')
auth_text = auth.read_text()
auth_lines = []
seen_auth_mechanisms = False
seen_auth_username_format = False
for line in auth_text.splitlines():
    if line.strip().startswith('auth_mechanisms'):
        auth_lines.append('auth_mechanisms = plain login')
        seen_auth_mechanisms = True
    elif line.strip().startswith('auth_username_format'):
        auth_lines.append('auth_username_format = %n')
        seen_auth_username_format = True
    else:
        auth_lines.append(line)
if not seen_auth_mechanisms:
    auth_lines.append('auth_mechanisms = plain login')
if not seen_auth_username_format:
    auth_lines.append('auth_username_format = %n')
auth.write_text('\n'.join(auth_lines) + '\n')
PY

postconf -e "smtpd_sasl_auth_enable = no"
postconf -e "smtpd_sasl_type = dovecot"
postconf -e "smtpd_sasl_path = private/auth"
postconf -P "submission/inet/smtpd_sasl_auth_enable=yes"
postconf -P "submission/inet/smtpd_recipient_restrictions=permit_sasl_authenticated,reject"

systemctl restart dovecot
systemctl restart postfix
sleep 2

echo SERVICES
systemctl is-active dovecot postfix
echo SOCKET
ls -la /var/spool/postfix/private/auth
echo POSTFIX
postconf smtpd_sasl_auth_enable smtpd_sasl_path
postconf -M submission/inet
echo DOVECOT
doveconf -n | grep -E 'auth_mechanisms|auth_username_format'
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

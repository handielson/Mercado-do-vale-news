const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const host = process.env.VPS_SITE_HOST || process.env.VPS_HOST;
const username = process.env.VPS_SITE_USER || process.env.VPS_USER || 'root';
const password = process.env.VPS_SITE_PASSWORD || process.env.VPS_ROOT_PASSWORD || process.env.VPS_PASSWORD;
const privateKeyPath = process.env.VPS_SITE_PRIVATE_KEY || process.env.VPS_PRIVATE_KEY;
const privateKey = privateKeyPath ? fs.readFileSync(privateKeyPath) : undefined;

const domain = process.env.MDV_MAIL_DOMAIN || 'mercadodovale.com.br';
const mailHost = process.env.MDV_MAIL_HOST || `mail.${domain}`;
const localUser = process.env.MDV_MAIL_LOCAL_USER || 'contato';
const forwardTo = process.env.MDV_MAIL_FORWARD_TO || 'handielson@gmail.com';
const mailboxPassword = process.env.MDV_MAILBOX_PASSWORD || crypto.randomBytes(18).toString('base64url');

if (!host || !username || (!password && !privateKey)) {
  throw new Error('Missing VPS SSH env vars');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function exec(conn, command, stdin = '') {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk.toString(); });
      stream.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      stream.on('close', (code) => {
        if (code && code !== 0) {
          reject(new Error(`${command} failed with code ${code}\n${stderr || stdout}`));
        } else {
          resolve({ stdout, stderr });
        }
      });
      if (stdin) stream.end(stdin);
    });
  });
}

const remoteScript = String.raw`
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

DOMAIN="$1"
MAIL_HOST="$2"
LOCAL_USER="$3"
FORWARD_TO="$4"
MAILBOX_PASSWORD="$5"

if [ "$(id -u)" != "0" ]; then
  echo "This setup must run as root" >&2
  exit 1
fi

echo "$MAIL_HOST" > /etc/mailname

apt-get update
apt-get install -y postfix dovecot-core dovecot-imapd dovecot-lmtpd opendkim opendkim-tools mailutils libsasl2-modules ca-certificates

postconf -e "myhostname = $MAIL_HOST"
postconf -e "mydomain = $DOMAIN"
postconf -e "myorigin = /etc/mailname"
postconf -e "mydestination = \$myhostname, localhost.\$mydomain, localhost, \$mydomain"
postconf -e "inet_interfaces = all"
postconf -e "inet_protocols = ipv4"
postconf -e "home_mailbox = Maildir/"
postconf -e "recipient_delimiter = +"
postconf -e "mynetworks = 127.0.0.0/8"
postconf -e "smtpd_relay_restrictions = permit_mynetworks permit_sasl_authenticated defer_unauth_destination"
postconf -e "smtpd_recipient_restrictions = permit_mynetworks permit_sasl_authenticated reject_unauth_destination"
postconf -e "smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem"
postconf -e "smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key"
postconf -e "smtpd_tls_security_level = may"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtpd_sasl_type = dovecot"
postconf -e "smtpd_sasl_path = private/auth"
postconf -e "smtpd_sasl_auth_enable = yes"
postconf -e "smtpd_sasl_security_options = noanonymous"
postconf -e "smtpd_sasl_local_domain = \$myhostname"
postconf -e "broken_sasl_auth_clients = yes"

postconf -M submission/inet="submission inet n - y - - smtpd"
postconf -P "submission/inet/syslog_name=postfix/submission"
postconf -P "submission/inet/smtpd_tls_security_level=encrypt"
postconf -P "submission/inet/smtpd_sasl_auth_enable=yes"
postconf -P "submission/inet/smtpd_recipient_restrictions=permit_sasl_authenticated,reject"

if ! id "$LOCAL_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$LOCAL_USER"
fi
printf '%s:%s\n' "$LOCAL_USER" "$MAILBOX_PASSWORD" | chpasswd
mkdir -p "/home/$LOCAL_USER/Maildir"
chown -R "$LOCAL_USER:$LOCAL_USER" "/home/$LOCAL_USER/Maildir"
chmod 700 "/home/$LOCAL_USER"

if grep -q "^$LOCAL_USER:" /etc/aliases; then
  sed -i "s|^$LOCAL_USER:.*|$LOCAL_USER: \\\\$LOCAL_USER, $FORWARD_TO|" /etc/aliases
else
  printf '\n%s: \\%s, %s\n' "$LOCAL_USER" "$LOCAL_USER" "$FORWARD_TO" >> /etc/aliases
fi
newaliases

cat >/etc/dovecot/conf.d/10-mail.conf <<'EOF'
mail_location = maildir:~/Maildir
namespace inbox {
  inbox = yes
}
EOF

cat >/etc/dovecot/conf.d/10-ssl.conf <<'EOF'
ssl = required
ssl_cert = </etc/ssl/certs/ssl-cert-snakeoil.pem
ssl_key = </etc/ssl/private/ssl-cert-snakeoil.key
EOF

python3 - <<'PY'
from pathlib import Path
path = Path('/etc/dovecot/conf.d/10-master.conf')
text = path.read_text()
block = """  # Postfix smtp-auth
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
"""
if '/var/spool/postfix/private/auth' not in text:
    marker = 'service auth {'
    text = text.replace(marker, marker + '\n' + block, 1)
path.write_text(text)
PY

mkdir -p "/etc/opendkim/keys/$DOMAIN"
if [ ! -f "/etc/opendkim/keys/$DOMAIN/default.private" ]; then
  opendkim-genkey -b 2048 -d "$DOMAIN" -D "/etc/opendkim/keys/$DOMAIN" -s default -v
fi
chown -R opendkim:opendkim "/etc/opendkim/keys/$DOMAIN"
chmod 600 "/etc/opendkim/keys/$DOMAIN/default.private"

cat >/etc/opendkim.conf <<EOF
Syslog                  yes
UMask                   002
Canonicalization        relaxed/simple
Mode                    sv
SubDomains              no
Socket                  local:/run/opendkim/opendkim.sock
PidFile                 /run/opendkim/opendkim.pid
OversignHeaders         From
TrustAnchorFile         /usr/share/dns/root.key
UserID                  opendkim
KeyTable                /etc/opendkim/key.table
SigningTable            refile:/etc/opendkim/signing.table
ExternalIgnoreList      /etc/opendkim/trusted.hosts
InternalHosts           /etc/opendkim/trusted.hosts
EOF

cat >/etc/opendkim/key.table <<EOF
default._domainkey.$DOMAIN $DOMAIN:default:/etc/opendkim/keys/$DOMAIN/default.private
EOF

cat >/etc/opendkim/signing.table <<EOF
*@$DOMAIN default._domainkey.$DOMAIN
EOF

cat >/etc/opendkim/trusted.hosts <<EOF
127.0.0.1
localhost
$DOMAIN
$MAIL_HOST
EOF

install -d -o opendkim -g opendkim /run/opendkim
usermod -aG opendkim postfix || true
postconf -e "milter_default_action = accept"
postconf -e "milter_protocol = 6"
postconf -e "smtpd_milters = local:/run/opendkim/opendkim.sock"
postconf -e "non_smtpd_milters = local:/run/opendkim/opendkim.sock"

systemctl enable postfix dovecot opendkim
systemctl restart opendkim
systemctl restart postfix
systemctl restart dovecot

DKIM_VALUE="$(tr -d '\n\t ' < "/etc/opendkim/keys/$DOMAIN/default.txt" | sed -E 's/^default\._domainkey[[:space:]]+IN[[:space:]]+TXT[[:space:]]+//; s/^"//; s/"$//; s/"//g')"

cat >/root/contato-mailbox-credentials.txt <<EOF
email=$LOCAL_USER@$DOMAIN
imap_host=$MAIL_HOST
imap_port=993
smtp_host=$MAIL_HOST
smtp_port=587
username=$LOCAL_USER
password=$MAILBOX_PASSWORD
forward_copy=$FORWARD_TO
created_at=$(date -Iseconds)
EOF
chmod 600 /root/contato-mailbox-credentials.txt

echo "MAILBOX_READY=$LOCAL_USER@$DOMAIN"
echo "FORWARD_COPY=$FORWARD_TO"
echo "CREDENTIALS_FILE=/root/contato-mailbox-credentials.txt"
echo "DNS_MX=@ 10 $MAIL_HOST"
echo "DNS_A=mail $PUBLIC_IPV4_PLACEHOLDER"
echo "DNS_SPF=v=spf1 mx ip4:$PUBLIC_IPV4_PLACEHOLDER ~all"
echo "DNS_DKIM_NAME=default._domainkey"
echo "DNS_DKIM_VALUE=$DKIM_VALUE"
echo "DNS_DMARC_NAME=_dmarc"
echo "DNS_DMARC_VALUE=v=DMARC1; p=quarantine; rua=mailto:$LOCAL_USER@$DOMAIN; adkim=s; aspf=s"
ss -ltnp | grep -E ':(25|587|993) ' || true
systemctl --no-pager --full status postfix dovecot opendkim | sed -n '1,80p'
`;

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host, port: 22, username, password, privateKey, readyTimeout: 20000 });
  });

  const script = remoteScript.replaceAll('$PUBLIC_IPV4_PLACEHOLDER', host);
  const args = [domain, mailHost, localUser, forwardTo, mailboxPassword].map(shellQuote).join(' ');
  const { stdout, stderr } = await exec(conn, `bash -s -- ${args}`, script);
  conn.end();

  console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

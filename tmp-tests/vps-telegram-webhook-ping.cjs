const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deploySource = fs.readFileSync(path.join(root, 'deploy.cjs'), 'utf8');
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || 'https://api.xiaomipetrolina.com.br/api/telegram-webhook';

function readConst(name) {
  const match = deploySource.match(new RegExp(`const ${name} = '([^']+)';`));
  if (!match) throw new Error(`Missing ${name} in deploy.cjs`);
  return match[1];
}

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) return resolve({ stdout, stderr });
        reject(new Error(stderr || stdout || `Command failed: ${command}`));
      });
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    });
  });
}

function remoteScript() {
  return `
require('dotenv').config({ path: '/var/www/mdv-api/.env', quiet: true });

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(name + ' missing');
  return value;
}

function getSupabaseRestBaseUrl() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\\/+$/, '');
  if (!url) throw new Error('SUPABASE_URL missing');
  return url + '/rest/v1';
}

function sanitizeTelegramPingResult(result) {
  return {
    ok: result.ok,
    webhook_status: result.webhook_status,
    webhook_body: result.webhook_body,
    used_configured_chat: result.used_configured_chat,
  };
}

(async () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!key) throw new Error('Supabase auth key missing');
  const response = await fetch(getSupabaseRestBaseUrl() + '/telegram_settings?select=active,chat_id&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' },
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error('telegram_settings fetch failed: ' + response.status);
  const settings = Array.isArray(rows) ? rows[0] : null;
  if (!settings?.active || !settings?.chat_id) throw new Error('Telegram settings inactive or chat_id missing');

  const secret = required('TELEGRAM_WEBHOOK_SECRET');
  const webhookResponse = await fetch('${WEBHOOK_URL}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': secret,
    },
    body: JSON.stringify({
      update_id: Date.now(),
      message: {
        message_id: Date.now() % 100000,
        date: Math.floor(Date.now() / 1000),
        chat: { id: settings.chat_id, type: 'private' },
        text: "/ping",
      },
    }),
  });
  const body = await webhookResponse.json().catch(() => null);
  console.log(JSON.stringify(sanitizeTelegramPingResult({
    ok: webhookResponse.ok && body?.ok === true,
    webhook_status: webhookResponse.status,
    webhook_body: body,
    used_configured_chat: true,
  }), null, 2));
})().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
`;
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({
        host: readConst('VpsHost'),
        port: 22,
        username: readConst('VpsUser'),
        password: readConst('VpsPass'),
        readyTimeout: 15000,
      });
  });

  const escaped = remoteScript().replace(/'/g, "'\\''");
  const result = await exec(conn, `cd /var/www/mdv-api && node -e '${escaped}'`);
  conn.end();
  process.stdout.write(result.stdout);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});

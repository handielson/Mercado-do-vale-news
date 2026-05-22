const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deploySource = fs.readFileSync(path.join(root, 'deploy.cjs'), 'utf8');
const targetWebhookUrl = process.env.TELEGRAM_TARGET_WEBHOOK_URL || 'https://api.xiaomipetrolina.com.br/api/telegram-webhook';

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

function sanitizeTelegramWebhookInfo(info) {
  const rawUrl = String(info?.url || '');
  let url = null;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      url = parsed.origin + parsed.pathname;
    } catch {
      url = '[unparseable-url]';
    }
  }
  return {
    url,
    has_custom_certificate: !!info?.has_custom_certificate,
    pending_update_count: Number(info?.pending_update_count || 0),
    last_error_date: info?.last_error_date || null,
    last_error_message: info?.last_error_message || null,
    max_connections: info?.max_connections || null,
    allowed_updates: Array.isArray(info?.allowed_updates) ? info.allowed_updates : [],
  };
}

async function telegram(method, token, payload) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(method + ' failed: ' + response.status + ' ' + JSON.stringify(data));
  }
  return data.result;
}

(async () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!key) throw new Error('Supabase auth key missing');
  const response = await fetch(getSupabaseRestBaseUrl() + '/telegram_settings?select=bot_token,active&limit=1', {
    headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' },
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error('telegram_settings fetch failed: ' + response.status);
  const settings = Array.isArray(rows) ? rows[0] : null;
  if (!settings?.active || !settings?.bot_token) throw new Error('Telegram settings inactive or token missing');

  const token = settings.bot_token;
  const secret = required('TELEGRAM_WEBHOOK_SECRET');
  const before = await telegram('getWebhookInfo', token);
  const setResult = await telegram('setWebhook', token, {
    url: '${targetWebhookUrl}',
    secret_token: secret,
    allowed_updates: ['message', 'edited_message'],
    drop_pending_updates: false,
  });
  const after = await telegram('getWebhookInfo', token);
  console.log(JSON.stringify({
    ok: true,
    target_url: '${targetWebhookUrl}',
    before: sanitizeTelegramWebhookInfo(before),
    setWebhook: !!setResult,
    after: sanitizeTelegramWebhookInfo(after),
  }, null, 2));
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

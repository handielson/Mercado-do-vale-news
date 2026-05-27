const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { readLegacyVpsConst: readConst } = require('./vps-ssh-config.cjs');

function exec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) return resolve({ stdout, stderr, code });
        reject(new Error(stderr || stdout || `Command failed: ${command}`));
      });
      stream.on('data', (data) => { stdout += data.toString(); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: readConst('VpsHost'),
      port: 22,
      username: readConst('VpsUser'),
      password: readConst('VpsPass'),
      readyTimeout: 45000,
    });
  });

  const remoteScript = `
set -eu
cd /var/www/mdv-api
node - <<'NODE'
require('dotenv').config({ path: '/var/www/mdv-api/.env', quiet: true });
const base = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\\/+$/, '') + '/rest/v1';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const select = 'select=id,name,sku,status,category_id,price_retail,price_reseller,price_wholesale,price_cost,stock_quantity,track_inventory,bling_id,bling_parent_id,parent_id';
(async () => {
  const res = await fetch(base + '/products?' + select, {
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Range-Unit': 'items',
      Range: '0-49',
      Prefer: 'count=exact'
    }
  });
  const text = await res.text();
  console.log(JSON.stringify({
    ok: res.ok,
    status: res.status,
    contentRange: res.headers.get('content-range') || '',
    bodyPreview: text.slice(0, 300).replace(/[A-Za-z0-9_-]{32,}/g, '[REDACTED]')
  }));
})().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
NODE
`;

  const result = await exec(conn, remoteScript);
  conn.end();
  const payload = JSON.parse(result.stdout);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});

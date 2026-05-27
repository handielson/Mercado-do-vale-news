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
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    });
  });
}

async function main() {
  const page = Number(process.env.SYNC_PRICES_PAGE || 0);
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
        readyTimeout: 45000,
      });
  });

  const remoteScript = `
set -eu
cd /var/www/mdv-api
curl -sS -X POST "http://127.0.0.1:4000/api/bling?resource=sync-prices-vps&page=${page}&dryRun=true"
`;

  const result = await exec(conn, remoteScript);
  conn.end();

  const payload = JSON.parse(result.stdout);
  if (!payload?.ok || payload?.dryRun !== true) {
    throw new Error(`Unexpected sync-prices dry-run response: ${JSON.stringify({
      ok: payload?.ok,
      dryRun: payload?.dryRun,
      error: payload?.error,
    })}`);
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    wouldSync: payload.wouldSync,
    page: payload.page,
    total: payload.total,
    hasMore: payload.hasMore,
    nextPage: payload.nextPage,
    sample: payload.sample,
    note: 'Dry-run only. No /products/batch write is executed and no price, stock, SKU, or secrets are printed.',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});

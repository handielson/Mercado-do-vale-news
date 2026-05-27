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
if [ -f /var/www/mdv-api/.env ]; then
  set -a
  . /var/www/mdv-api/.env
  set +a
fi
if [ -z "\${CRON_SECRET:-}" ]; then
  echo '{"ok":false,"error":"CRON_SECRET missing"}'
  exit 0
fi
http_code="$(curl -sS \\
  -o /tmp/mdv-bling-reconcile-dry-run.json \\
  -w '%{http_code}' \\
  -H "Authorization: Bearer \${CRON_SECRET}" \\
  "http://127.0.0.1:4000/api/bling?resource=reconcile&dryRun=true")"
printf '{"httpCode":%s,"body":' "$http_code"
cat /tmp/mdv-bling-reconcile-dry-run.json
printf '}'
`;

  const result = await exec(conn, remoteScript);
  conn.end();

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(`Invalid JSON from dry-run reconcile: ${err.message}`);
  }

  const body = payload.body || {};

  if (!body || body.ok !== true || body.dryRun !== true) {
    throw new Error(`Unexpected dry-run response: ${JSON.stringify({
      httpCode: payload?.httpCode,
      ok: body?.ok,
      dryRun: body?.dryRun,
      error: body?.error,
      debug: body?.debug ? {
        operation: body.debug.operation,
        step: body.debug.step,
        rawMessage: body.debug.rawMessage,
      } : undefined,
    })}`);
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    planned: {
      stockChanges: Number(body.planned?.stockChanges || 0),
      nameChanges: Number(body.planned?.nameChanges || 0),
    },
    totals: body.totals || null,
    note: 'Dry-run only. No stock/name changes are applied and no secret values are printed.',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});

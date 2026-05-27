const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { readLegacyVpsConst: readConst } = require('./vps-ssh-config.cjs');
const outputPath = path.join(root, 'tmp-tests', 'vps-bling-reconcile-dry-run-details-output.json');


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
curl -sS \\
  -H "Authorization: Bearer \${CRON_SECRET}" \\
  "http://127.0.0.1:4000/api/bling?resource=reconcile&dryRun=true&details=true"
`;

  const result = await exec(conn, remoteScript);
  conn.end();

  const payload = JSON.parse(result.stdout);
  if (!payload || payload.ok !== true || payload.dryRun !== true || !payload.details) {
    throw new Error(`Unexpected dry-run details response: ${JSON.stringify({
      ok: payload?.ok,
      dryRun: payload?.dryRun,
      error: payload?.error,
    })}`);
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    planned: payload.planned,
    totals: payload.totals,
    details: {
      stockChanges: payload.details.stockChanges?.length || 0,
      nameChanges: payload.details.nameChanges?.length || 0,
    },
    output: outputPath,
    note: 'Details saved locally for review. No secret values are printed.',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});

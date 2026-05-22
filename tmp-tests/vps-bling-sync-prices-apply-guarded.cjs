const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deploySource = fs.readFileSync(path.join(root, 'deploy.cjs'), 'utf8');

const APPLY = process.env.DRY_RUN === 'false' && process.env.CONFIRM_BLING_SYNC_PRICES_APPLY === 'I_UNDERSTAND_BLING_SYNC_PRICES_APPLY';
const page = Number(process.env.SYNC_PRICES_PAGE || 0);

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
        if (code === 0) return resolve({ stdout, stderr, code });
        reject(new Error(stderr || stdout || `Command failed: ${command}`));
      });
      stream.on('data', (data) => { stdout += data.toString(); });
      stream.stderr.on('data', (data) => { stderr += data.toString(); });
    });
  });
}

async function main() {
  if (!APPLY) {
    console.log(JSON.stringify({
      ok: true,
      applied: false,
      reason: 'dry_run_enabled',
      page,
      required: {
        DRY_RUN: 'false',
        CONFIRM_BLING_SYNC_PRICES_APPLY: 'I_UNDERSTAND_BLING_SYNC_PRICES_APPLY',
      },
      note: 'No sync-prices-vps batch write was executed.',
    }, null, 2));
    return;
  }

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
curl -sS -X POST "http://127.0.0.1:4000/api/bling?resource=sync-prices-vps&page=${page}"
`;

  const result = await exec(conn, remoteScript);
  conn.end();

  const payload = JSON.parse(result.stdout);
  console.log(JSON.stringify({
    ok: payload?.ok === true,
    applied: true,
    error: payload?.error || null,
    synced: payload?.synced ?? null,
    page: payload?.page ?? page,
    total: payload?.total ?? null,
    hasMore: payload?.hasMore ?? null,
    nextPage: payload?.nextPage ?? null,
    vpsStatus: payload?.vpsStatus ?? null,
    debug: payload?.debug ? {
      operation: payload.debug.operation,
      step: payload.debug.step,
      page: payload.debug.page,
      from: payload.debug.from,
      to: payload.debug.to,
      rawMessage: payload.debug.rawMessage,
    } : null,
    note: 'Apply mode prints only counts and pagination metadata.',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});

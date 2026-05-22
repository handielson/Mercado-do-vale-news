const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const deploySource = fs.readFileSync(path.join(root, 'deploy.cjs'), 'utf8');
const detailsPath = path.join(root, 'tmp-tests', 'vps-bling-reconcile-dry-run-details-output.json');

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
      stream.on('data', (data) => {
        stdout += data.toString();
      });
      stream.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    });
  });
}

function pickBlingId() {
  const details = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
  const candidate = details?.details?.stockChanges?.[0] || details?.details?.nameChanges?.[0];
  if (!candidate?.blingId) throw new Error('No Bling ID found in reconcile details output');
  return candidate.blingId;
}

function countItems(value) {
  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value?.data)) return value.data.length;
  if (value?.data && typeof value.data === 'object') return 1;
  return value && typeof value === 'object' ? 1 : 0;
}

async function main() {
  const blingId = pickBlingId();
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
curl -sS "http://127.0.0.1:4000/api/bling?resource=debug-product&blingId=${blingId}"
printf '\\n---MDV_SPLIT---\\n'
curl -sS "http://127.0.0.1:4000/api/bling?resource=debug-diagnostic&blingId=${blingId}"
`;

  const result = await exec(conn, remoteScript);
  conn.end();

  const [debugProductRaw, debugDiagnosticRaw] = result.stdout.split('\n---MDV_SPLIT---\n');
  const debugProduct = JSON.parse(debugProductRaw);
  const debugDiagnostic = JSON.parse(debugDiagnosticRaw);

  if (debugProduct?.error || debugDiagnostic?.error) {
    throw new Error(`Diagnostic read failed: ${JSON.stringify({
      debugProductError: debugProduct?.error,
      debugDiagnosticError: debugDiagnostic?.error,
    })}`);
  }

  console.log(JSON.stringify({
    ok: true,
    checked: {
      debugProduct: {
        hasData: !!debugProduct?.data,
        dataKeys: Object.keys(debugProduct?.data || {}).sort().slice(0, 20),
      },
      debugDiagnostic: {
        stockStatus: debugDiagnostic.stockStatus,
        productStatus: debugDiagnostic.productStatus,
        stockItems: countItems(debugDiagnostic.stock),
        productItems: countItems(debugDiagnostic.product),
      },
    },
    note: 'Output is sanitized: no product names, SKUs, stock quantities, tokens, or raw bodies are printed.',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});

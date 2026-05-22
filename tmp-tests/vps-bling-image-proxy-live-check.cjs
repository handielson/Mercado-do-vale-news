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

function pickBlingIds() {
  const details = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
  const items = [
    ...(details?.details?.stockChanges || []),
    ...(details?.details?.nameChanges || []),
  ];
  return [...new Set(items.map((item) => item.blingId).filter(Boolean))].slice(0, 20);
}

async function main() {
  const blingIds = pickBlingIds();
  if (blingIds.length === 0) throw new Error('No Bling IDs available for image proxy validation');

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
node - <<'NODE'
const ids = ${JSON.stringify(blingIds)};

function findImageUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    if (/^https:\\/\\//i.test(value) && /\\.(jpe?g|png|webp|gif)(\\?|$)/i.test(value)) return value;
    return '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageUrl(item);
      if (found) return found;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = findImageUrl(item);
      if (found) return found;
    }
  }
  return '';
}

(async () => {
  for (const id of ids) {
    const productRes = await fetch(\`http://127.0.0.1:4000/api/bling?resource=debug-product&blingId=\${encodeURIComponent(id)}\`);
    const productJson = await productRes.json();
    const imageUrl = findImageUrl(productJson);
    if (!imageUrl) continue;
    const proxyRes = await fetch(\`http://127.0.0.1:4000/api/bling?resource=image-proxy&url=\${encodeURIComponent(imageUrl)}\`);
    const buf = Buffer.from(await proxyRes.arrayBuffer());
    console.log(JSON.stringify({
      ok: proxyRes.ok,
      status: proxyRes.status,
      contentType: proxyRes.headers.get('content-type') || '',
      bytes: buf.length,
      triedProducts: ids.indexOf(id) + 1,
      foundImage: true
    }));
    return;
  }
  console.log(JSON.stringify({ ok: false, foundImage: false, triedProducts: ids.length }));
})().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
NODE
`;

  const result = await exec(conn, remoteScript);
  conn.end();

  const payload = JSON.parse(result.stdout);
  if (!payload.ok || !payload.foundImage) {
    throw new Error(`Image proxy validation failed: ${JSON.stringify({
      ok: payload.ok,
      status: payload.status,
      foundImage: payload.foundImage,
      triedProducts: payload.triedProducts,
      error: payload.error,
    })}`);
  }

  console.log(JSON.stringify({
    ok: true,
    status: payload.status,
    contentType: payload.contentType,
    bytes: payload.bytes,
    triedProducts: payload.triedProducts,
    note: 'Output is sanitized: image URL, product name, SKU, stock, tokens, and raw product bodies are not printed.',
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const RANGES = [
  ["fastify.get('/products',", "fastify.get('/products/by-ids',"],
  ['async function upsertStockLocationBalance(', 'function mapStockDeposit('],
  ['async function syncSerializedProductStockFromUnits(', '// ─── Recibos Avulsos'],
];
function block(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`Missing deployment anchor: ${start}`);
  return source.slice(a, b);
}
function patch(source, baseline, current) {
  let result = source.replace(/\r\n/g, '\n');
  for (const [start, end] of RANGES) {
    const old = block(baseline, start, end), next = block(current, start, end);
    const remote = block(result, start, end);
    if (remote !== old && remote !== next) throw new Error(`Remote drift: ${start}`);
    result = result.replace(remote, next);
  }
  const start = "fastify.post('/sales/finalize-serialized',";
  const end = "fastify.post('/table-data/:name',";
  const route = block(current, start, end);
  if (result.includes(start)) {
    if (block(result, start, end) !== route) throw new Error('Remote sale route differs');
  } else {
    if (!result.includes(end)) throw new Error('Missing table route');
    result = result.replace(end, route + end);
  }
  return source.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result;
}
async function deployCatalogSaleAtomic(options) {
  const root = options.root;
  const baseline = execFileSync('git', ['show', 'd1f7e3b3aa0d6c8ce58a58a8515c76cdcd6e3165:vps_server.cjs'], { cwd: root, encoding: 'utf8', maxBuffer: 12e6 }).replace(/\r\n/g, '\n');
  const current = fs.readFileSync(path.join(root, 'vps_server.cjs'), 'utf8').replace(/\r\n/g, '\n');
  // Reuse backup, optimistic recheck, syntax staging and rollback from the privacy publisher.
  const helper = fs.readFileSync(path.join(__dirname, 'deploy-product-read-privacy.cjs'), 'utf8')
    .replace("const MODULE = 'services/productReadPrivacy.cjs';", "const MODULE = 'services/serializedSaleFinalization.cjs';")
    .replace('patchProductReadPrivacy(original)', 'patchScoped(original)')
    .replaceAll('product-read-privacy-', 'catalog-sale-atomic-')
    .replace('Product read privacy backup:', 'Catalog/sale atomic backup:');
  const moduleScope = { exports: {} };
  new Function('require', 'module', 'patchScoped', helper)(require, moduleScope, source => patch(source, baseline, current));
  await moduleScope.exports.deployProductReadPrivacy(options);
}
module.exports = { patch, deployCatalogSaleAtomic };

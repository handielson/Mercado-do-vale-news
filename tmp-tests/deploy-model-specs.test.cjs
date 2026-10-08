const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { BASELINE, ENTRIES, ANCHORS, block, patch, patchBotProjection } = require('../scripts/deploy-model-specs.cjs');
const { deployProductReadPrivacy } = require('../scripts/deploy-product-read-privacy.cjs');
test('selective model specs deployment preserves remote unrelated code and is idempotent', () => {
  for (const file of ENTRIES) {
    const old = execFileSync('git', ['show', `${BASELINE}:${file}`], { encoding: 'utf8', maxBuffer: 15e6 });
    const spec = ANCHORS.find(([anchor]) => !anchor.includes('Autoresponder') && old.includes(anchor));
    const previousBlock = block(old.replace(/\r\n/g, '\n'), spec);
    const nextBlock = previousBlock.replace('\n', '\n  // model projection\n');
    const next = old.replace(/\r\n/g, '\n').replace(previousBlock, nextBlock);
    const remote = old.replace(/\r\n/g, '\n') + '\n// unrelated remote change\n';
    const result = patch(remote, old, next);
    assert.ok(result.endsWith('// unrelated remote change\n'));
    assert.ok(result.includes('// model projection'));
    assert.equal(patch(result, old, next), result);
    assert.throws(() => patch(remote.replace(previousBlock, previousBlock.replace('\n', '\n  // unexpected drift\n')), old, next), /Remote entry drift/);
  }
});
test('bot projection updates only terminal return and preserves remote SQL additions', () => {
  const baseline = "async function findAutoresponderProductsByTag(id) {\n  const [rows] = await pool.query('SELECT id FROM products');\n  return rows;\n}\n";
  const projected = baseline.replace('  return rows;', "  const { applyModelSpecsToProducts } = await import('./services/smartphoneModelSpecs.mjs');\n  return applyModelSpecsToProducts(pool, rows);");
  const remote = baseline.replace('SELECT id', 'SELECT id, model_blueprint, warranty_days');
  const result = patchBotProjection(remote, baseline, projected);
  assert.ok(result.includes('SELECT id, model_blueprint, warranty_days'));
  assert.ok(result.includes('return applyModelSpecsToProducts(pool, rows)'));
  assert.equal(patchBotProjection(result, baseline, projected), result);
  assert.throws(() => patchBotProjection(remote.replace('return rows;', 'return rows.filter(Boolean);'), baseline, projected), /return drift/);
  assert.throws(() => patchBotProjection(remote, baseline, projected.replace('SELECT id', 'SELECT *')), /Unexpected local bot changes/);
});
test('canonical token query patch keeps remote blueprint SQL and rejects unknown search expressions', () => {
  const old = execFileSync('git', ['show', `${BASELINE}:vps_server.cjs`], { encoding: 'utf8', maxBuffer: 15e6 }).replace(/\r\n/g, '\n');
  const current = fs.readFileSync('vps_server.cjs', 'utf8').replace(/\r\n/g, '\n');
  const tokens = ['async function findAutoresponderProductsByTokens(', '\n}\n'];
  const original = block(old, tokens);
  const remoteBlock = original.replace('SELECT id, model_id', 'SELECT id, model_blueprint, model_id');
  const remote = old.replace(original, remoteBlock);
  const result = patch(remote, old, current);
  assert.ok(block(result, tokens).includes('SELECT id, model_blueprint, model_id'));
  assert.ok(block(result, tokens).includes('COALESCE(${searchColumns.specs}'));
  assert.equal(patch(result, old, current), result);
  assert.throws(() => patch(remote.replace(remoteBlock, remoteBlock.replace('CAST(specs AS CHAR)', 'JSON_EXTRACT(specs,\'$\')')), old, current), /search anchor drift/);
});
test('rejects local changes outside approved function and routes', () => {
  const old = execFileSync('git', ['show', `${BASELINE}:vps_server.cjs`], { encoding: 'utf8', maxBuffer: 15e6 });
  assert.throws(() => patch(old, old, old + '\n// unsupported local change\n'), /Unaccounted/);
});
test('all routes have unique baseline anchors and complete closing boundaries', () => {
  const old = execFileSync('git', ['show', `${BASELINE}:vps_server.cjs`], { encoding: 'utf8', maxBuffer: 15e6 }).replace(/\r\n/g, '\n');
  for (const spec of ANCHORS) assert.ok(block(old, spec).startsWith(spec[0]));
});
test('model projection boundary is inserted once before the privacy filter', () => {
  const old = execFileSync('git', ['show', `${BASELINE}:server.js`], { encoding: 'utf8', maxBuffer: 15e6 }).replace(/\r\n/g, '\n');
  const anchor = "require('./services/productReadPrivacy.cjs').registerProductReadPrivacy(fastify, {";
  const hook = "require('./services/smartphoneModelSpecsBoundary.cjs').registerSmartphoneModelSpecsBoundary(fastify, { db: pool });\n\n";
  const next = old.replace(anchor, hook + anchor);
  const result = patch(old, old, next);
  assert.equal(result, next);
  assert.equal(patch(result, old, next), result);
});
test('shared publisher checks ES modules as mjs and creates script directories', async () => {
  const commands = [], state = new Map();
  await deployProductReadPrivacy({ appDir: '/var/www/mdv-api', apiProc: { name: 'mdv-api', pm2_env: { pm_exec_path: '/var/www/mdv-api/server.js' } },
    files: ['services/specs.mjs', 'scripts/migrate.cjs'], backupPrefix: 'model-specs-test', patchFile: () => 'export const value = 1;',
    read: async file => state.get(file) || '', write: async (file, content) => state.set(file, content), exec: async command => { commands.push(command); } });
  assert.ok(commands.some(command => command.includes('/scripts') && command.startsWith('mkdir -p')));
  assert.ok(commands.includes('node --check /var/www/mdv-api/services/specs.mjs.release-check.mjs'));
  assert.ok(commands.includes('node --check /var/www/mdv-api/scripts/migrate.cjs.release-check.cjs'));
});

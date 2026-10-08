const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { patch } = require('../scripts/deploy-catalog-sale-atomic.cjs');
test('selective deployment is idempotent, preserves unrelated code and refuses drift', () => {
  const base = execFileSync('git', ['show', 'd1f7e3b3aa0d6c8ce58a58a8515c76cdcd6e3165:vps_server.cjs'], { encoding: 'utf8', maxBuffer: 12e6 }).replace(/\r\n/g, '\n');
  const next = fs.readFileSync('vps_server.cjs', 'utf8').replace(/\r\n/g, '\n');
  const remote = '// preserved remote customization\n' + base;
  const result = patch(remote, base, next);
  assert.ok(result.startsWith('// preserved remote customization\n'));
  assert.ok(result.includes("fastify.post('/sales/finalize-serialized',"));
  // Esse publicador nao deve carregar mudancas posteriores de devolucao de estoque.
  const restore = source => source.slice(source.indexOf('async function restoreStockFromMovements('),
    source.indexOf("fastify.post('/stock-locations/sale-restores'"));
  assert.equal(restore(result), restore(base));
  assert.equal(patch(result, base, next), result);
  assert.throws(() => patch(remote.replace('async function upsertStockLocationBalance(', 'async function upsertStockLocationBalance(/* drift */ '), base, next), /Remote drift/);
});

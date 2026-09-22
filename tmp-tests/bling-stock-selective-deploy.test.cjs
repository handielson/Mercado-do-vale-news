const assert = require('node:assert/strict');
const { patch } = require('../scripts/deploy-bling-stock-reconcile.cjs');
const before = [
  'async function applyReconcileStockChangesVps() {\nreturn 1;\n}',
  'async function syncShopeeStockFromBlingTargetsVps() {\nreturn 1;\n}',
  "if (resource === 'reconcile') { return 1; }\nif (resource === 'serial-sales-sync') {}",
].join('\n');
const after = before.replaceAll('return 1;', 'return 2;');
const remote = before + '\n// unrelated production hotfix';
const output = patch(remote, before, after);
assert.equal(output, after + '\n// unrelated production hotfix');
assert.equal(patch(output, before, after), output);
assert.throws(() => patch(remote.replace('return 1;', 'return 3;'), before, after), /differs/);
assert.throws(() => patch('', before, after), /differs/);
console.log('Selective deploy preserves unrelated code, is idempotent and rejects drift');

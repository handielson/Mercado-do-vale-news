const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), { execFileSync } = require('node:child_process');
const { patch } = require('../scripts/deploy-stock-restoration-family.cjs');
const { deployProductReadPrivacy } = require('../scripts/deploy-product-read-privacy.cjs');
test('selective stock patch preserves other remote changes and rejects drift', () => {
  for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
    const old = execFileSync('git', ['show', `a6c3ab3c6973c8cc8fe749190c66c518c689fcde:${file}`], { encoding: 'utf8', maxBuffer: 12e6 });
    const current = fs.readFileSync(file, 'utf8');
    const result = patch(old + '\n// remote unrelated\n', old, current);
    assert.ok(result.endsWith('// remote unrelated\n'));
    assert.equal(patch(result, old, current), result);
    assert.ok(result.includes("require('./services/stockMovementRestoration.cjs')"));
    assert.throws(() => patch(old.replace('async function getStockLocationRow(', 'async function modifiedStockLocationRow('), old, current), /Ambiguous/);
  }
});
test('shared publisher restores originals and removes new module after promotion failure', async () => {
  const root = '/var/www/mdv-api';
  const state = new Map([[root + '/server.js', 'old-entry']]);
  let failed = false;
  await assert.rejects(deployProductReadPrivacy({ appDir: root,
    apiProc: { name: 'mdv-api', pm2_env: { pm_exec_path: root + '/server.js' } },
    files: ['services/new.cjs', 'server.js'], patchFile: () => 'new-content', backupPrefix: 'test',
    read: async file => state.get(file) || '', write: async (file, content) => state.set(file, content),
    exec: async cmd => {
      if (cmd.startsWith('mv ')) { const [, from, to] = cmd.split(' '); state.set(to, state.get(from)); state.delete(from); }
      if (cmd.startsWith('rm -f ')) state.delete(cmd.slice(6));
      if (cmd === 'pm2 restart mdv-api' && !failed) { failed = true; throw Error('restart failed'); }
    },
  }), /restart failed/);
  assert.equal(state.get(root + '/server.js'), 'old-entry');
  assert.equal(state.has(root + '/services/new.cjs'), false);
});

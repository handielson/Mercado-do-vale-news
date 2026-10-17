'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { BASELINE, ENTRIES, patch, MODULE } = require('../scripts/deploy-shopee-filelink.cjs');
for (const file of ENTRIES) {
  const baseline = execFileSync('git', ['show', `${BASELINE}:${file}`], { encoding: 'utf8', maxBuffer: 15e6 });
  const current = fs.readFileSync(file, 'utf8');
  test(`${file}: patches only approved blocks and preserves remote additions`, () => {
    const remote = baseline + '\n// REMOTE CUSTOMIZATION\n';
    const result = patch(remote, baseline, current);
    assert.equal(result.replace(/\r\n/g, '\n'), (current + '\n// REMOTE CUSTOMIZATION\n').replace(/\r\n/g, '\n'));
    assert.equal(patch(result, baseline, current), result);
  });
  test(`${file}: rejects drift in the shipping block`, () => {
    assert.throws(() => patch(baseline.replace("payload.shipping_document_type || 'NORMAL_AIR_WAYBILL'", "'OTHER_TYPE'"), baseline, current), /drift/);
  });
  test(`${file}: rejects unrelated local entry changes`, () => {
    assert.throws(() => patch(baseline, baseline, current + '\n// unrelated local change\n'), /Unaccounted/);
  });
}
test('canonical deploy command includes the module and read-only preflight', () => {
  const cli = fs.readFileSync('deploy-vps-server-only.cjs', 'utf8');
  assert.match(cli, /--shopee-filelink-only/);
  assert.match(cli, /checkOnly: process.argv.includes\('--shopee-filelink-check'\)/);
  assert.equal(MODULE, 'services/shopeeShippingDocumentJob.cjs');
});
test('publication plan selects the scoped API deploy before site', () => {
  const output = execFileSync(process.execPath, ['scripts/publish-vps-plan.cjs', '--json', '--mock-files',
    'scripts/deploy-shopee-filelink.cjs,services/shopeeShippingDocumentJob.cjs,vps_server.js,public/VERSION.json'], { encoding: 'utf8' });
  const plan = JSON.parse(output);
  assert.equal(plan.deployCommands[0], 'node deploy-vps-server-only.cjs --shopee-filelink-only');
  assert.ok(plan.validations.includes('node deploy-vps-server-only.cjs --shopee-filelink-check'));
});

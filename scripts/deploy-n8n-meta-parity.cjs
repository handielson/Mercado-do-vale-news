'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const base = require('./deploy-n8n-meta-attendance.cjs');
const {patchWorkflow} = require('./build-n8n-meta-parity.cjs');
const {NORMALIZE} = require('./build-n8n-meta-attendance.cjs');
const {patchMetaNormalizerCode, validateMetaPayjoyWorkflow} = require('./n8n-meta-payjoy-images.cjs');

function createPlan(snapshot) {
  base.assertAligned(snapshot);
  const credentials = snapshot.credentials.filter(c => c.name === base.CREDENTIAL_NAME && c.type === 'httpHeaderAuth');
  assert.equal(credentials.length, 1, 'Existing Meta credential required');
  const credential = credentials[0];
  const candidate = patchWorkflow(snapshot.workflow);
  validateMetaPayjoyWorkflow(candidate);
  base.validateGraph(candidate, credential.id, {normalizeCode:patchMetaNormalizerCode(NORMALIZE)});
  return {candidate, credential:{id:credential.id,name:credential.name,type:credential.type},
    beforeSha256:base.fingerprint(snapshot.workflow), afterSha256:base.fingerprint(candidate),
    alreadyApplied:base.fingerprint(snapshot.workflow) === base.fingerprint(candidate)};
}

function runValidation(snapshot, plan) {
  const root = path.resolve(__dirname, '..');
  const directory = path.join(root, '.local');
  fs.mkdirSync(directory, {recursive:true});
  const sourcePath = path.join(directory, 'meta-parity-live-source.private.json');
  const targetPath = path.join(directory, 'meta-parity-live-candidate.private.json');
  fs.writeFileSync(sourcePath, JSON.stringify(snapshot.workflow), {mode:0o600});
  fs.writeFileSync(targetPath, JSON.stringify(plan.candidate), {mode:0o600});
  const validations = [
    ['scripts/n8n-sales-regression-gate.cjs', '--snapshot', targetPath],
    ['--test', 'tmp-tests/n8n-meta-parity-composition.test.cjs',
      'tmp-tests/n8n-meta-catalog-intent-parity.test.cjs',
      'tmp-tests/n8n-meta-multibrand-promos.test.cjs',
      'tmp-tests/n8n-meta-sales-parity.test.cjs',
      'tmp-tests/meta-attendance-core.test.cjs',
      'tmp-tests/meta-attendance-replies.test.cjs',
      'tmp-tests/meta-attendance-routes.test.cjs',
      'tmp-tests/meta-attendance-transport.test.cjs'],
  ];
  for (const [index, args] of validations.entries()) {
    const result = spawnSync(process.execPath, args, {cwd:root, encoding:'utf8', maxBuffer:16*1024*1024,
      env:{...process.env, MDV_PAYJOY_WORKFLOW_SNAPSHOT:sourcePath,
        N8N_WORKFLOW_FIXTURE:sourcePath}});
    fs.writeFileSync(path.join(directory, `meta-parity-validation-${index}.log`),
      result.stdout + result.stderr, {mode:0o600});
    assert.equal(result.status, 0, `Meta parity validation ${index} failed; inspect private log`);
  }
  assert.equal(base.fingerprint(JSON.parse(fs.readFileSync(targetPath, 'utf8'))), plan.afterSha256,
    'Validated candidate changed');
  return {validated:true, sourcePath, targetPath, validationGroups:validations.length};
}

async function main() {
  const args = process.argv.slice(2);
  assert.ok(args.length <= 1 && args.every(value => value === '--apply'), 'Only --apply is supported');
  const {Client} = require('ssh2');
  const {getVpsSshConfig} = require('../tmp-tests/vps-ssh-config.cjs');
  const connection = new Client();
  await new Promise((resolve, reject) => connection.once('ready', resolve)
    .once('error', () => reject(Error('SSH unavailable'))).connect(getVpsSshConfig()));
  try {
    console.log(JSON.stringify(await base.deploy({apply:args.includes('--apply'),
      remote:request => base.callRemote(connection, request), buildPlan:createPlan,
      validate:runValidation}), null, 2));
  } finally { connection.end(); }
}

module.exports = {createPlan, runValidation};
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({message:error.message, ...error.report}));
  process.exitCode = 1;
});

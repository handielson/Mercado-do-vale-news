'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('ssh2');
const base = require('./deploy-n8n-meta-attendance.cjs');
const { patchWorkflow, SCOPED_NODES, MARKER } = require('../tmp-tests/n8n-payjoy-spaced-context-patch.cjs');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');

function plan(snapshot, baseline) {
  base.assertAligned(snapshot);
  assert.equal(snapshot.workflow.activeVersionId, baseline.versionId, 'Active version changed since review');
  assert.equal(base.fingerprint(snapshot.workflow), base.fingerprint(baseline), 'Workflow changed since review');
  const candidate = patchWorkflow(snapshot.workflow);
  const changed = candidate.nodes.filter((node, index) => JSON.stringify(node) !== JSON.stringify(snapshot.workflow.nodes[index])).map(node => node.name);
  assert.deepEqual(changed.sort(), [...SCOPED_NODES].sort(), 'Unexpected workflow scope');
  assert.deepEqual(candidate.connections, snapshot.workflow.connections);
  for (const name of SCOPED_NODES) assert.ok(candidate.nodes.find(node => node.name === name).parameters.jsCode.includes(MARKER));
  return {
    candidate,
    beforeSha256: base.fingerprint(snapshot.workflow),
    afterSha256: base.fingerprint(candidate),
    alreadyApplied: false,
    credential: null,
  };
}

function validate(snapshot, candidatePlan) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-payjoy-spaced-context-'));
  const candidatePath = path.join(tempDir, 'candidate.private.json');
  fs.writeFileSync(candidatePath, JSON.stringify(candidatePlan.candidate), { mode: 0o600 });
  try {
    const env = { ...process.env, MDV_PAYJOY_WORKFLOW_SNAPSHOT: candidatePath };
    const checks = [
      [process.execPath, ['--test', 'tmp-tests/n8n-payjoy-spaced-context.test.cjs', 'tmp-tests/n8n-payjoy-knowledge.test.cjs', 'tmp-tests/n8n-payjoy-link-continuity.test.cjs']],
      [process.execPath, ['scripts/n8n-sales-regression-gate.cjs', '--snapshot', candidatePath]],
    ];
    for (const [command, args] of checks) {
      const result = spawnSync(command, args, { cwd: path.resolve(__dirname, '..'), env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      assert.equal(result.status, 0, `Candidate validation failed: ${args[0]}\n${String(result.stdout || result.stderr).slice(-2500)}`);
    }
    assert.equal(base.fingerprint(JSON.parse(fs.readFileSync(candidatePath, 'utf8'))), candidatePlan.afterSha256);
    return { focusedTests: 21, commercialGate: true };
  } finally {
    fs.unlinkSync(candidatePath);
    fs.rmdirSync(tempDir);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const baselineIndex = args.indexOf('--baseline');
  assert.ok(baselineIndex >= 0 && args[baselineIndex + 1], '--baseline <read-only snapshot> required');
  assert.ok(args.every((arg, index) => arg === '--apply' || arg === '--baseline' || index === baselineIndex + 1), 'Unexpected argument');
  const baseline = JSON.parse(fs.readFileSync(path.resolve(args[baselineIndex + 1]), 'utf8'));
  const connection = new Client();
  await new Promise((resolve, reject) => connection.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const result = await base.deploy({
      apply: args.includes('--apply'),
      remote: request => base.callRemote(connection, request),
      buildPlan: snapshot => plan(snapshot, baseline),
      validate,
    });
    console.log(JSON.stringify({ ...result, marker: MARKER, scopedNodes: SCOPED_NODES, customerMessagesSent: 0 }));
  } finally {
    connection.end();
  }
}

if (require.main === module) main().catch(error => { console.error(JSON.stringify({ message: error.message, ...error.report })); process.exitCode = 1; });
module.exports = { plan, validate };

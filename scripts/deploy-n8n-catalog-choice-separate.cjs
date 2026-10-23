'use strict';

// Publishes only the tested catalog question split. Dry run by default.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');
const { patchDirectCatalogPrompt, DIRECT, DIRECT_CODE } = require('../tmp-tests/n8n-sales-catalog-timeout-guard.cjs');
const { WORKFLOW_ID, MAIN, RUNNER, fingerprint, assertAligned, casSql, callRemote, waitFor } = require('./deploy-n8n-meta-attendance.cjs');

const EXPECTED_BEFORE = '7548b2132fa3581654f9b26859cfccaa8be9d2891f713b248f0d0d43afc161df';
const EXPECTED_AFTER = '1783eccda0912ecd8e6e29c74e496e0d81a2759cdff10b005df4ba813dd390ed';
const connection = new Client();
const remote = request => callRemote(connection, request);
const scale = async (service, replicas) => {
  await remote({ mode: 'scale', service, replicas });
  await waitFor(async () => {
    const status = await remote({ mode: 'replicas', service });
    return status.desired === replicas && status.running === replicas;
  }, service);
};
const start = async () => {
  await scale(MAIN, 1);
  await waitFor(async () => (await remote({ mode: 'ready' })).status === 200, 'n8n health');
  await scale(RUNNER, 1);
};

async function main() {
  const apply = process.argv.slice(2).join(' ') === '--apply';
  assert.ok(process.argv.length === 2 || apply, 'Only --apply is supported');
  await new Promise((resolve, reject) => connection.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  let stopped = false, changed = false, before, after, backupPath = null;
  try {
    const snapshot = await remote({ mode: 'inspect' });
    assertAligned(snapshot);
    for (const service of [MAIN, RUNNER]) assert.equal(snapshot.services?.[service]?.replicas, 1);
    before = snapshot.workflow;
    assert.equal(fingerprint(before), EXPECTED_BEFORE, 'Active workflow drifted from tested baseline');
    after = structuredClone(before);
    assert.equal(patchDirectCatalogPrompt(after).changed, true);
    assert.equal(fingerprint(after), EXPECTED_AFTER, 'Candidate drifted from tested artifact');
    assert.deepEqual(after.connections, before.connections, 'Workflow graph changed');
    for (const node of before.nodes) {
      if (node.name === DIRECT) continue;
      assert.deepEqual(after.nodes.find(item => item.name === node.name), node, 'Unrelated node changed');
    }
    assert.equal(after.nodes.find(node => node.name === DIRECT).parameters.jsCode, DIRECT_CODE);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-n8n-catalog-choice-'));
    try {
      const candidateFile = path.join(temp, 'candidate.json');
      fs.writeFileSync(candidateFile, JSON.stringify(after), { mode: 0o600 });
      const gate = spawnSync(process.execPath, [path.join(__dirname, 'n8n-sales-regression-gate.cjs'), '--snapshot', candidateFile],
        { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      assert.equal(gate.status, 0, 'Commercial regression gate failed');
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
    const summary = { workflowId: WORKFLOW_ID, before: fingerprint(before), after: fingerprint(after), nodes: after.nodes.length,
      activeVersionId: before.activeVersionId, alreadyApplied: fingerprint(before) === fingerprint(after) };
    if (!apply || summary.alreadyApplied) {
      console.log(JSON.stringify({ ...summary, applied: false, dryRun: !apply }));
      return;
    }
    await waitFor(async () => Number((await remote({ mode: 'inspect' })).running) === 0, 'Active executions');
    const backup = await remote({ mode: 'backup' });
    assert.equal(backup.encrypted, true, 'Encrypted backup required');
    backupPath = backup.backupPath;
    stopped = true;
    await scale(MAIN, 0);
    await scale(RUNNER, 0);
    const current = await remote({ mode: 'inspect' });
    assertAligned(current);
    assert.equal(fingerprint(current.workflow), summary.before, 'Workflow changed after validation');
    assert.equal(Number(current.running), 0, 'Execution still running');
    changed = true;
    await remote({ mode: 'sql', sql: casSql(snapshot, before, after) });
    await start();
    const published = await remote({ mode: 'inspect' });
    assertAligned(published);
    assert.equal(fingerprint(published.workflow), summary.after, 'Active workflow differs from candidate');
    stopped = false;
    console.log(JSON.stringify({ ...summary, applied: true, backupPath, entityHistoryAligned: true, servicesHealthy: true }));
  } catch (error) {
    const recoveryErrors = [];
    if (stopped) {
      for (const service of [MAIN, RUNNER]) try { await scale(service, 0); } catch { recoveryErrors.push(service); }
      if (changed) try {
        const current = await remote({ mode: 'inspect' });
        if (fingerprint(current.workflow) === fingerprint(after))
          await remote({ mode: 'sql', sql: casSql({ workflow: after, entity: { nodes: after.nodes, connections: after.connections } }, after, before) });
        else if (fingerprint(current.workflow) !== fingerprint(before)) throw Error('Concurrent change');
      } catch { recoveryErrors.push('workflow CAS'); }
      try { await start(); } catch { recoveryErrors.push('service recovery'); }
    }
    console.error(JSON.stringify({ error: String(error.message).split('\n')[0].slice(0, 180), backupPath, recoveryErrors }));
    process.exitCode = 1;
  } finally { connection.end(); }
}

main().catch(error => { console.error(String(error.message).split('\n')[0].slice(0, 180)); process.exitCode = 1; });

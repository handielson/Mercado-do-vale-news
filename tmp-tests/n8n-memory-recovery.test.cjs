const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TARGETS, patchWorkflow, assertPatchScope, heapOptions, validateMemory, casSql } = require('../scripts/n8n-memory-recovery.cjs');

const original = {
  nodes: Object.entries(TARGETS).map(([name, [kind, url]], i) => ({
    id: String(i), name,
    type: kind === 'http' ? 'n8n-nodes-base.httpRequest' : 'n8n-nodes-base.code',
    parameters: kind === 'http' ? { url, options: { timeout: 30000 }, headerParameters: { parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }] } } : { jsCode: `return (async()=>{const response=await fetch('${url}',{headers:{Accept:'application/json'}});return [{json:await response.json()}];})();` },
    credentials: { account: { id: 'credential-reference' } }, onError: 'continueRegularOutput',
  })).concat([{ name: 'Unrelated', parameters: { value: 'retained' } }]),
  connections: { A: { main: [[{ node: 'Unrelated', type: 'main', index: 0 }]] } },
  settings: { errorWorkflow: 'existing-error-workflow', executionOrder: 'v1' },
  staticData: { global: { salesPostList: { customer: { preserved: true } } } },
  versionId: 'version', activeVersionId: 'version', active: true,
};
const copy = structuredClone(original);
const first = patchWorkflow(original);
assert.deepEqual(original, copy, 'Pure patch mutated its input');
assert.equal(first.changed.length, 4);
assert.equal(patchWorkflow(first.workflow).changed.length, 0);
assert.deepEqual(first.workflow.connections, original.connections);
assert.deepEqual(first.workflow.staticData, original.staticData);
assert.deepEqual(first.workflow.settings, original.settings);
assert.deepEqual(first.workflow.nodes.map((n) => n.credentials), original.nodes.map((n) => n.credentials));
for (const field of ['connections', 'settings', 'staticData']) {
  const drift = structuredClone(first.workflow); drift[field].unexpected = true;
  assert.throws(() => assertPatchScope(original, drift), /outside/);
}
const credentialDrift = structuredClone(first.workflow);
credentialDrift.nodes[0].credentials.account.id = 'other';
assert.throws(() => assertPatchScope(original, credentialDrift), /outside/);
const urlDrift = structuredClone(original);
urlDrift.nodes[0].parameters.url += '?other=1';
assert.throws(() => patchWorkflow(urlDrift), /URL drift/);
const duplicate = structuredClone(original); duplicate.nodes.push(structuredClone(duplicate.nodes[0]));
assert.throws(() => patchWorkflow(duplicate), /exactly one/);
const codeDrift = structuredClone(original); codeDrift.nodes[2].parameters.jsCode += codeDrift.nodes[2].parameters.jsCode;
assert.throws(() => patchWorkflow(codeDrift), /count drift/);
const methodDrift = structuredClone(original); methodDrift.nodes[0].parameters.method = 'POST';
assert.throws(() => patchWorkflow(methodDrift), /method drift/);
const syntaxDrift = structuredClone(original); syntaxDrift.nodes[2].parameters.jsCode += '\nconst = ;';
assert.throws(() => patchWorkflow(syntaxDrift), /Code syntax drift/);

assert.equal(heapOptions(), '--max-old-space-size=6144');
assert.equal(heapOptions('--enable-source-maps --max-old-space-size=2048'), '--enable-source-maps --max-old-space-size=6144');
assert.equal(heapOptions('--max_old_space_size 2048 --trace-warnings'), '--trace-warnings --max-old-space-size=6144');
assert.equal(heapOptions('--max-old-space-size=1024 --max_old_space_size=2048'), '--max-old-space-size=6144');
assert.equal(heapOptions('--require "/opt/file name.cjs" --max-old-space-size=2048'), '--require "/opt/file name.cjs" --max-old-space-size=6144');
assert.equal(heapOptions('--max-old-space-size="2048"'), '--max-old-space-size=6144');
assert.equal(heapOptions(heapOptions('--trace-warnings')), heapOptions('--trace-warnings'));
assert.throws(() => heapOptions('--max-old-space-size=oops'), /Unsupported/);
assert.deepEqual(validateMemory('MemTotal: 16777216 kB\nMemAvailable: 3145728 kB'), { totalMiB: 16384, availableMiB: 3072 });
assert.throws(() => validateMemory('MemTotal: 8000000 kB\nMemAvailable: 4000000 kB'), /Host memory/);
assert.throws(() => validateMemory('MemTotal: 16777216 kB\nMemAvailable: 1048576 kB'), /MemAvailable/);
const sql = casSql({ workflow: original }, original.nodes, first.workflow.nodes);
assert.match(sql, /BEGIN;/);
assert.match(sql, /FOR UPDATE/);
assert.match(sql, /Entity CAS guard failed/);
assert.match(sql, /History CAS guard failed/);
assert.doesNotMatch(sql, /SET[^;]*(staticData|connections|activeVersionId|versionId)\s*=/);
assert.doesNotMatch(sql, /(UPDATE|DELETE FROM) execution_entity/);
assert.match(sql, /COMMIT;/);
const source = fs.readFileSync(path.join(__dirname, '../scripts/n8n-memory-recovery.cjs'), 'utf8');
const applySequence = source.slice(source.indexOf('stopped = true;'), source.indexOf('workflowMayHaveChanged = true;'));
assert.ok(applySequence.indexOf('scale(conn, MAIN, 0)') < applySequence.indexOf('scale(conn, RUNNER, 0)'), 'Main must stop before runner');
assert.ok(applySequence.indexOf('scale(conn, RUNNER, 0)') < applySequence.indexOf('snapshot = await readSnapshot'), 'Authoritative snapshot must follow graceful shutdown');
assert.match(applySequence, /assertNoRunning\(conn, db\)/, 'Recheck global execution guard after shutdown');
assert.match(source, /if \(workflowMayHaveChanged && snapshot && patched\)/, 'Rollback must not mutate a workflow before the forward CAS');
assert.match(source, /--env-rm NODE_OPTIONS/, 'Only the requested environment variable is removed');
assert.doesNotMatch(source, /execute_workflow|retry_execution|UPDATE execution_entity|DELETE FROM execution_entity/);
console.log('n8n memory recovery checks passed: four URL consumers, idempotence, scope/CAS, retained flags and memory guards');

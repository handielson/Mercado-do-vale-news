const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MAIN = 'n8n_n8n';
const RUNNER = 'n8n_n8n-runner';
const HEAP_MB = 6144;
const TARGETS = {
  'Vendas - Buscar Configuracoes Loja': ['http', 'https://api.xiaomipetrolina.com.br/company-settings'],
  'Loja - Buscar Dados Empresa': ['http', 'https://api.xiaomipetrolina.com.br/public/company-settings'],
  'Vendas - Preparar Contexto IA': ['code', 'https://api.xiaomipetrolina.com.br/public/company-settings'],
  'Loja - Horario Atendimento': ['code', 'https://api.xiaomipetrolina.com.br/public/company-settings'],
};
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function patchWorkflow(workflow) {
  const patched = structuredClone(workflow);
  const changed = [];
  for (const [name, [kind, url]] of Object.entries(TARGETS)) {
    const matches = patched.nodes.filter((node) => node.name === name);
    assert.equal(matches.length, 1, `Expected exactly one target: ${name}`);
    const node = matches[0];
    const next = `${url}?view=bot`;
    if (kind === 'http') {
      assert.equal(node.type, 'n8n-nodes-base.httpRequest', `Node type drift: ${name}`);
      assert.ok(!node.parameters.method || node.parameters.method === 'GET', `HTTP method drift: ${name}`);
      assert.ok(node.parameters.url === url || node.parameters.url === next, `URL drift: ${name}`);
      if (node.parameters.url !== next) { node.parameters.url = next; changed.push(name); }
    } else {
      assert.equal(node.type, 'n8n-nodes-base.code', `Node type drift: ${name}`);
      const code = String(node.parameters.jsCode || '');
      // Match the complete quoted URL, never a partial string or another query mode.
      const before = [`'${url}'`, `"${url}"`];
      const after = [`'${next}'`, `"${next}"`];
      const count = [...before, ...after].reduce((sum, token) => sum + code.split(token).length - 1, 0);
      assert.equal(count, 1, `Code URL count drift: ${name}`);
      let updated = code;
      for (let i = 0; i < before.length; i++) updated = updated.replace(before[i], after[i]);
      if (updated !== code) { node.parameters.jsCode = updated; changed.push(name); }
    }
  }
  assertPatchScope(workflow, patched);
  return { workflow: patched, changed };
}

function assertPatchScope(before, after) {
  const restored = structuredClone(after);
  for (const [name, [kind]] of Object.entries(TARGETS)) {
    const oldNode = before.nodes.find((node) => node.name === name);
    const newNode = restored.nodes.find((node) => node.name === name);
    assert.ok(oldNode && newNode, `Missing target: ${name}`);
    if (kind === 'http') newNode.parameters.url = oldNode.parameters.url;
    else newNode.parameters.jsCode = oldNode.parameters.jsCode;
  }
  assert.deepEqual(restored, before, 'Patch changed fields outside the four URL consumers');
}

function heapOptions(existing = '') {
  const input = String(existing);
  const withoutHeap = input.replace(/(^|\s)(["']?)--max[-_]old[-_]space[-_]size(?:=|\s+)(?:["']?\d+["']?)\2(?=\s|$)/g, '$1').trim();
  assert.ok(!/--max[-_]old[-_]space[-_]size/.test(withoutHeap), 'Unsupported heap option syntax; refuse to alter other flags');
  return `${withoutHeap}${withoutHeap ? ' ' : ''}--max-old-space-size=${HEAP_MB}`;
}

function validateMemory(meminfo) {
  const read = (key) => Number(String(meminfo).match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, 'm'))?.[1] || 0);
  const totalKiB = read('MemTotal');
  const availableKiB = read('MemAvailable');
  // A 16GB VPS commonly exposes slightly less than 16GiB in /proc/meminfo.
  assert.ok(totalKiB >= 15 * 1024 * 1024, 'Host memory must be at least a nominal 16GB');
  assert.ok(availableKiB >= 3 * 1024 * 1024, 'MemAvailable must be at least 3GiB');
  return { totalMiB: Math.round(totalKiB / 1024), availableMiB: Math.round(availableKiB / 1024) };
}

function run(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(new Error('SSH command could not start'));
    let stdout = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', () => {});
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`Remote command failed (exit ${code}); sensitive output omitted`)));
  }));
}

function psql(conn, db, sql) {
  return new Promise((resolve, reject) => conn.exec(`docker exec -i ${quote(db)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, (error, stream) => {
    if (error) return reject(new Error('Postgres read/write could not start'));
    let stdout = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', () => {});
    stream.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`Postgres operation failed (exit ${code}); sensitive output omitted`)));
    stream.end(sql);
  }));
}

async function writeSecure(conn, path, value) {
  await new Promise((resolve, reject) => conn.sftp((error, sftp) => {
    if (error) return reject(new Error('Secure backup transport could not start'));
    sftp.open(path, 'wx', { mode: 0o600 }, (openError, handle) => {
      if (openError) { sftp.end(); return reject(new Error('Secure backup creation failed')); }
      const contents = Buffer.from(JSON.stringify(value), 'utf8');
      const writePart = (offset) => sftp.write(handle, contents, offset, contents.length - offset, offset, (writeError, written) => {
        if (!writeError && written > 0 && offset + written < contents.length) return writePart(offset + written);
        sftp.close(handle, (closeError) => {
          sftp.end();
          writeError || closeError || !(written > 0) ? reject(new Error('Secure backup write failed')) : resolve();
        });
      });
      writePart(0);
    });
  }));
  await run(conn, `chmod 600 ${quote(path)} && sha256sum ${quote(path)} > ${quote(`${path}.sha256`)} && chmod 600 ${quote(`${path}.sha256`)}`);
}

async function readSnapshot(conn, db) {
  const raw = await psql(conn, db, `SELECT encode(convert_to(json_build_object('workflow',row_to_json(w),'history',row_to_json(h))::text,'UTF8'),'hex') FROM workflow_entity w JOIN workflow_history h ON h."workflowId"=w.id AND h."versionId"=w."activeVersionId" WHERE w.id='${WORKFLOW_ID}';`);
  assert.ok(raw, 'Active workflow/history not found');
  const snapshot = JSON.parse(Buffer.from(raw, 'hex').toString('utf8'));
  assert.equal(snapshot.workflow.active, true, 'Workflow is not active');
  assert.equal(snapshot.workflow.versionId, snapshot.workflow.activeVersionId, 'Published version drift');
  assert.deepEqual(snapshot.workflow.nodes, snapshot.history.nodes, 'Entity/history node drift');
  assert.deepEqual(snapshot.workflow.connections, snapshot.history.connections, 'Entity/history connection drift');
  return snapshot;
}

async function assertNoRunning(conn, db) {
  const count = Number(await psql(conn, db, `SELECT count(*) FROM execution_entity WHERE status IN ('new','running');`));
  assert.equal(count, 0, 'New/running executions exist; wait for them to finish normally');
}

async function waitService(conn, service, replicas, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = (await run(conn, `docker service ls --filter name=${quote(service)} --format '{{.Name}} {{.Replicas}}'`)).trim();
    if (current === `${service} ${replicas}/${replicas}`) return;
    await sleep(2500);
  }
  throw new Error(`${service} did not reach ${replicas}/${replicas}`);
}

async function scale(conn, service, replicas) {
  await run(conn, `docker service scale ${service}=${replicas} >/dev/null`);
  await waitService(conn, service, replicas);
}

async function waitHealth(conn, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = (await run(conn, "curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 10 https://n8n.mercadodovale.com.br/healthz || true")).trim();
    if (status === '200') return;
    await sleep(2500);
  }
  throw new Error('n8n health did not return HTTP 200');
}

function nodesSql(nodes) {
  return `convert_from(decode('${Buffer.from(JSON.stringify(nodes)).toString('hex')}','hex'),'UTF8')::json`;
}

function casSql(snapshot, expectedNodes, nextNodes) {
  const activeVersion = String(snapshot.workflow.activeVersionId).replace(/'/g, "''");
  const connections = nodesSql(snapshot.workflow.connections);
  const expected = nodesSql(expectedNodes);
  const next = nodesSql(nextNodes);
  return `BEGIN;
  DO $memory_recovery$ DECLARE affected integer; BEGIN
    PERFORM 1 FROM workflow_entity WHERE id='${WORKFLOW_ID}' FOR UPDATE;
    PERFORM 1 FROM workflow_history WHERE "workflowId"='${WORKFLOW_ID}' AND "versionId"='${activeVersion}' FOR UPDATE;
    UPDATE workflow_entity SET nodes=${next}, "updatedAt"=CURRENT_TIMESTAMP
      WHERE id='${WORKFLOW_ID}' AND active=true AND "activeVersionId"='${activeVersion}' AND "versionId"='${activeVersion}'
        AND nodes::jsonb=(${expected})::jsonb AND connections::jsonb=(${connections})::jsonb;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'Entity CAS guard failed'; END IF;
    UPDATE workflow_history SET nodes=${next}, "updatedAt"=CURRENT_TIMESTAMP
      WHERE "workflowId"='${WORKFLOW_ID}' AND "versionId"='${activeVersion}'
        AND nodes::jsonb=(${expected})::jsonb AND connections::jsonb=(${connections})::jsonb;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'History CAS guard failed'; END IF;
  END $memory_recovery$;
  COMMIT;`;
}

async function inspectService(conn, service) {
  const specs = JSON.parse(await run(conn, `docker service inspect ${quote(service)}`));
  assert.equal(specs.length, 1);
  const spec = specs[0];
  assert.equal(spec.Spec.Mode?.Replicated?.Replicas, 1, `${service} must start at one replica`);
  assert.match(spec.Spec.TaskTemplate.ContainerSpec.Image, /:2\.38\.5(?:@|$)/, `${service} image drift`);
  return spec;
}

function nodeOptions(spec) {
  const matches = (spec.Spec.TaskTemplate.ContainerSpec.Env || []).filter((entry) => entry.startsWith('NODE_OPTIONS='));
  assert.ok(matches.length <= 1, 'Duplicate NODE_OPTIONS environment entries');
  return matches.length ? matches[0].slice('NODE_OPTIONS='.length) : null;
}

async function updateNodeOptions(conn, value) {
  await run(conn, `docker service update --detach=true --env-rm NODE_OPTIONS${value === null ? '' : ` --env-add ${quote(`NODE_OPTIONS=${value}`)}`} ${MAIN} >/dev/null`);
}

async function probeBotSettings(conn) {
  // Runs only GETs using the same existing secret as the HTTP node; no workflow execution.
  const probe = `const fs=require('node:fs');const p=JSON.parse(fs.readFileSync('/dev/stdin','utf8'));const env=p[0].Spec.TaskTemplate.ContainerSpec.Env||[];const sync=env.find(v=>v.startsWith('SYNC_SECRET='));if(!sync)process.exit(1);const forbidden=['logo','favicon','watermark','receipt_logo_url','receipt_watermark'];(async()=>{const results=[];for(const path of ['/company-settings?view=bot','/public/company-settings?view=bot']){const r=await fetch('https://api.xiaomipetrolina.com.br'+path,{headers:{'x-sync-key':sync.slice(12)},signal:AbortSignal.timeout(15000)});const text=await r.text();if(r.status!==200)throw Error('settings HTTP '+r.status);const v=JSON.parse(text);if(!v||typeof v!=='object'||Array.isArray(v)||forbidden.some(k=>Object.prototype.hasOwnProperty.call(v,k)))throw Error('bot projection unavailable');if(Buffer.byteLength(text)>65536)throw Error('bot projection too large');if(!Object.prototype.hasOwnProperty.call(v,'business_hours'))throw Error('bot hours missing');results.push({path,status:r.status,bytes:Buffer.byteLength(text)})}console.log(JSON.stringify(results))})().catch(()=>process.exit(1));`;
  const raw = await run(conn, `docker service inspect ${MAIN} | node -e ${quote(probe)}`);
  return JSON.parse(raw.trim());
}

async function main() {
  const apply = process.argv.includes('--apply');
  assert.ok(process.argv.slice(2).every((arg) => arg === '--apply'), 'Only --apply is supported');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', () => reject(new Error('SSH connection failed'))).connect(getVpsSshConfig()));
  let stopped = false;
  let envMayHaveChanged = false;
  let workflowMayHaveChanged = false;
  let originalMain;
  let snapshot;
  let patched;
  let db;
  let backupPath;
  try {
    db = (await run(conn, "docker ps --filter name=n8n_n8n-db --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n Postgres container missing');
    const memory = validateMemory(await run(conn, 'cat /proc/meminfo'));
    originalMain = await inspectService(conn, MAIN);
    const originalRunner = await inspectService(conn, RUNNER);
    await assertNoRunning(conn, db);
    snapshot = await readSnapshot(conn, db);
    patched = patchWorkflow(snapshot.workflow);
    const options = heapOptions(nodeOptions(originalMain) || '');
    const projections = await probeBotSettings(conn);
    const plan = { apply, workflowId: WORKFLOW_ID, changedNodes: patched.changed, memory, heapMiB: HEAP_MB, projections, connectionsPreserved: true, credentialsPreserved: true };
    if (!apply) { console.log(JSON.stringify(plan, null, 2)); return; }
    if (!patched.changed.length && nodeOptions(originalMain) === options) {
      console.log(JSON.stringify({ ...plan, alreadyApplied: true, restartSkipped: true }, null, 2));
      return;
    }
    backupPath = `/var/backups/mdv-system/n8n-memory-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    await run(conn, `mkdir -m 700 ${quote(backupPath)}`);
    await writeSecure(conn, `${backupPath}/main-service.json`, originalMain);
    await writeSecure(conn, `${backupPath}/runner-service.json`, originalRunner);
    await assertNoRunning(conn, db);
    stopped = true; // Also recover if graceful stop itself times out.
    await scale(conn, MAIN, 0);
    await scale(conn, RUNNER, 0);
    await assertNoRunning(conn, db);
    // Take authoritative state only after graceful shutdown has persisted staticData.
    snapshot = await readSnapshot(conn, db);
    patched = patchWorkflow(snapshot.workflow);
    await writeSecure(conn, `${backupPath}/workflow-history.json`, snapshot);
    await writeSecure(conn, `${backupPath}/patched-nodes.json`, patched.workflow.nodes);
    workflowMayHaveChanged = true;
    await psql(conn, db, casSql(snapshot, snapshot.workflow.nodes, patched.workflow.nodes));
    envMayHaveChanged = true;
    await updateNodeOptions(conn, options);
    await scale(conn, MAIN, 1);
    await waitHealth(conn);
    await scale(conn, RUNNER, 1);
    const currentMain = await inspectService(conn, MAIN);
    const currentRunner = await inspectService(conn, RUNNER);
    const envWithoutHeap = (spec) => (spec.Spec.TaskTemplate.ContainerSpec.Env || []).filter((entry) => !entry.startsWith('NODE_OPTIONS=')).sort();
    assert.deepEqual(envWithoutHeap(currentMain), envWithoutHeap(originalMain), 'Other main environment fields changed');
    assert.deepEqual(currentRunner.Spec.TaskTemplate.ContainerSpec.Env, originalRunner.Spec.TaskTemplate.ContainerSpec.Env, 'Runner environment changed');
    assert.equal(nodeOptions(currentMain), options, 'Main NODE_OPTIONS validation failed');
    const current = await readSnapshot(conn, db);
    assert.deepEqual(current.workflow.nodes, patched.workflow.nodes, 'Published node validation failed');
    assert.deepEqual(current.workflow.connections, snapshot.workflow.connections, 'Published connections changed');
    assert.equal(current.workflow.activeVersionId, snapshot.workflow.activeVersionId);
    // Do not compare staticData after startup: normal events may legitimately update it.
    const container = (await run(conn, "docker ps --filter name=n8n_n8n.1 --format '{{.Names}}' | head -n 1")).trim();
    const heapBytes = Number(await run(conn, `docker exec ${quote(container)} node -e ${quote("console.log(require('node:v8').getHeapStatistics().heap_size_limit)")}`));
    assert.ok(heapBytes >= HEAP_MB * 1024 * 1024 && heapBytes < (HEAP_MB + 256) * 1024 * 1024, 'Effective heap did not reach approximately 6GiB');
    assert.equal(patchWorkflow(current.workflow).changed.length, 0, 'Four bot URLs not active');
    stopped = false;
    console.log(JSON.stringify({ ...plan, changedNodes: patched.changed, backupPath, entityHistoryAligned: true, activeVersionPreserved: true, heapMiBEffective: Math.round(heapBytes / 1024 / 1024), health: 200, services: { main: '1/1', runner: '1/1' }, workflowExecuted: false }, null, 2));
  } catch (error) {
    const rollbackErrors = [];
    if (stopped) {
      // Main first prevents new webhooks while rolling back; never replay executions.
      for (const service of [MAIN, RUNNER]) {
        try { await scale(conn, service, 0); } catch { rollbackErrors.push(`${service}: stop failed`); }
      }
      if (workflowMayHaveChanged && snapshot && patched) {
        try {
          const current = await readSnapshot(conn, db);
          if (digest(current.workflow.nodes) !== digest(snapshot.workflow.nodes)) {
            await psql(conn, db, casSql(snapshot, patched.workflow.nodes, snapshot.workflow.nodes));
          }
        } catch { rollbackErrors.push('Workflow rollback CAS failed; backup requires operator review'); }
      }
      if (envMayHaveChanged && originalMain) {
        try { await updateNodeOptions(conn, nodeOptions(originalMain)); } catch { rollbackErrors.push('NODE_OPTIONS restoration failed'); }
      }
      try { await scale(conn, MAIN, 1); await waitHealth(conn); } catch { rollbackErrors.push('Main recovery/health failed'); }
      try { await scale(conn, RUNNER, 1); } catch { rollbackErrors.push('Runner recovery failed'); }
    }
    // AssertionError diffs can contain full nodes/env; emit only the explicit first-line label.
    console.error(JSON.stringify({ apply, failed: true, message: String(error.message).split('\n')[0].slice(0,240), backupPath: backupPath || null, rollbackAttempted: stopped, rollbackErrors }, null, 2));
    process.exitCode = 1;
  } finally { conn.end(); }
}

module.exports = { TARGETS, HEAP_MB, patchWorkflow, assertPatchScope, heapOptions, validateMemory, casSql };
if (require.main === module) main().catch(() => { console.error('Memory recovery preflight failed; sensitive output omitted'); process.exitCode = 1; });

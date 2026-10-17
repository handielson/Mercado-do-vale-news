const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const TARGET_HOST = 'n8n-db';
const MEMORY_NODE_NAMES = new Set(['Memoria de contexto postggress', 'Memoria Vendas']);
const ALLOWED_SOURCE_HOSTS = new Set(['10.11.0.2', 'n8n_n8n-db', TARGET_HOST]);
const APPLY = process.argv.includes('--apply');
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function rewriteCredentialExport(document, credentialId, targetHost = TARGET_HOST) {
  assert.ok(Array.isArray(document), 'Credential export must be an array');
  assert.equal(document.length, 1, 'Expected exactly one exported credential');
  const credential = document[0];
  assert.equal(credential.id, credentialId, 'Credential id drift');
  assert.equal(credential.type, 'postgres', 'Credential type drift');
  assert.ok(credential.data && typeof credential.data === 'object', 'Credential data missing');
  assert.ok(ALLOWED_SOURCE_HOSTS.has(credential.data.host), 'Unexpected Postgres host; refusing update');

  const before = structuredClone(document);
  credential.data.host = targetHost;
  const changed = before[0].data.host !== targetHost;
  const afterWithoutHost = structuredClone(document);
  const beforeWithoutHost = structuredClone(before);
  delete afterWithoutHost[0].data.host;
  delete beforeWithoutHost[0].data.host;
  assert.deepEqual(afterWithoutHost, beforeWithoutHost, 'Fields outside data.host changed');
  return { document, changed, previousHost: before[0].data.host, targetHost };
}

function run(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(new Error('SSH command could not start'));
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0
      ? resolve(stdout.trim())
      : reject(new Error(`Remote command failed (exit ${code}): ${(stderr || stdout).slice(0, 500)}`)));
  }));
}

function runStdin(connection, command, input) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(new Error('SSH stdin command could not start'));
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0
      ? resolve(stdout.trim())
      : reject(new Error(`Remote stdin command failed (exit ${code}): ${(stderr || stdout).slice(0, 500)}`)));
    stream.end(input);
  }));
}

function psql(connection, container, sql) {
  return runStdin(
    connection,
    `docker exec -i ${quote(container)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`,
    sql,
  );
}

async function waitService(connection, name, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = await run(connection, `docker service ls --filter name=${quote(name)} --format '{{.Replicas}}' | head -n 1`);
    if (replicas === '1/1') return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${name} did not reach 1/1`);
}

async function waitHealth(connection, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const code = await run(connection, "curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://n8n.mercadodovale.com.br/healthz || true");
    if (code === '200') return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error('n8n health did not return HTTP 200');
}

async function readMemoryCredential(connection, dbContainer) {
  const sql = `COPY (SELECT encode(convert_to(json_build_object(
    'active', active,
    'aligned', "versionId"="activeVersionId",
    'memories', (SELECT json_agg(json_build_object(
      'name', node->>'name',
      'credentialId', node->'credentials'->'postgres'->>'id',
      'credentialName', node->'credentials'->'postgres'->>'name'
    ) ORDER BY node->>'name') FROM json_array_elements(nodes) node
      WHERE node->>'type'='@n8n/n8n-nodes-langchain.memoryPostgresChat')
  )::text,'UTF8'),'hex') FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
  const hex = await psql(connection, dbContainer, sql);
  assert.ok(hex, 'Workflow not found');
  const snapshot = JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
  assert.equal(snapshot.active, true, 'Workflow is not active');
  assert.equal(snapshot.aligned, true, 'Workflow entity/history version is not aligned');
  assert.equal(snapshot.memories.length, MEMORY_NODE_NAMES.size, 'Memory node count drift');
  for (const memory of snapshot.memories) assert.ok(MEMORY_NODE_NAMES.has(memory.name), `Unexpected memory node: ${memory.name}`);
  const credentialIds = [...new Set(snapshot.memories.map((memory) => memory.credentialId))];
  assert.equal(credentialIds.length, 1, 'Memory nodes do not share one Postgres credential');
  assert.ok(credentialIds[0], 'Postgres credential id missing');
  return { ...snapshot, credentialId: credentialIds[0] };
}

async function waitForNoActiveExecutions(connection, dbContainer, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = Number(await psql(connection, dbContainer, `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`));
    if (count === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Workflow still has active executions; refusing credential update');
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let mainContainer = '';
  const tempFiles = [];
  try {
    mainContainer = await run(connection, "docker ps --filter 'name=n8n_n8n.' --format '{{.Names}}' | head -n 1");
    const dbContainer = await run(connection, "docker ps --filter 'name=n8n_n8n-db.' --format '{{.Names}}' | head -n 1");
    assert.ok(mainContainer && dbContainer, 'n8n containers not found');
    const snapshot = await readMemoryCredential(connection, dbContainer);
    const tcpProbe = await run(connection, `docker exec ${quote(mainContainer)} node -e "const net=require('net');const s=net.connect({host:'${TARGET_HOST}',port:5432,timeout:3000},()=>{console.log('reachable');s.destroy()});s.on('timeout',()=>{console.log('timeout');s.destroy()});s.on('error',e=>console.log(e.code));"`);
    assert.equal(tcpProbe, 'reachable', `${TARGET_HOST}:5432 is not reachable from n8n`);

    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, workflowId: WORKFLOW_ID, memoryNodes: snapshot.memories.map((item) => item.name), credentialId: snapshot.credentialId, targetHost: TARGET_HOST, tcp: 'reachable' }, null, 2));
      return;
    }

    await waitForNoActiveExecutions(connection, dbContainer);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const encryptedTemp = `/tmp/n8n-memory-credential-${stamp}.encrypted.json`;
    const decryptedTemp = `/tmp/n8n-memory-credential-${stamp}.decrypted.json`;
    const verifyTemp = `/tmp/n8n-memory-credential-${stamp}.verify.json`;
    tempFiles.push(encryptedTemp, decryptedTemp, verifyTemp);
    const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-memory-credential-before-host-recovery-${stamp}.json`;
    await run(connection, 'mkdir -p /root/n8n-backups && chmod 700 /root/n8n-backups');
    await run(connection, `docker exec ${quote(mainContainer)} sh -lc ${quote(`umask 077; n8n export:credentials --id=${snapshot.credentialId} --output=${encryptedTemp}`)}`);
    await run(connection, `docker cp ${quote(`${mainContainer}:${encryptedTemp}`)} ${quote(backupPath)} && chmod 600 ${quote(backupPath)} && sha256sum ${quote(backupPath)} > ${quote(`${backupPath}.sha256`)} && chmod 600 ${quote(`${backupPath}.sha256`)}`);

    await run(connection, `docker exec ${quote(mainContainer)} sh -lc ${quote(`umask 077; n8n export:credentials --id=${snapshot.credentialId} --decrypted --output=${decryptedTemp}`)}`);
    const transformer = `const fs=require('fs');\nconst p=process.argv[2];\nconst id=process.argv[3];\nconst d=JSON.parse(fs.readFileSync(p,'utf8'));\nif(!Array.isArray(d)||d.length!==1||d[0].id!==id||d[0].type!=='postgres'||!d[0].data) throw new Error('credential export drift');\nconst allowed=new Set(['10.11.0.2','n8n_n8n-db','n8n-db']);\nif(!allowed.has(d[0].data.host)) throw new Error('unexpected postgres host');\nconst previousHost=d[0].data.host;\nd[0].data.host='n8n-db';\nfs.writeFileSync(p,JSON.stringify(d),{mode:0o600});\nconsole.log(JSON.stringify({changed:previousHost!=='n8n-db',previousHost,targetHost:'n8n-db'}));\n`;
    const transformSummary = JSON.parse(await runStdin(connection, `docker exec -i ${quote(mainContainer)} node - ${quote(decryptedTemp)} ${quote(snapshot.credentialId)}`, transformer));
    if (transformSummary.changed) {
      await run(connection, `docker exec ${quote(mainContainer)} n8n import:credentials --input=${quote(decryptedTemp)} --include=id,name,type,data`);
    }

    await run(connection, `docker exec ${quote(mainContainer)} sh -lc ${quote(`umask 077; n8n export:credentials --id=${snapshot.credentialId} --decrypted --output=${verifyTemp}`)}`);
    const verifier = `const fs=require('fs');\nconst p=process.argv[2];\nconst id=process.argv[3];\nconst d=JSON.parse(fs.readFileSync(p,'utf8'));\nif(!Array.isArray(d)||d.length!==1||d[0].id!==id||d[0].type!=='postgres'||d[0].data?.host!=='n8n-db') throw new Error('credential verification failed');\nconsole.log(JSON.stringify({credentialId:id,type:d[0].type,host:d[0].data.host}));\n`;
    const credential = JSON.parse(await runStdin(connection, `docker exec -i ${quote(mainContainer)} node - ${quote(verifyTemp)} ${quote(snapshot.credentialId)}`, verifier));
    await run(connection, `docker exec ${quote(mainContainer)} rm -f ${tempFiles.map(quote).join(' ')}`);
    tempFiles.length = 0;

    await run(connection, 'docker service update --force --detach=true n8n_n8n >/dev/null');
    await waitService(connection, 'n8n_n8n');
    await waitHealth(connection);
    await run(connection, 'docker service update --force --detach=true n8n_n8n-runner >/dev/null');
    await waitService(connection, 'n8n_n8n-runner');
    const readiness = await run(connection, "curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://n8n.mercadodovale.com.br/healthz/readiness || true");
    assert.equal(readiness, '200', 'n8n readiness failed');
    const services = await run(connection, "docker service ls --filter name=n8n_ --format '{{.Name}}={{.Replicas}}' | sort");
    console.log(JSON.stringify({ apply: true, workflowId: WORKFLOW_ID, backupPath, changed: transformSummary.changed, previousHost: transformSummary.previousHost, credential, health: 200, readiness: 200, services: services.split(/\r?\n/) }, null, 2));
  } finally {
    if (mainContainer && tempFiles.length) {
      await run(connection, `docker exec ${quote(mainContainer)} rm -f ${tempFiles.map(quote).join(' ')}`).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { ALLOWED_SOURCE_HOSTS, MEMORY_NODE_NAMES, TARGET_HOST, WORKFLOW_ID, rewriteCredentialExport };
if (require.main === module) main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

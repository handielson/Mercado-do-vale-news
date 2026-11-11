'use strict';
// bot-error-alerts-v1: publica o workflow de erros do bot (mdvBotError2026a) com CAS no banco do n8n.
// Dry run por padrão; --apply grava entity + histórico da versão ativa só se ainda estiverem como lidos.
// O workflow de erros é lido do banco a cada falha; não reinicia o n8n (o bot não para).
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('../tmp-tests/vps-ssh-config.cjs');
const { WORKFLOW_ID, patchErrorWorkflow } = require('./n8n-bot-error-alerts.cjs');

const fingerprint = (w) => crypto.createHash('sha256').update(JSON.stringify({ nodes: w.nodes, connections: w.connections })).digest('hex');
const lit = (value) => `'${String(value).replace(/'/g, "''")}'`;
const jsonSql = (value) => `convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('hex')}','hex'),'UTF8')::json`;

function run(conn, command, input) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let out = '', err = '';
    stream.on('data', (chunk) => { out += chunk; });
    stream.stderr.on('data', (chunk) => { err += chunk; });
    stream.on('close', (code) => (code ? reject(new Error(`falhou (${code}): ${String(err || out).slice(0, 300)}`)) : resolve(out)));
    if (input !== undefined) stream.end(input); else stream.end();
  }));
}

const PSQL = 'db=$(docker ps --filter label=com.docker.swarm.service.name=n8n_n8n-db --format "{{.Names}}" | head -n1); docker exec -i "$db" psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1';

async function inspect(conn) {
  const sql = `SELECT json_build_object('id',e.id,'active',e.active,'versionId',e."versionId",'activeVersionId',e."activeVersionId",
    'entity',json_build_object('nodes',e.nodes,'connections',e.connections),'history',json_build_object('nodes',h.nodes,'connections',h.connections))
    FROM workflow_entity e JOIN workflow_history h ON h."workflowId"=e.id AND h."versionId"=e."activeVersionId" WHERE e.id=${lit(WORKFLOW_ID)};`;
  const text = (await run(conn, PSQL, sql)).trim();
  assert.ok(text, 'Workflow de erros não encontrado');
  return JSON.parse(text);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const snap = await inspect(conn);
    assert.equal(snap.active, true, 'Workflow de erros precisa estar ativo');
    assert.equal(snap.versionId, snap.activeVersionId, 'Há rascunho não publicado; não sobrescrevo');
    assert.equal(fingerprint(snap.entity), fingerprint(snap.history), 'Entity e histórico diferentes; não sobrescrevo');
    const candidate = patchErrorWorkflow(snap.entity);
    for (const node of candidate.nodes) if (node.parameters?.jsCode) new Function('$', '$json', '$input', '$getWorkflowStaticData', node.parameters.jsCode);
    const summary = { workflowId: WORKFLOW_ID, before: fingerprint(snap.entity), after: fingerprint(candidate), nodes: candidate.nodes.map((node) => node.name) };
    if (summary.before === summary.after) { console.log(JSON.stringify({ ...summary, alreadyApplied: true })); return; }
    if (!apply) { console.log(JSON.stringify({ ...summary, dryRun: true })); return; }
    const id = lit(WORKFLOW_ID), version = lit(snap.activeVersionId);
    const cas = `BEGIN;
DO $cas$ DECLARE affected integer; BEGIN
 UPDATE workflow_entity SET nodes=${jsonSql(candidate.nodes)},connections=${jsonSql(candidate.connections)},"updatedAt"=CURRENT_TIMESTAMP
  WHERE id=${id} AND "activeVersionId"=${version} AND "versionId"=${version}
  AND nodes::jsonb=(${jsonSql(snap.entity.nodes)})::jsonb AND connections::jsonb=(${jsonSql(snap.entity.connections)})::jsonb;
 GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'CAS entity falhou'; END IF;
 UPDATE workflow_history SET nodes=${jsonSql(candidate.nodes)},connections=${jsonSql(candidate.connections)},"updatedAt"=CURRENT_TIMESTAMP
  WHERE "workflowId"=${id} AND "versionId"=${version}
  AND nodes::jsonb=(${jsonSql(snap.entity.nodes)})::jsonb AND connections::jsonb=(${jsonSql(snap.entity.connections)})::jsonb;
 GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'CAS histórico falhou'; END IF;
END $cas$;
COMMIT;`;
    await run(conn, PSQL, cas);
    const after = await inspect(conn);
    assert.equal(fingerprint(after.entity), summary.after, 'Entity publicada difere do candidato');
    assert.equal(fingerprint(after.history), summary.after, 'Histórico publicado difere do candidato');
    console.log(JSON.stringify({ ...summary, applied: true }));
  } finally { conn.end(); }
}

if (require.main === module) main().catch((error) => { console.error(String(error.message).slice(0, 300)); process.exitCode = 1; });
module.exports = { fingerprint };

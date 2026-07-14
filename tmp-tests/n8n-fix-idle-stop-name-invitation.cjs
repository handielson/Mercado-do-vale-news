const path = require('path');

const workspace = path.resolve(__dirname, '..', '..', '..', 'mercado-do-vale');
try {
  require('dotenv').config({ path: path.join(workspace, '.env.vps.local') });
  require('dotenv').config({ path: path.join(workspace, '.env.local') });
} catch {}
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const TARGET_NODE = 'Dividir mensagens';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  }));
}

function psql(conn, db, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    });
  });
}

async function waitService(conn, service, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await runRemote(conn, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

function patchSplitCode(code) {
  let next = String(code || '');
  if (next.includes('customerEndsConversation')) return next;
  const historyMarker = `const recentHistory = String($json.conversationHistory || source.conversationHistory || contact.conversationHistory || '');`;
  const guardCode = `${historyMarker}
const customerTextForInvitation = String($json.conversation || source.conversation || contact.conversation || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').replace(/\\s+/g, ' ').trim();
const customerShortDecline = /^(?:n|na+o+)(?: (?:obrigad[oa]|obg|valeu|agora|por enquanto))?$/.test(customerTextForInvitation);
const customerExplicitClose = /\\b(?:por enquanto (?:nao|nada)|nao (?:quero|preciso) mais|nao preciso de mais nada|pode (?:encerrar|parar)|so isso|deixa pra la|ate mais|tchau)\\b/.test(customerTextForInvitation);
const customerEndsConversation = customerShortDecline || customerExplicitClose;`;
  if (!next.includes(historyMarker)) throw new Error('Conversation history marker not found');
  next = next.replace(historyMarker, guardCode);
  const inviteMarker = `const shouldInviteName = !alreadyInvitedInHistory && Boolean(remoteJid) && !savedName && !prepared.possibleName && !staticData.optionalCustomerName[remoteJid];`;
  const guardedInvite = `const shouldInviteName = !customerEndsConversation && !alreadyInvitedInHistory && Boolean(remoteJid) && !savedName && !prepared.possibleName && !staticData.optionalCustomerName[remoteJid];`;
  if (!next.includes(inviteMarker)) throw new Error('Optional name invitation marker not found');
  next = next.replace(inviteMarker, guardedInvite);
  new Function(next);
  return next;
}

async function main() {
  const { Client } = require('ssh2');
  const dryRun = process.argv.includes('--dry-run');
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!db) throw new Error('n8n Postgres container not found');
    const raw = await psql(conn, db, `COPY (
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    const node = nodes.find((item) => item.name === TARGET_NODE);
    if (!node) throw new Error(`${TARGET_NODE} not found`);
    node.parameters.jsCode = patchSplitCode(node.parameters.jsCode);

    if (dryRun) {
      console.log(JSON.stringify({ dryRun: true, workflowId: WORKFLOW_ID, node: TARGET_NODE, patched: true }));
      return;
    }

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const result = await psql(conn, db, `\\set ON_ERROR_STOP on
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodesjson')}::json, connections=${dollar(JSON.stringify(connections), 'connectionsjson')}::json, "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'historynodesjson')}::json, connections=${dollar(JSON.stringify(connections), 'historyconnectionsjson')}::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};
COPY (
  SELECT json_build_object(
    'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
    'hasConversationEndGuard', EXISTS(SELECT 1 FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->>'name'=${shQuote(TARGET_NODE)} AND node->'parameters'->>'jsCode' LIKE '%customerEndsConversation%')
  )::text
  FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
  WHERE we.id=${shQuote(WORKFLOW_ID)}
) TO STDOUT;`);

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;
    console.log(result.trim().split(/\r?\n/).filter(Boolean).pop());
  } catch (error) {
    if (servicesStopped) {
      try {
        await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
        await waitService(conn, 'n8n_n8n', 1);
        await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
        await waitService(conn, 'n8n_n8n-runner', 1);
      } catch (_) {}
    }
    throw error;
  } finally {
    conn.end();
  }
}

module.exports = { patchSplitCode };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

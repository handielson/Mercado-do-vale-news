const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MDV_API_URL = 'https://api.xiaomipetrolina.com.br';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote tag collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `Remote command failed: ${code}`));
      });
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

async function psql(conn, dbContainer, sql) {
  return runRemote(conn, `docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A <<'SQL'\n${sql}\nSQL`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitServiceReplicas(conn, serviceName, expectedReplicas, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  const expected = `${expectedReplicas}/${expectedReplicas}`;
  let last = '';
  while (Date.now() < deadline) {
    last = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(serviceName)} --format '{{.Replicas}}' | head -n 1`
    )).trim();
    if (last === expected) return last;
    await sleep(3000);
  }
  throw new Error(`Service ${serviceName} did not reach ${expected}; last replicas: ${last || 'unknown'}`);
}

async function readJson(conn, dbContainer, sql) {
  const out = await psql(conn, dbContainer, `COPY (${sql}) TO STDOUT;`);
  return JSON.parse(out.trim());
}

const clientControlCode = `const source = $json;
const remoteJid = String(source.remoteJid || '');
const staticData = $getWorkflowStaticData('global');
const baseOutput = {
  ...source,
  n8nBotBlocked: false,
  n8nBotResetApplied: false,
  n8nBotControl: null,
  memorySessionKey: remoteJid,
};

if (!remoteJid) {
  return [{ json: baseOutput }];
}

const syncKey = $env.SYNC_SECRET || '';
if (!syncKey) {
  return [{ json: baseOutput }];
}

let payload = null;
try {
  const inboundText = String(source.conversation || source.text || source.message || '').trim();
  if (inboundText) {
    await fetch('${MDV_API_URL}/n8n-bot/messages/log', {
      method: 'POST',
      headers: {
        'x-sync-key': syncKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        remoteJid,
        direction: 'inbound',
        message: inboundText,
        messageType: source.messageType || 'text',
        sourceNode: 'Controle Bot - Verificar Cliente',
        waMessageId: source.messageId || source.id || source.key?.id || '',
      }),
    });
  }
} catch (error) {}

try {
  const response = await fetch('${MDV_API_URL}/n8n-bot/client-control?remoteJid=' + encodeURIComponent(remoteJid), {
    headers: { 'x-sync-key': syncKey },
  });
  if (response.ok) payload = await response.json();
} catch (error) {
  payload = null;
}

if (!payload || !payload.control) {
  return [{ json: baseOutput }];
}

const control = payload.control || {};
const output = {
  ...baseOutput,
  n8nBotBlocked: Boolean(control.blocked),
  n8nBotControl: control,
  memorySessionKey: payload.memorySessionKey || remoteJid,
};

if (payload.resetPending) {
  staticData.salesPostList = staticData.salesPostList || {};
  delete staticData.salesPostList[remoteJid];
  output.n8nBotResetApplied = true;
  try {
    await fetch('${MDV_API_URL}/n8n-bot/client-control/consume-reset', {
      method: 'POST',
      headers: {
        'x-sync-key': syncKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ remoteJid }),
    });
  } catch (error) {}
}

return [{ json: output }];`;

const outboundLoggerCode = `const syncKey = $env.SYNC_SECRET || '';
if (!syncKey) return $input.all();

const items = $input.all();
for (const item of items) {
  const data = item.json || {};
  const remoteJid = String(data.remoteJid || $('Controle Bot - Verificar Cliente').first().json.remoteJid || '');
  const text = String(data.message || data.text || data.output || '').trim();
  if (!remoteJid || !text) continue;
  try {
    await fetch('${MDV_API_URL}/n8n-bot/messages/log', {
      method: 'POST',
      headers: {
        'x-sync-key': syncKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        remoteJid,
        direction: 'outbound',
        message: text,
        messageType: 'text',
        sourceNode: 'Controle Bot - Registrar Saida',
        payload: {
          messageIndex: data.messageIndex || null,
          totalMessages: data.totalMessages || null,
        },
      }),
    });
  } catch (error) {}
}

return items;`;

function makeIfNode() {
  return {
    id: 'n8n-admin-control-blocked-if-001',
    name: 'Controle Bot - Bloqueado?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [528, 80],
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
          version: 2,
        },
        conditions: [
          {
            id: 'n8n-admin-control-blocked-condition',
            leftValue: '={{$json.n8nBotBlocked}}',
            rightValue: true,
            operator: {
              type: 'boolean',
              operation: 'true',
              singleValue: true,
            },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
  };
}

function upsertNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

function patchMemoryNode(node) {
  if (!node?.parameters) node.parameters = {};
  node.parameters.sessionIdType = 'customKey';
  node.parameters.sessionKey = "={{ $('Controle Bot - Verificar Cliente').first().json.memorySessionKey || $('switc Mensagens').first().json.remoteJid }}";
}

function patchGraph(nodes, connections) {
  upsertNode(nodes, {
    id: 'n8n-admin-client-control-001',
    name: 'Controle Bot - Verificar Cliente',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [384, 80],
    parameters: { jsCode: clientControlCode },
  });

  upsertNode(nodes, makeIfNode());

  upsertNode(nodes, {
    id: 'n8n-admin-client-outbound-log-001',
    name: 'Controle Bot - Registrar Saida',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1472, 80],
    parameters: { jsCode: outboundLoggerCode },
  });

  for (const node of nodes) {
    if (node.name === 'Memoria de contexto postggress' || node.name === 'Memoria Vendas') {
      patchMemoryNode(node);
    }
  }

  connections['switc Mensagens'] = {
    main: [[{ node: 'Controle Bot - Verificar Cliente', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Verificar Cliente'] = {
    main: [[{ node: 'Controle Bot - Bloqueado?', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Bloqueado?'] = {
    main: [
      [],
      [{ node: 'Handoff - Verificar pausa', type: 'main', index: 0 }],
    ],
  };

  if (connections['Dividir mensagens']?.main?.[0]) {
    connections['Dividir mensagens'] = {
      main: [[{ node: 'Controle Bot - Registrar Saida', type: 'main', index: 0 }]],
    };
    connections['Controle Bot - Registrar Saida'] = {
      main: [[{ node: 'Enviar WhatsApp', type: 'main', index: 0 }]],
    };
  }
}

async function ensureN8nSyncSecretEnv(conn) {
  const command = `
set -eu
secret="$(grep -E '^SYNC_SECRET=' /var/www/mdv-api/.env | tail -n 1 | cut -d= -f2-)"
if [ -z "$secret" ]; then
  echo "SYNC_SECRET missing in /var/www/mdv-api/.env" >&2
  exit 1
fi
for service in n8n_n8n n8n_n8n-runner; do
  docker service update --env-rm SYNC_SECRET "$service" >/dev/null 2>&1 || true
  docker service update --env-add "SYNC_SECRET=$secret" "$service" >/dev/null
done
`;
  await runRemote(conn, command);
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  try {
    const dbContainer = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    if (!dbContainer) throw new Error('n8n Postgres container not found');

    await ensureN8nSyncSecretEnv(conn);
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 0);

    const entity = await readJson(conn, dbContainer, `
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'activeVersionId', "activeVersionId"
      )::text
      FROM workflow_entity
      WHERE id = ${shQuote(WORKFLOW_ID)}
    `);

    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchGraph(nodes, connections);

    const updateSql = `
\\set ON_ERROR_STOP on

UPDATE workflow_entity
SET nodes = ${dollar(JSON.stringify(nodes), 'nodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'connjson')}::json,
    "updatedAt" = NOW()
WHERE id = ${shQuote(WORKFLOW_ID)};

UPDATE workflow_history
SET nodes = ${dollar(JSON.stringify(nodes), 'histnodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'histconnjson')}::json,
    "updatedAt" = NOW()
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)}
  AND "versionId" = ${shQuote(entity.activeVersionId)};

COPY (
  SELECT json_build_object(
    'switchTarget', connections::jsonb #> '{"switc Mensagens",main,0,0,node}',
    'controlBlockedTarget', connections::jsonb #> '{"Controle Bot - Bloqueado?",main,0}',
    'controlContinueTarget', connections::jsonb #> '{"Controle Bot - Bloqueado?",main,1,0,node}',
    'outboundLoggerTarget', connections::jsonb #> '{"Dividir mensagens",main,0,0,node}',
    'memoryNodes', (
      SELECT json_agg(node->>'name')
      FROM jsonb_array_elements(nodes::jsonb) AS node
      WHERE node->'parameters'->>'sessionKey' LIKE '%memorySessionKey%'
    )
  )::text
  FROM workflow_entity
  WHERE id = ${shQuote(WORKFLOW_ID)}
) TO STDOUT;
`;
    const result = await psql(conn, dbContainer, updateSql);

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);

    console.log(result.trim().split(/\r?\n/).filter(Boolean).pop());
  } catch (error) {
    try {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    } catch (_) {}
    throw error;
  } finally {
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

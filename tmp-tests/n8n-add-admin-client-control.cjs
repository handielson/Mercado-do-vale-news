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

async function psqlFile(conn, dbContainer, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A`, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || stdout || `Remote psql failed: ${code}`));
      });
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.end(sql);
    });
  });
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

return [{ json: baseOutput }];`;

const applyClientControlCode = `const source = $('Controle Bot - Verificar Cliente').first().json || {};
const payload = $json || {};
const remoteJid = String(source.remoteJid || '');
const staticData = $getWorkflowStaticData('global');
const baseOutput = {
  ...source,
  n8nBotBlocked: false,
  n8nBotResetApplied: false,
  n8nBotControl: null,
  memorySessionKey: remoteJid,
};

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
}

return [{ json: output }];`;

const restoreClientControlCode = `return [{ json: $('Controle Bot - Aplicar Controle').first().json }];`;

const restoreOutboundCode = `return $('Dividir mensagens').all();`;

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

function patchTransientHttpNode(node) {
  node.onError = 'continueRegularOutput';
  node.continueOnFail = true;
  node.retryOnFail = true;
  node.maxTries = 3;
  node.waitBetweenTries = 2000;
}

function patchPostListPhotoFallback(node) {
  const code = String(node?.parameters?.jsCode || '');
  const oldBlock = `if (!activeState || !Array.isArray(activeState.options) || activeState.options.length === 0) {
  return buildContinueItem();
}`;
  const newBlock = `if (!activeState || !Array.isArray(activeState.options) || activeState.options.length === 0) {
  if (wantsPhoto) {
    return [{
      json: {
        ...source,
        salesPostListHandled: true,
        output: 'Consigo te mandar a foto sim 😊 Me confirma o numero do item ou o modelo que voce quer ver?',
      },
    }];
  }
  return buildContinueItem();
}`;
  if (code.includes(oldBlock) && !code.includes('Me confirma o numero do item ou o modelo')) {
    node.parameters.jsCode = code.replace(oldBlock, newBlock);
  }
}

function makeHttpNode({ id, name, position, method = 'GET', url, bodyParameters = [] }) {
  const node = {
    id,
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
    onError: 'continueRegularOutput',
    continueOnFail: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 1500,
    parameters: {
      method,
      url,
      options: {},
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'x-sync-key', value: '={{$env.SYNC_SECRET}}' }],
      },
    },
  };
  if (method !== 'GET') {
    node.parameters.sendBody = true;
    node.parameters.bodyParameters = { parameters: bodyParameters };
  }
  return node;
}

function makeResetPendingIfNode() {
  return {
    id: 'n8n-admin-control-reset-if-001',
    name: 'Controle Bot - Reset pendente?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [816, 80],
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
            id: 'n8n-admin-control-reset-condition',
            leftValue: '={{$json.n8nBotResetApplied}}',
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

function patchGraph(nodes, connections) {
  upsertNode(nodes, {
    id: 'n8n-admin-client-control-001',
    name: 'Controle Bot - Verificar Cliente',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [384, 80],
    parameters: { jsCode: clientControlCode },
  });

  upsertNode(nodes, makeHttpNode({
    id: 'n8n-admin-client-inbound-log-001',
    name: 'Controle Bot - Registrar Entrada',
    position: [528, -112],
    method: 'POST',
    url: `${MDV_API_URL}/n8n-bot/messages/log`,
    bodyParameters: [
      { name: 'remoteJid', value: "={{ $('Controle Bot - Verificar Cliente').first().json.remoteJid }}" },
      { name: 'direction', value: 'inbound' },
      { name: 'message', value: "={{ $('Controle Bot - Verificar Cliente').first().json.conversation || $('Controle Bot - Verificar Cliente').first().json.text || $('Controle Bot - Verificar Cliente').first().json.message || '' }}" },
      { name: 'messageType', value: "={{ $('Controle Bot - Verificar Cliente').first().json.messageType || 'text' }}" },
      { name: 'sourceNode', value: 'Controle Bot - Registrar Entrada' },
      { name: 'waMessageId', value: "={{ $('Controle Bot - Verificar Cliente').first().json.messageId || $('Controle Bot - Verificar Cliente').first().json.id || $('Controle Bot - Verificar Cliente').first().json.key?.id || '' }}" },
    ],
  }));

  upsertNode(nodes, makeHttpNode({
    id: 'n8n-admin-client-control-fetch-001',
    name: 'Controle Bot - Buscar Controle',
    position: [672, -112],
    method: 'GET',
    url: `={{'${MDV_API_URL}/n8n-bot/client-control?remoteJid=' + encodeURIComponent($('Controle Bot - Verificar Cliente').first().json.remoteJid)}}`,
  }));

  upsertNode(nodes, {
    id: 'n8n-admin-client-control-apply-001',
    name: 'Controle Bot - Aplicar Controle',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [816, -112],
    parameters: { jsCode: applyClientControlCode },
  });

  upsertNode(nodes, makeResetPendingIfNode());

  upsertNode(nodes, makeHttpNode({
    id: 'n8n-admin-client-control-reset-consume-001',
    name: 'Controle Bot - Consumir Reset',
    position: [960, -208],
    method: 'POST',
    url: `${MDV_API_URL}/n8n-bot/client-control/consume-reset`,
    bodyParameters: [
      { name: 'remoteJid', value: "={{ $('Controle Bot - Aplicar Controle').first().json.remoteJid }}" },
    ],
  }));

  upsertNode(nodes, {
    id: 'n8n-admin-client-control-restore-001',
    name: 'Controle Bot - Restaurar Controle',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1104, -208],
    parameters: { jsCode: restoreClientControlCode },
  });

  upsertNode(nodes, makeIfNode());

  upsertNode(nodes, makeHttpNode({
    id: 'n8n-admin-client-outbound-log-001',
    name: 'Controle Bot - Registrar Saida',
    position: [1472, 80],
    method: 'POST',
    url: `${MDV_API_URL}/n8n-bot/messages/log`,
    bodyParameters: [
      { name: 'remoteJid', value: "={{$json.remoteJid || $('Controle Bot - Verificar Cliente').first().json.remoteJid}}" },
      { name: 'direction', value: 'outbound' },
      { name: 'message', value: '={{$json.message || $json.caption || $json.text || $json.output || ""}}' },
      { name: 'messageType', value: '={{$json.messageType || "text"}}' },
      { name: 'sourceNode', value: 'Controle Bot - Registrar Saida' },
      { name: 'payload', value: '={{JSON.stringify({ messageIndex: $json.messageIndex || null, totalMessages: $json.totalMessages || null, mediaUrl: $json.mediaUrl || "" })}}' },
    ],
  }));

  upsertNode(nodes, {
    id: 'n8n-admin-client-outbound-restore-001',
    name: 'Controle Bot - Restaurar Saida',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1600, 80],
    parameters: { jsCode: restoreOutboundCode },
  });

  for (const node of nodes) {
    if (node.name === 'Memoria de contexto postggress' || node.name === 'Memoria Vendas') {
      patchMemoryNode(node);
    }
    if (node.name === 'Vendas - Buscar Taxas' || node.name === 'Vendas - Buscar Produtos') {
      patchTransientHttpNode(node);
    }
    if (node.name === 'Vendas - Verificar Pos Lista') {
      patchPostListPhotoFallback(node);
    }
  }

  connections['switc Mensagens'] = {
    main: [[{ node: 'Controle Bot - Verificar Cliente', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Verificar Cliente'] = {
    main: [[{ node: 'Controle Bot - Registrar Entrada', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Registrar Entrada'] = {
    main: [[{ node: 'Controle Bot - Buscar Controle', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Buscar Controle'] = {
    main: [[{ node: 'Controle Bot - Aplicar Controle', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Aplicar Controle'] = {
    main: [[{ node: 'Controle Bot - Reset pendente?', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Reset pendente?'] = {
    main: [
      [{ node: 'Controle Bot - Consumir Reset', type: 'main', index: 0 }],
      [{ node: 'Controle Bot - Bloqueado?', type: 'main', index: 0 }],
    ],
  };
  connections['Controle Bot - Consumir Reset'] = {
    main: [[{ node: 'Controle Bot - Restaurar Controle', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Restaurar Controle'] = {
    main: [[{ node: 'Controle Bot - Bloqueado?', type: 'main', index: 0 }]],
  };
  connections['Controle Bot - Bloqueado?'] = {
    main: [
      [],
      [{ node: 'Handoff - Verificar pausa', type: 'main', index: 0 }],
    ],
  };

  if (connections['Dividir mensagens']?.main?.[0]) {
    const hasImageRouter = nodes.some((node) => node.name === 'Enviar WhatsApp - Tipo imagem?');
    const sendAfterLogger = hasImageRouter ? 'Enviar WhatsApp - Tipo imagem?' : 'Enviar WhatsApp';
    connections['Dividir mensagens'] = {
      main: [[{ node: 'Controle Bot - Registrar Saida', type: 'main', index: 0 }]],
    };
    connections['Controle Bot - Registrar Saida'] = {
      main: [[{ node: 'Controle Bot - Restaurar Saida', type: 'main', index: 0 }]],
    };
    connections['Controle Bot - Restaurar Saida'] = {
      main: [[{ node: sendAfterLogger, type: 'main', index: 0 }]],
    };
    if (hasImageRouter) {
      connections['Enviar WhatsApp - Tipo imagem?'] = {
        main: [
          [{ node: 'Enviar WhatsApp - Imagem', type: 'main', index: 0 }],
          [{ node: 'Enviar WhatsApp', type: 'main', index: 0 }],
        ],
      };
    }
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
    'outboundAfterLoggerTarget', connections::jsonb #> '{"Controle Bot - Registrar Saida",main,0,0,node}',
    'imageTrueTarget', connections::jsonb #> '{"Enviar WhatsApp - Tipo imagem?",main,0,0,node}',
    'imageFalseTarget', connections::jsonb #> '{"Enviar WhatsApp - Tipo imagem?",main,1,0,node}',
    'transientHttpNodes', (
      SELECT json_agg(json_build_object(
        'name', node->>'name',
        'onError', node->>'onError',
        'retryOnFail', node->>'retryOnFail',
        'maxTries', node->>'maxTries'
      ))
      FROM jsonb_array_elements(nodes::jsonb) AS node
      WHERE node->>'name' IN ('Vendas - Buscar Taxas', 'Vendas - Buscar Produtos')
    ),
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
    const result = await psqlFile(conn, dbContainer, updateSql);

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

const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function dollar(value, tag) {
  return `$${tag}$${String(value).replace(new RegExp(`\\$${tag}\\$`, 'g'), '')}$${tag}$`;
}

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
    });
  });
}

function psql(conn, dbContainer, sql) {
  return new Promise((resolve, reject) => {
    conn.exec(`docker exec -i ${shQuote(dbContainer)} psql -U postgres -d n8n -X -q -t -A`, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`))
      ));
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.end(sql);
    });
  });
}

async function waitServiceReplicas(conn, serviceName, expected, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const replicas = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(serviceName)} --format '{{.Replicas}}' | head -n 1`,
    )).trim();
    if (replicas === `${expected}/${expected}`) return replicas;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`Timed out waiting for ${serviceName} replicas ${expected}/${expected}`);
}

function readJson(conn, dbContainer, sql) {
  return psql(conn, dbContainer, `COPY (${sql}) TO STDOUT;`).then((text) => JSON.parse(text.trim()));
}

const oldDeliveryCepBlock = `if (activeState?.step === 'awaiting_delivery_zip') {
  const cep = cepFromText(text);
  if (!cep) {
    activeState.step = 'awaiting_delivery_location';
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Sem problema. Me manda sua localizacao pelo WhatsApp que eu localizo o endereco.') } }];
  }
  const found = await lookupDeliveryCep(cep);
  if (!found) {
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Nao consegui localizar esse CEP.' + lineBreak + 'Pode conferir os 8 numeros ou me mandar sua localizacao pelo WhatsApp?') } }];
  }
  activeState.step = 'awaiting_delivery_number_complement';
  activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAddress: found };
  activeState.updatedAt = new Date(now).toISOString();
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Encontrei este endereco:' + lineBreak + addressText(found) + lineBreak + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.') } }];
}`;

const newDeliveryCepBlock = `if (activeState?.step === 'awaiting_delivery_zip') {
  const cep = cepFromText(text);
  if (!cep) {
    activeState.step = 'awaiting_delivery_location';
    activeState.updatedAt = new Date(now).toISOString();
    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Sem problema. Me manda sua localizacao pelo WhatsApp que eu localizo o endereco.') } }];
  }
  return [{ json: {
    ...source,
    salesPostListHandled: true,
    salesPostListStep: activeState.step,
    needsDeliveryCepLookup: true,
    deliveryCep: cep,
    orderDraft: activeState.orderDraft,
  } }];
}`;

const resolveCepCode = `const source = $('Vendas - Verificar Pos Lista').first().json || {};
const response = $json || {};
const staticData = $getWorkflowStaticData('global');
staticData.salesPostList = staticData.salesPostList || {};

const remoteJid = String(source.remoteJid || '');
const activeState = remoteJid ? staticData.salesPostList[remoteJid] : null;
const lineBreak = '||';
const withGreeting = (message) => message;
const onlyDigits = (value) => String(value || '').replace(/\\D/g, '');
const formatCep = (value) => {
  const digits = onlyDigits(value);
  return digits.length === 8 ? digits.replace(/^(\\d{5})(\\d{3})$/, '$1-$2') : digits;
};
const addressText = (address) => [
  [address.street, address.number].filter(Boolean).join(', '),
  address.complement || '',
  address.neighborhood || '',
  [address.city, address.state].filter(Boolean).join('/'),
  address.cep ? 'CEP: ' + formatCep(address.cep) : '',
].filter(Boolean).join(lineBreak);

const found = response && !response.erro && (response.logradouro || response.bairro || response.localidade || response.uf)
  ? {
      cep: source.deliveryCep || onlyDigits(response.cep),
      street: response.logradouro || '',
      neighborhood: response.bairro || '',
      city: response.localidade || '',
      state: response.uf || '',
      latitude: '',
      longitude: '',
    }
  : null;

if (!activeState || activeState.step !== 'awaiting_delivery_zip') {
  return [{ json: { ...source, salesPostListHandled: true, output: withGreeting('Me manda novamente o CEP para eu localizar o endereco de entrega.') } }];
}

if (!found) {
  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, output: withGreeting('Nao consegui localizar esse CEP.' + lineBreak + 'Pode conferir os 8 numeros ou me mandar sua localizacao pelo WhatsApp?') } }];
}

activeState.step = 'awaiting_delivery_number_complement';
activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAddress: found };
activeState.updatedAt = new Date().toISOString();

return [{ json: {
  ...source,
  needsDeliveryCepLookup: false,
  salesPostListHandled: true,
  salesPostListStep: activeState.step,
  orderDraft: activeState.orderDraft,
  output: withGreeting('Encontrei este endereco:' + lineBreak + addressText(found) + lineBreak + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.'),
} }];`;

function addOrReplaceNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

function patchPostListCode(nodes) {
  const node = nodes.find((item) => item.name === 'Vendas - Verificar Pos Lista');
  if (!node) throw new Error('Vendas - Verificar Pos Lista not found');
  let code = String(node.parameters?.jsCode || '');
  if (!code.includes('needsDeliveryCepLookup: true')) {
    if (!code.includes(oldDeliveryCepBlock)) throw new Error('Delivery CEP block not found');
    code = code.replace(oldDeliveryCepBlock, newDeliveryCepBlock);
  }
  node.parameters.jsCode = code;
  new Function('$json', '$getWorkflowStaticData', '$env', code);
}

function patchWorkflow(nodes, connections) {
  patchPostListCode(nodes);

  addOrReplaceNode(nodes, {
    id: 'sales-delivery-needs-cep-http-001',
    name: 'Vendas - Precisa buscar CEP?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [2128, 448],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{
          id: 'sales-delivery-needs-cep-http-condition',
          leftValue: '={{$json.needsDeliveryCepLookup}}',
          rightValue: true,
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        }],
        combinator: 'and',
      },
      options: {},
    },
  });

  addOrReplaceNode(nodes, {
    id: 'sales-delivery-cep-http-001',
    name: 'Vendas - Buscar CEP ViaCEP',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [2368, 336],
    parameters: {
      url: "={{'https://viacep.com.br/ws/' + $json.deliveryCep + '/json/'}}",
      options: {},
    },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 1500,
    continueOnFail: true,
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  });

  addOrReplaceNode(nodes, {
    id: 'sales-delivery-resolve-cep-http-001',
    name: 'Vendas - Resolver CEP HTTP',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2608, 336],
    parameters: { jsCode: resolveCepCode },
  });
  new Function('$json', '$getWorkflowStaticData', resolveCepCode);

  connections['Vendas - Verificar Pos Lista'] = {
    main: [[{ node: 'Vendas - Precisa buscar CEP?', type: 'main', index: 0 }]],
  };
  connections['Vendas - Precisa buscar CEP?'] = {
    main: [
      [{ node: 'Vendas - Buscar CEP ViaCEP', type: 'main', index: 0 }],
      [{ node: 'Vendas - Pos Lista resolvido?', type: 'main', index: 0 }],
    ],
  };
  connections['Vendas - Buscar CEP ViaCEP'] = {
    main: [[{ node: 'Vendas - Resolver CEP HTTP', type: 'main', index: 0 }]],
  };
  connections['Vendas - Resolver CEP HTTP'] = {
    main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]],
  };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig());
  });

  let servicesStopped = false;
  try {
    const dbContainer = (await runRemote(
      conn,
      "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1",
    )).trim();
    if (!dbContainer) throw new Error('n8n Postgres container not found');

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 0);
    servicesStopped = true;

    const entity = await readJson(conn, dbContainer, `
      SELECT json_build_object(
        'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
        'versionId', "versionId",
        'activeVersionId', "activeVersionId"
      )::text
      FROM workflow_entity
      WHERE id = ${shQuote(WORKFLOW_ID)}
    `);

    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes, connections);

    const versionIds = Array.from(new Set([entity.versionId, entity.activeVersionId])).filter(Boolean);
    const versionList = versionIds.map(shQuote).join(',');

    const updateSql = `
\\set ON_ERROR_STOP on

UPDATE workflow_entity
SET nodes = ${dollar(JSON.stringify(nodes), 'nodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'connjson')}::json,
    "versionId" = "activeVersionId",
    "updatedAt" = NOW()
WHERE id = ${shQuote(WORKFLOW_ID)};

UPDATE workflow_history
SET nodes = ${dollar(JSON.stringify(nodes), 'histnodesjson')}::json,
    connections = ${dollar(JSON.stringify(connections), 'histconnjson')}::json,
    "updatedAt" = NOW()
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)}
  AND "versionId" IN (${versionList});

COPY (
  SELECT json_build_object(
    'versionAligned', (SELECT "versionId" = "activeVersionId" FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}),
    'needsCepNode', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Precisa buscar CEP?'),
    'cepHttpNode', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Buscar CEP ViaCEP'),
    'resolverNode', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Resolver CEP HTTP'),
    'codeNoFetchCep', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Verificar Pos Lista' AND node->'parameters'->>'jsCode' LIKE '%needsDeliveryCepLookup: true%')
  )::text
) TO STDOUT;
`;
    const result = JSON.parse((await psql(conn, dbContainer, updateSql)).trim());

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitServiceReplicas(conn, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
    }
    conn.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

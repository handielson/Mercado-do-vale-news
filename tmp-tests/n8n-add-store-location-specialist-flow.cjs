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

const storeLocationCode = `const source = $('Parse Classificacao').first().json || $json || {};
const company = $json || {};
const address = String(company.address || '').trim();
const lat = company.address_lat == null ? '' : String(company.address_lat).trim();
const lng = company.address_lng == null ? '' : String(company.address_lng).trim();
const hasCoords = lat && lng && lat !== '0' && lng !== '0';
const query = hasCoords ? (lat + ',' + lng) : address;
const mapsLink = query ? 'https://maps.google.com/?q=' + encodeURIComponent(query) : '';

const lines = [
  'Claro 😊',
  'A loja fica neste endereco:',
  address || 'Endereco nao cadastrado no sistema.',
  mapsLink ? 'Localizacao no mapa: ' + mapsLink : '',
  'Quando vier, e so chamar por aqui se precisar de ajuda. 📍',
].filter(Boolean);

return [{ json: { ...source, output: lines.join('||') } }];`;

function patchClassifierSystemMessage(message) {
  let next = String(message || '');
  if (!next.includes('- localizacao_loja')) {
    next = next.replace('- horario_loja\n- formas_pagamento', '- horario_loja\n- localizacao_loja\n- formas_pagamento');
    next = next.replace('- formas_pagamento\n- fallback', '- localizacao_loja\n- formas_pagamento\n- fallback');
  }
  if (!next.includes('localizacao ou endereco da loja')) {
    next = next.replace(
      '- Perguntas sobre formas de pagamento, boleto, link de pagamento, cartao, Pix, dinheiro, transferencia bancaria ou usados como entrada: formas_pagamento.\n',
      '- Perguntas sobre formas de pagamento, boleto, link de pagamento, cartao, Pix, dinheiro, transferencia bancaria ou usados como entrada: formas_pagamento.\n- Perguntas sobre onde fica, endereco, localizacao, mapa, rota ou ponto fisico da loja: localizacao_loja.\n',
    );
  }
  return next;
}

function patchParseClassifier(code) {
  let next = String(code || '');
  next = next.replace(
    "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'horario_loja', 'formas_pagamento', 'fallback']);",
    "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'horario_loja', 'localizacao_loja', 'formas_pagamento', 'fallback']);",
  );
  next = next.replace(
    "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'horario_loja', 'fallback']);",
    "const allowed = new Set(['saudacao', 'vendas_produtos', 'cadastro_contato', 'pos_venda', 'pedido_humano', 'horario_loja', 'localizacao_loja', 'fallback']);",
  );
  if (!next.includes('const storeLocationIntent =')) {
    next = next.replace(
      "const paymentPolicyIntent = /\\b(formas? de pagamento|forma de pagar|como posso pagar|aceita pix|aceita cartao|cartao de credito|cartao de debito|debito|credito|boleto|usado|usados|troca|entrada|link de pagamento|pagamento por link)\\b/.test(normalizedMessageForIntent);\nconst intencao = storeHoursIntent\n  ? 'horario_loja'\n  : (paymentPolicyIntent ? 'formas_pagamento' : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback'));",
      "const paymentPolicyIntent = /\\b(formas? de pagamento|forma de pagar|como posso pagar|aceita pix|aceita cartao|cartao de credito|cartao de debito|debito|credito|boleto|usado|usados|troca|entrada|link de pagamento|pagamento por link)\\b/.test(normalizedMessageForIntent);\nconst storeLocationIntent = /\\b(onde fica|onde e|endereco|endereco da loja|localizacao|localizacao da loja|manda a localizacao|manda o endereco|mapa|maps|rota|como chegar)\\b/.test(normalizedMessageForIntent)\n  && /\\b(loja|mercado do vale|voces|voce|ai|endereco|localizacao|mapa|maps|rota)\\b/.test(normalizedMessageForIntent);\nconst intencao = storeHoursIntent\n  ? 'horario_loja'\n  : (storeLocationIntent ? 'localizacao_loja' : (paymentPolicyIntent ? 'formas_pagamento' : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback')));",
    );
    next = next.replace(
      "const intencao = storeHoursIntent\n  ? 'horario_loja'\n  : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback');",
      "const storeLocationIntent = /\\b(onde fica|onde e|endereco|endereco da loja|localizacao|localizacao da loja|manda a localizacao|manda o endereco|mapa|maps|rota|como chegar)\\b/.test(normalizedMessageForIntent)\n  && /\\b(loja|mercado do vale|voces|voce|ai|endereco|localizacao|mapa|maps|rota)\\b/.test(normalizedMessageForIntent);\nconst intencao = storeHoursIntent\n  ? 'horario_loja'\n  : (storeLocationIntent ? 'localizacao_loja' : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback'));",
    );
  }
  if (!next.includes('storeLocationIntent')) throw new Error('Could not patch store location intent');
  new Function('$json', next);
  return next;
}

function ensureSwitchOutput(nodes, connections) {
  const switchNode = nodes.find((node) => node.name === 'Switch Especialistas');
  if (!switchNode) throw new Error('Switch Especialistas not found');
  const values = switchNode.parameters?.rules?.values || [];
  const exists = values.some((rule) => rule.outputKey === 'localizacao_loja' || JSON.stringify(rule).includes('localizacao_loja'));
  if (!exists) {
    const fallbackIndex = values.findIndex((rule) => rule.outputKey === 'fallback');
    const rule = {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        combinator: 'and',
        conditions: [{
          id: 'intent-localizacao-loja',
          operator: { type: 'string', operation: 'equals' },
          leftValue: '={{$json.intencao}}',
          rightValue: 'localizacao_loja',
        }],
      },
      renameOutput: true,
      outputKey: 'localizacao_loja',
    };
    if (fallbackIndex >= 0) values.splice(fallbackIndex, 0, rule);
    else values.push(rule);
  }

  const fallbackTarget = [{ node: 'Agente Geral - Atendimento', type: 'main', index: 0 }];
  const main = connections['Switch Especialistas']?.main || [];
  const desiredIndex = values.findIndex((rule) => rule.outputKey === 'localizacao_loja');
  while (main.length < values.length) main.push(fallbackTarget);
  main[desiredIndex] = [{ node: 'Loja - Buscar Dados Empresa', type: 'main', index: 0 }];
  connections['Switch Especialistas'] = { main };
}

function addOrReplaceNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

function patchWorkflow(nodes, connections) {
  const classifier = nodes.find((node) => node.name === 'Agente Inicial - Classificador');
  const parse = nodes.find((node) => node.name === 'Parse Classificacao');
  if (!classifier || !parse) throw new Error('Required nodes not found');

  if (classifier.parameters?.options?.systemMessage) {
    classifier.parameters.options.systemMessage = patchClassifierSystemMessage(classifier.parameters.options.systemMessage);
  }
  parse.parameters.jsCode = patchParseClassifier(parse.parameters.jsCode);

  addOrReplaceNode(nodes, {
    id: 'store-location-company-settings-001',
    name: 'Loja - Buscar Dados Empresa',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [2080, 176],
    parameters: {
      url: 'https://api.xiaomipetrolina.com.br/public/company-settings',
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
    id: 'store-location-specialist-001',
    name: 'Loja - Localizacao',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2320, 176],
    parameters: { jsCode: storeLocationCode },
  });
  new Function('$json', storeLocationCode);

  ensureSwitchOutput(nodes, connections);
  connections['Loja - Buscar Dados Empresa'] = { main: [[{ node: 'Loja - Localizacao', type: 'main', index: 0 }]] };
  connections['Loja - Localizacao'] = { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] };
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
    'storeLocationIntent', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Parse Classificacao' AND node->'parameters'->>'jsCode' LIKE '%localizacao_loja%'),
    'storeLocationFetchNode', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Loja - Buscar Dados Empresa'),
    'storeLocationNode', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Loja - Localizacao'),
    'storeLocationMaps', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Loja - Localizacao' AND node->'parameters'->>'jsCode' LIKE '%maps.google.com%')
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
      await waitServiceReplicas(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitServiceReplicas(conn, 'n8n_n8n-runner', 1).catch(() => {});
    }
    conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

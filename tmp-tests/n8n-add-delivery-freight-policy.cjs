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

const deliveryFreightHelpers = `const DELIVERY_FREIGHT_TABLE = {
  freeUrbanAreas: [
    { city: 'Petrolina', state: 'PE', label: 'area urbana de Petrolina-PE' },
    { city: 'Juazeiro', state: 'BA', label: 'area urbana de Juazeiro-BA' },
  ],
  specialAreas: [
    // Edite aqui quando tivermos bairros/localidades com valor proprio.
    // Exemplo: { city: 'Petrolina', state: 'PE', neighborhoods: ['Projeto Nilo Coelho'], motoboyFeeCents: 6000, customerShareCents: 3000 }
  ],
  ruralKeywords: ['zona rural', 'interior', 'sitio', 'sitio', 'fazenda', 'projeto', 'nucleo', 'assentamento', 'povoado', 'ilha'],
  defaultMotoboyFeeCents: 5000,
  storeShareCents: 2500,
  customerShareCents: 2500,
};
const freightNormalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\\u0300-\\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\\s]/g, ' ')
  .replace(/\\s+/g, ' ')
  .trim();
const freightMoney = (cents) => (Math.round(Number(cents || 0)) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const deliveryFreightQuote = (address = {}) => {
  const city = freightNormalize(address.city || address.localidade || '');
  const state = freightNormalize(address.state || address.uf || '');
  const neighborhood = freightNormalize(address.neighborhood || address.bairro || address.rawLocation || '');
  const text = freightNormalize([address.street, address.neighborhood, address.city, address.state, address.rawLocation].filter(Boolean).join(' '));
  const special = DELIVERY_FREIGHT_TABLE.specialAreas.find((area) =>
    freightNormalize(area.city) === city
    && freightNormalize(area.state) === state
    && (area.neighborhoods || []).some((item) => neighborhood.includes(freightNormalize(item)) || text.includes(freightNormalize(item)))
  );
  if (special) {
    const motoboyFeeCents = Number(special.motoboyFeeCents || DELIVERY_FREIGHT_TABLE.defaultMotoboyFeeCents);
    const customerShareCents = Number(special.customerShareCents ?? Math.round(motoboyFeeCents / 2));
    return {
      free: customerShareCents <= 0,
      reason: 'area cadastrada na tabela de frete',
      motoboyFeeCents,
      storeShareCents: Math.max(0, motoboyFeeCents - customerShareCents),
      customerShareCents,
    };
  }
  const freeCity = DELIVERY_FREIGHT_TABLE.freeUrbanAreas.find((area) =>
    freightNormalize(area.city) === city && freightNormalize(area.state) === state
  );
  const looksRural = DELIVERY_FREIGHT_TABLE.ruralKeywords.some((word) => neighborhood.includes(word) || text.includes(word));
  if (freeCity && !looksRural) {
    return { free: true, reason: freeCity.label, motoboyFeeCents: 0, storeShareCents: 0, customerShareCents: 0 };
  }
  return {
    free: false,
    reason: freeCity ? 'fora da area urbana cadastrada' : 'fora da area urbana gratuita',
    motoboyFeeCents: DELIVERY_FREIGHT_TABLE.defaultMotoboyFeeCents,
    storeShareCents: DELIVERY_FREIGHT_TABLE.storeShareCents,
    customerShareCents: DELIVERY_FREIGHT_TABLE.customerShareCents,
  };
};
const deliveryFreightLine = (quote) => {
  if (!quote || quote.free) return 'Entrega gratuita para area urbana de Petrolina-PE e Juazeiro-BA.';
  return 'Frete estimado: motoboy ' + freightMoney(quote.motoboyFeeCents) + '. A loja assume ' + freightMoney(quote.storeShareCents) + ' e fica ' + freightMoney(quote.customerShareCents) + ' para o cliente.';
};`;

const deliveryPolicyCode = `${deliveryFreightHelpers}
const source = $json || {};
const genericQuote = deliveryFreightQuote({});
const output = [
  'Entrega gratuita para area urbana de Petrolina-PE e Juazeiro-BA. 🛵',
  'Para outras localidades dentro dessas cidades, eu preciso do CEP ou endereco para confirmar o frete.',
  'Quando tiver taxa de motoboy, a loja divide com o cliente. Exemplo: se o motoboy cobrar ' + freightMoney(genericQuote.motoboyFeeCents) + ', a loja assume ' + freightMoney(genericQuote.storeShareCents) + ' e fica ' + freightMoney(genericQuote.customerShareCents) + ' para o cliente.',
  'Enquanto cadastramos as regioes na tabela, fora da area urbana usamos essa base inicial de ' + freightMoney(DELIVERY_FREIGHT_TABLE.defaultMotoboyFeeCents) + '.',
].join('||');
return [{ json: { ...source, output } }];`;

function patchClassifierSystemMessage(message) {
  let next = String(message || '');
  if (!next.includes('- entrega_frete')) {
    next = next.replace('- formas_pagamento\n', '- formas_pagamento\n- entrega_frete\n');
    next = next.replace('- fallback\n', '- entrega_frete\n- fallback\n');
  }
  if (!next.includes('frete ou taxa de entrega')) {
    next = next.replace(
      '- Perguntas sobre formas de pagamento, boleto, link de pagamento, cartao, Pix, dinheiro, transferencia bancaria ou usados como entrada: formas_pagamento.\n',
      '- Perguntas sobre formas de pagamento, boleto, link de pagamento, cartao, Pix, dinheiro, transferencia bancaria ou usados como entrada: formas_pagamento.\n- Perguntas sobre entrega, frete, taxa de entrega, motoboy, entrega gratis ou area atendida: entrega_frete.\n',
    );
  }
  return next;
}

function patchParseClassifier(code) {
  let next = String(code || '');
  next = next.replace(/const allowed = new Set\(\[([^\]]*)\]\);/, (match, values) => {
    if (values.includes('entrega_frete')) return match;
    return match.replace("'formas_pagamento'", "'formas_pagamento', 'entrega_frete'");
  });
  if (!next.includes('const deliveryFreightIntent =')) {
    next = next.replace(
      '\nconst botIdentityIntent =',
      "\nconst deliveryFreightIntent = /\\b(frete|taxa de entrega|valor da entrega|entrega gratis|entrega gratuita|motoboy|cobra entrega|quanto e a entrega|quanto custa a entrega|area de entrega|faz entrega)\\b/.test(normalizedMessageForIntent);\nconst botIdentityIntent =",
    );
  }
  next = next.replace(
    /const intencao =[\s\S]*?;\nconst venda =/,
    "const intencao = botIdentityIntent\n  ? 'identidade_bot'\n  : (storeHoursIntent ? 'horario_loja' : (storeLocationIntent ? 'localizacao_loja' : (paymentPolicyIntent ? 'formas_pagamento' : (deliveryFreightIntent ? 'entrega_frete' : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback')))));\nconst venda =",
  );
  if (!next.includes('deliveryFreightIntent')) throw new Error('Could not patch delivery freight intent');
  new Function('$json', next);
  return next;
}

function patchPostListCode(code) {
  let next = String(code || '');
  if (!next.includes('DELIVERY_FREIGHT_TABLE')) {
    next = next.replace("const lineBreak = '||';", "const lineBreak = '||';\n" + deliveryFreightHelpers);
  }
  next = next.replace(
    "output: withGreeting('Combinado: entrega.' + lineBreak + 'Me manda o CEP para eu localizar o endereco de entrega.')",
    "output: withGreeting('Combinado: entrega.' + lineBreak + 'Entrega gratuita para area urbana de Petrolina-PE e Juazeiro-BA.' + lineBreak + 'Para outras localidades, eu confirmo o frete pelo endereco. Me manda o CEP para eu localizar a entrega.')",
  );
  next = next.replace(
    "parts.push('Entrega: ' + [\n      [address.street, draft.deliveryNumberComplement].filter(Boolean).join(', '),\n      address.neighborhood,\n      [address.city, address.state].filter(Boolean).join('/'),\n    ].filter(Boolean).join(' - '));",
    "parts.push('Entrega: ' + [\n      [address.street, draft.deliveryNumberComplement].filter(Boolean).join(', '),\n      address.neighborhood,\n      [address.city, address.state].filter(Boolean).join('/'),\n    ].filter(Boolean).join(' - '));\n    if (draft.deliveryFreight) parts.push('Frete: ' + (draft.deliveryFreight.free ? 'gratis' : formatMoney(draft.deliveryFreight.customerShareCents)));",
  );
  next = next.replace(
    "activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAddress: { rawLocation: text || 'localizacao enviada pelo WhatsApp' } };",
    "const rawFreight = deliveryFreightQuote({ rawLocation: text || 'localizacao enviada pelo WhatsApp' });\n  activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAddress: { rawLocation: text || 'localizacao enviada pelo WhatsApp' }, deliveryFreight: rawFreight };",
  );
  next = next.replace(
    "output: withGreeting('Recebi sua localizacao.' + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.')",
    "output: withGreeting('Recebi sua localizacao.' + lineBreak + deliveryFreightLine(rawFreight) + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.')",
  );
  new Function('$json', '$getWorkflowStaticData', '$env', next);
  return next;
}

function patchCepResolverCode(code) {
  let next = String(code || '');
  if (!next.includes('DELIVERY_FREIGHT_TABLE')) {
    next = next.replace("const lineBreak = '||';", "const lineBreak = '||';\n" + deliveryFreightHelpers);
  }
  next = next.replace(
    "activeState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAddress: found };",
    "const freight = deliveryFreightQuote(found);\nactiveState.orderDraft = { ...activeState.orderDraft, fulfillment: 'delivery', deliveryAddress: found, deliveryFreight: freight };",
  );
  next = next.replace(
    "output: withGreeting('Encontrei este endereco:' + lineBreak + addressText(found) + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.'),",
    "output: withGreeting('Encontrei este endereco:' + lineBreak + addressText(found) + lineBreak + deliveryFreightLine(freight) + lineBreak + 'Agora me manda o numero da casa e complemento, se tiver.'),",
  );
  new Function('$json', '$getWorkflowStaticData', next);
  return next;
}

function addOrReplaceNode(nodes, node) {
  const index = nodes.findIndex((item) => item.name === node.name);
  if (index >= 0) nodes[index] = { ...nodes[index], ...node };
  else nodes.push(node);
}

function ensureSwitchOutput(nodes, connections) {
  const switchNode = nodes.find((node) => node.name === 'Switch Especialistas');
  if (!switchNode) throw new Error('Switch Especialistas not found');
  const values = switchNode.parameters?.rules?.values || [];
  const exists = values.some((rule) => rule.outputKey === 'entrega_frete' || JSON.stringify(rule).includes('entrega_frete'));
  if (!exists) {
    const fallbackIndex = values.findIndex((rule) => rule.outputKey === 'fallback');
    const rule = {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        combinator: 'and',
        conditions: [{
          id: 'intent-entrega-frete',
          operator: { type: 'string', operation: 'equals' },
          leftValue: '={{$json.intencao}}',
          rightValue: 'entrega_frete',
        }],
      },
      renameOutput: true,
      outputKey: 'entrega_frete',
    };
    if (fallbackIndex >= 0) values.splice(fallbackIndex, 0, rule);
    else values.push(rule);
  }
  const fallbackTarget = [{ node: 'Agente Geral - Atendimento', type: 'main', index: 0 }];
  const main = connections['Switch Especialistas']?.main || [];
  const desiredIndex = values.findIndex((rule) => rule.outputKey === 'entrega_frete');
  while (main.length < values.length) main.push(fallbackTarget);
  main[desiredIndex] = [{ node: 'Entrega - Politica', type: 'main', index: 0 }];
  connections['Switch Especialistas'] = { main };
}

function patchWorkflow(nodes, connections) {
  const classifier = nodes.find((node) => node.name === 'Agente Inicial - Classificador');
  const parse = nodes.find((node) => node.name === 'Parse Classificacao');
  const postList = nodes.find((node) => node.name === 'Vendas - Verificar Pos Lista');
  const cepResolver = nodes.find((node) => node.name === 'Vendas - Resolver CEP HTTP');
  if (!classifier || !parse || !postList || !cepResolver) throw new Error('Required nodes not found');

  if (classifier.parameters?.options?.systemMessage) {
    classifier.parameters.options.systemMessage = patchClassifierSystemMessage(classifier.parameters.options.systemMessage);
  }
  parse.parameters.jsCode = patchParseClassifier(parse.parameters.jsCode);
  postList.parameters.jsCode = patchPostListCode(postList.parameters.jsCode);
  cepResolver.parameters.jsCode = patchCepResolverCode(cepResolver.parameters.jsCode);

  addOrReplaceNode(nodes, {
    id: 'delivery-freight-policy-001',
    name: 'Entrega - Politica',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2080, 464],
    parameters: { jsCode: deliveryPolicyCode },
  });
  new Function('$json', deliveryPolicyCode);

  ensureSwitchOutput(nodes, connections);
  connections['Entrega - Politica'] = { main: [[{ node: 'Dividir mensagens', type: 'main', index: 0 }]] };
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
        'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex')
      )::text
      FROM workflow_entity
      WHERE id = ${shQuote(WORKFLOW_ID)}
    `);

    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes, connections);

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
WHERE "workflowId" = ${shQuote(WORKFLOW_ID)};

COPY (
  SELECT json_build_object(
    'versionAligned', (SELECT "versionId" = "activeVersionId" FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}),
    'deliveryFreightIntent', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Parse Classificacao' AND node->'parameters'->>'jsCode' LIKE '%entrega_frete%'),
    'deliveryPolicyNode', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Entrega - Politica'),
    'freightTable', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->'parameters'->>'jsCode' LIKE '%DELIVERY_FREIGHT_TABLE%'),
    'noBadSourceKeys', NOT EXISTS(SELECT 1 FROM workflow_entity, jsonb_object_keys(connections::jsonb) key WHERE id=${shQuote(WORKFLOW_ID)} AND NOT EXISTS (SELECT 1 FROM workflow_entity we2, jsonb_array_elements(we2.nodes::jsonb) node WHERE we2.id=${shQuote(WORKFLOW_ID)} AND node->>'name'=key))
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

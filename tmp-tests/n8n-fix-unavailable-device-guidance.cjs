const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const SMARTPHONES_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';

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

function patchClassifierSystemMessage(message) {
  let next = String(message || '');
  if (!next.includes('Regra de marcas sem contexto')) {
    next += `

Regra de marcas sem contexto:
- Se o cliente mencionar somente uma marca ampla como Samsung, Motorola, Xiaomi, Apple, Realme ou Infinix sem dizer o tipo de produto, mantenha vendas_produtos e deixe a busca com a marca. O fluxo ira confirmar se ele esta falando de celulares.
- Se o cliente perguntar por celular, smartphone, aparelho, iPhone, Galaxy, Samsung, Motorola, Xiaomi, Redmi, Poco, Realme ou Infinix, trate como vendas_produtos.
- Se o cliente confirmar com "sim", "isso", "celular" ou equivalente depois de uma pergunta sobre celulares, classifique como vendas_produtos.
`;
  }
  return next;
}

function patchGeneralAgentSystemMessage(message) {
  let next = String(message || '');
  if (!next.includes('Regra para mensagem so com pontuacao')) {
    next += `

Regra para mensagem so com pontuacao:
- Se o cliente enviar apenas "?", "??", "!" ou pontuacao sem contexto, peca para ele me dizer qual produto ou duvida quer ver. Nao invente assunto.
- Nunca fale de endereco, cidade, loja fisica ou Sao Paulo se o cliente nao pediu localizacao explicitamente.
`;
  }
  return next;
}

function patchParseClassifier(code) {
  let next = String(code || '');
  if (next.includes('deviceClarificationConfirmed')) return next;

  const marker = "const normalizedMessageForIntent = String(source.conversation || parsed.mensagem || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();";
  const insert = `${marker}
const remoteJidForDeviceClarification = String(source.remoteJid || '');
const staticDataForDeviceClarification = $getWorkflowStaticData('global');
const pendingDeviceClarification = remoteJidForDeviceClarification
  ? staticDataForDeviceClarification.pendingDeviceClarification?.[remoteJidForDeviceClarification]
  : null;
const pendingDeviceClarificationActive = Boolean(pendingDeviceClarification?.expiresAt && pendingDeviceClarification.expiresAt > Date.now());
const deviceClarificationYes = pendingDeviceClarificationActive
  && /^\\s*(sim|s|isso|isso mesmo|celular|celulares|smartphone|smartphones|aparelho|aparelhos|telefone|telefones|exato|pode ser)\\s*[.!?]*\\s*$/i.test(String(source.conversation || parsed.mensagem || ''));
if (deviceClarificationYes && remoteJidForDeviceClarification) {
  delete staticDataForDeviceClarification.pendingDeviceClarification[remoteJidForDeviceClarification];
}`;
  if (!next.includes(marker)) throw new Error('Parse Classificacao normalize marker not found');
  next = next.replace(marker, insert);

  const intencaoPattern = /const intencao = botIdentityIntent[\s\S]*?\)\)\)\)\)\);\nconst venda =/;
  const intencaoReplacement = `const baseIntencao = botIdentityIntent
  ? 'identidade_bot'
  : (storeHoursIntent ? 'horario_loja' : (storeLocationIntent ? 'localizacao_loja' : (paymentPolicyIntent ? 'formas_pagamento' : (deliveryFreightIntent ? 'entrega_frete' : (atacadoRevendaIntent ? 'atacado_revenda' : (allowed.has(String(parsed.intencao || '').trim()) ? String(parsed.intencao).trim() : 'fallback'))))));
const intencao = deviceClarificationYes ? 'vendas_produtos' : baseIntencao;
const venda =`;
  if (!intencaoPattern.test(next)) throw new Error('Parse Classificacao intencao block not found');
  next = next.replace(intencaoPattern, intencaoReplacement);

  const vendaMarker = "const fluxoVenda = parsed.fluxo_venda && typeof parsed.fluxo_venda === 'object' && !Array.isArray(parsed.fluxo_venda) ? parsed.fluxo_venda : {};";
  const vendaInsert = `${vendaMarker}
const effectiveVenda = deviceClarificationYes
  ? { tipo: 'categoria', busca: '', categoria: 'smartphones', categoria_id: '${SMARTPHONES_CATEGORY_ID}' }
  : venda;`;
  if (!next.includes(vendaMarker)) throw new Error('Parse Classificacao venda marker not found');
  next = next.replace(vendaMarker, vendaInsert);

  next = next
    .replace("salesRequestKind: String(venda.tipo || '').trim(),", "salesRequestKind: String(effectiveVenda.tipo || '').trim(),")
    .replace("salesSearchQuery: String(venda.busca || '').trim(),", "salesSearchQuery: String(effectiveVenda.busca || '').trim(),")
    .replace("salesCategoryName: String(venda.categoria || '').trim(),", "salesCategoryName: String(effectiveVenda.categoria || '').trim(),")
    .replace("salesCategoryId: String(venda.categoria_id || '').trim(),", "salesCategoryId: String(effectiveVenda.categoria_id || '').trim(),");

  next = next.replace(
    "salesFlowNewSearchTerm: String(fluxoVenda.termo_nova_busca || '').trim(),",
    "salesFlowNewSearchTerm: String(fluxoVenda.termo_nova_busca || '').trim(),\n    deviceClarificationConfirmed: deviceClarificationYes,\n    requestedDeviceBrand: deviceClarificationYes ? String(pendingDeviceClarification?.brand || '').trim() : '',",
  );

  new Function('$json', '$', '$getWorkflowStaticData', next);
  return next;
}

function patchSalesPrepareSearch(code) {
  let next = String(code || '');
  if (next.includes('requestedDeviceBrand')) return next;

  const brandBlockMarker = `const SMARTPHONES_CATEGORY_ID = '${SMARTPHONES_CATEGORY_ID}';`;
  const brandBlock = `${brandBlockMarker}
const deviceBrandAliases = {
  samsung: ['samsung', 'galaxy'],
  iphone: ['iphone', 'apple'],
  motorola: ['motorola', 'moto'],
  xiaomi: ['xiaomi', 'redmi', 'poco'],
  realme: ['realme'],
  infinix: ['infinix'],
};
const deviceBrandLabels = {
  samsung: 'Samsung',
  iphone: 'iPhone',
  motorola: 'Motorola',
  xiaomi: 'Xiaomi',
  realme: 'Realme',
  infinix: 'Infinix',
};
const detectDeviceBrand = (text) => {
  const normalizedText = normalize(text);
  for (const [brand, aliases] of Object.entries(deviceBrandAliases)) {
    if (aliases.some((alias) => new RegExp('\\\\b' + alias + '\\\\b').test(normalizedText))) return brand;
  }
  return '';
};`;
  if (!next.includes(brandBlockMarker)) throw new Error('Vendas - Preparar Busca smartphone category marker not found');
  next = next.replace(brandBlockMarker, brandBlock);

  const afterTokensMarker = `const tokens = normalized
  .split(' ')
  .map((token) => token.trim())
  .filter((token) => token && !stopwords.has(token));`;
  const afterTokens = `${afterTokensMarker}

const requestedDeviceBrand = String(source.requestedDeviceBrand || detectDeviceBrand([rawText, classifiedSearchQuery].filter(Boolean).join(' '))).trim();
const explicitDeviceWords = ['celular', 'celulares', 'smartphone', 'smartphones', 'aparelho', 'aparelhos', 'telefone', 'telefones', 'iphone'];
const explicitPhoneDeviceRequest = explicitDeviceWords.some((word) => normalized.includes(word)) || /\\b(iphone|galaxy)\\b/.test(normalized);
const broadBrandOnlyRequest = Boolean(requestedDeviceBrand)
  && tokens.length === 1
  && tokens[0] !== 'iphone'
  && !explicitPhoneDeviceRequest
  && !classifiedCategoryId;
const forceSmartphoneCategory = Boolean(source.deviceClarificationConfirmed || (requestedDeviceBrand && explicitPhoneDeviceRequest));`;
  if (!next.includes(afterTokensMarker)) throw new Error('Vendas - Preparar Busca tokens marker not found');
  next = next.replace(afterTokensMarker, afterTokens);

  const searchBlock = `let productSearchTerm = classifiedCategoryId
  ? (classifiedCategoryName || 'smartphones')
  : classifiedSearchQuery || (isGenericPhoneRequest ? 'smartphones' : tokens.join(' ').trim());
if (!productSearchTerm) productSearchTerm = normalized || rawText.trim();
const productCategoryId = classifiedCategoryId || (isGenericPhoneRequest ? SMARTPHONES_CATEGORY_ID : '');`;
  const searchReplacement = `let productSearchTerm = classifiedCategoryId || forceSmartphoneCategory
  ? (classifiedCategoryName || 'smartphones')
  : classifiedSearchQuery || (isGenericPhoneRequest ? 'smartphones' : tokens.join(' ').trim());
if (!productSearchTerm) productSearchTerm = normalized || rawText.trim();
const productCategoryId = classifiedCategoryId || (isGenericPhoneRequest || forceSmartphoneCategory ? SMARTPHONES_CATEGORY_ID : '');`;
  if (!next.includes(searchBlock)) throw new Error('Vendas - Preparar Busca search block not found');
  next = next.replace(searchBlock, searchReplacement);

  next = next.replace(
    "productSearchOriginalText: rawText,",
    "productSearchOriginalText: rawText,\n    requestedDeviceBrand,\n    requestedDeviceBrandLabel: requestedDeviceBrand ? (deviceBrandLabels[requestedDeviceBrand] || requestedDeviceBrand) : '',\n    needsDeviceClarification: broadBrandOnlyRequest,\n    deviceClarificationConfirmed: source.deviceClarificationConfirmed === true,\n    explicitPhoneDeviceRequest,",
  );

  new Function('$json', next);
  return next;
}

function patchProductContext(code) {
  let next = String(code || '');
  if (next.includes('unavailableDeviceIntroMessage')) return next;

  const prefersMarker = `const prefersSmartphones = smartphoneWords.some((word) => searchText.includes(word))
  && !accessoryWords.some((word) => searchText.includes(word));`;
  const clarificationBlock = `${prefersMarker}

if (base.needsDeviceClarification === true) {
  const remoteJid = String(base.remoteJid || $('switc Mensagens').first().json.remoteJid || '');
  const brand = String(base.requestedDeviceBrand || '').trim();
  const brandLabel = String(base.requestedDeviceBrandLabel || brand || 'essa marca').trim();
  if (remoteJid && brand) {
    const staticData = $getWorkflowStaticData('global');
    staticData.pendingDeviceClarification = staticData.pendingDeviceClarification || {};
    staticData.pendingDeviceClarification[remoteJid] = {
      brand,
      brandLabel,
      categoryId: '${SMARTPHONES_CATEGORY_ID}',
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
  }
  return [{
    json: {
      ...base,
      productLookupFound: false,
      productLookupCount: 0,
      productInStock: [],
      output: 'O senhor esta falando de celulares ' + brandLabel + '?',
    },
  }];
}`;
  if (!next.includes(prefersMarker)) throw new Error('Vendas - Contexto Produtos prefersSmartphones marker not found');
  next = next.replace(prefersMarker, clarificationBlock);

  const productsLine = `const products = sortedProducts.slice(0, isCompleteCategoryRequest ? sortedProducts.length : 6);`;
  const productsReplacement = `const requestedDeviceBrand = String(base.requestedDeviceBrand || '').trim();
const requestedDeviceBrandLabel = String(base.requestedDeviceBrandLabel || requestedDeviceBrand || '').trim();
const brandAliases = {
  samsung: ['samsung', 'galaxy'],
  iphone: ['iphone', 'apple'],
  motorola: ['motorola', 'moto'],
  xiaomi: ['xiaomi', 'redmi', 'poco'],
  realme: ['realme'],
  infinix: ['infinix'],
};
const productMatchesRequestedBrand = (product) => {
  if (!requestedDeviceBrand) return false;
  const aliases = brandAliases[requestedDeviceBrand] || [requestedDeviceBrand];
  const text = normalize([product.name, product.brand, product.category].filter(Boolean).join(' '));
  return aliases.some((alias) => new RegExp('\\\\b' + alias + '\\\\b').test(text));
};
const primaryDeviceProducts = (prefersSmartphones || Boolean(base.productCategoryId))
  ? sortedProducts.filter((product) => toNumber(product.priority) < 3)
  : sortedProducts;
const matchingRequestedBrandProducts = requestedDeviceBrand
  ? primaryDeviceProducts.filter((product) => productMatchesRequestedBrand(product))
  : [];
const unavailableRequestedDevice = Boolean(requestedDeviceBrand && matchingRequestedBrandProducts.length === 0);
let productsSource = requestedDeviceBrand
  ? (matchingRequestedBrandProducts.length > 0 ? matchingRequestedBrandProducts : primaryDeviceProducts)
  : sortedProducts;
const productsLimit = isCompleteCategoryRequest || unavailableRequestedDevice ? productsSource.length : 6;
const products = productsSource.slice(0, productsLimit);
const unavailableDeviceIntroMessage = unavailableRequestedDevice
  ? 'Esse ' + (requestedDeviceBrandLabel || 'modelo') + ' acabou todo estoque no momento e estamos aguardando reposicao.'
  : '';`;
  if (!next.includes(productsLine)) throw new Error('Vendas - Contexto Produtos products slice not found');
  next = next.replace(productsLine, productsReplacement);

  next = next.replace(
    "quoteLines.push('📱 Orçamento');",
    "quoteLines.push(unavailableRequestedDevice ? 'Celulares disponiveis agora' : '📱 Orçamento');",
  );
  next = next.replace(
    "output: [greetingLine, ...quoteMessages].filter(Boolean).join('[[MSG]]'),",
    "output: [greetingLine, unavailableDeviceIntroMessage, ...quoteMessages].filter(Boolean).join('[[MSG]]'),",
  );

  new Function('$json', '$input', '$getWorkflowStaticData', '$', next);
  return next;
}

function patchWorkflow(nodes) {
  const classifier = nodes.find((node) => node.name === 'Agente Inicial - Classificador');
  const generalAgent = nodes.find((node) => node.name === 'Agente Geral - Atendimento');
  const parse = nodes.find((node) => node.name === 'Parse Classificacao');
  const prepareSearch = nodes.find((node) => node.name === 'Vendas - Preparar Busca');
  const productContext = nodes.find((node) => node.name === 'Vendas - Contexto Produtos');
  if (!classifier || !generalAgent || !parse || !prepareSearch || !productContext) {
    throw new Error('Required n8n nodes not found');
  }

  if (classifier.parameters?.options?.systemMessage) {
    classifier.parameters.options.systemMessage = patchClassifierSystemMessage(classifier.parameters.options.systemMessage);
  }
  if (generalAgent.parameters?.options?.systemMessage) {
    generalAgent.parameters.options.systemMessage = patchGeneralAgentSystemMessage(generalAgent.parameters.options.systemMessage);
  }
  parse.parameters.jsCode = patchParseClassifier(parse.parameters.jsCode);
  prepareSearch.parameters.jsCode = patchSalesPrepareSearch(prepareSearch.parameters.jsCode);
  productContext.parameters.jsCode = patchProductContext(productContext.parameters.jsCode);
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
        'activeVersionId', "activeVersionId"
      )::text
      FROM workflow_entity
      WHERE id = ${shQuote(WORKFLOW_ID)}
    `);

    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    patchWorkflow(nodes);

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
    'parsePendingState', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Parse Classificacao' AND node->'parameters'->>'jsCode' LIKE '%pendingDeviceClarification%'),
    'prepareBrandDetection', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Preparar Busca' AND node->'parameters'->>'jsCode' LIKE '%requestedDeviceBrand%'),
    'contextUnavailableIntro', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Vendas - Contexto Produtos' AND node->'parameters'->>'jsCode' LIKE '%unavailableDeviceIntroMessage%'),
    'punctuationPromptGuard', EXISTS(SELECT 1 FROM workflow_entity, jsonb_array_elements(nodes::jsonb) node WHERE id=${shQuote(WORKFLOW_ID)} AND node->>'name'='Agente Geral - Atendimento' AND node->'parameters'->'options'->>'systemMessage' LIKE '%Regra para mensagem so com pontuacao%')
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
  console.error(error.stack || error.message);
  process.exit(1);
});

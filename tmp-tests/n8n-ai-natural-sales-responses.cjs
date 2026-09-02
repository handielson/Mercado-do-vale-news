const assert = require('node:assert/strict');
const path = require('node:path');
const { Client } = require('ssh2');

for (const file of ['.env.vps.local', '.env.local']) {
  require('dotenv').config({ path: path.join(__dirname, '..', file), quiet: true });
}

const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const PREPARE_NODE = 'Vendas - Preparar Busca';
const CONTEXT_NODE = 'Vendas - Contexto Produtos';
const AGENT_NODE = 'Especialista - Vendas';
const MODEL_NODE = 'OpenAI Vendas';
const ROUTER_NODE = 'Vendas - Produto encontrado?';
const COMPOSER_NODE = 'Vendas - Compor Resposta IA';
const HANDOFF_PREPARE_NODE = 'Vendas - Preparar Handoff Especialista';
const SPLIT_NODE = 'Dividir mensagens';
const MARKER = 'sales-ai-natural-response-v322';
const APPLY = process.argv.includes('--apply');

const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function runRemote(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => (
      code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`))
    ));
  }));
}

function psql(connection, database, sql) {
  return new Promise((resolve, reject) => {
    connection.exec(`docker exec -i ${shQuote(database)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`))
      ));
      stream.end(sql);
    });
  });
}

function waitService(connection, service, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const replicas = (await runRemote(
          connection,
          `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`,
        )).trim();
        if (replicas === `${expected}/${expected}`) return resolve();
        if (Date.now() >= deadline) return reject(new Error(`${service} did not reach ${expected}/${expected}`));
        setTimeout(check, 2500);
      } catch (error) {
        reject(error);
      }
    };
    check();
  });
}

function findNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  assert.ok(node, `Node not found: ${name}`);
  return node;
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  assert.notEqual(first, -1, `Anchor not found: ${label}`);
  assert.equal(source.indexOf(search, first + search.length), -1, `Anchor duplicated: ${label}`);
  return source.replace(search, replacement);
}

function replaceRegexOnce(source, expression, replacement, label) {
  const matches = source.match(new RegExp(expression.source, expression.flags.includes('g') ? expression.flags : `${expression.flags}g`)) || [];
  assert.equal(matches.length, 1, `Expected one ${label} match, found ${matches.length}`);
  return source.replace(expression, replacement);
}

function patchPrepareSearch(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`${MARKER}:budget`)) return;

  const oldBudget = `const priceContextV288 = /\\b(?:ate|maximo|limite|orcamento|investir|gastar|faixa|valor|preco)\\b|r\\$/i.test(rawFilterTextV288);
const bareBudgetContinuationV288 = /^\\s*(?:r\\$\\s*)?\\d{2,6}(?:[.,]\\d{1,2})?\\s*$/i.test(rawFilterTextV288)
  && Boolean(source.n8nBotControl?.sales_preferences?.active || previousSalesFiltersV288.cameraQuality || previousSalesFiltersV288.cameraPriority || previousSalesFiltersV288.screenQuality || previousSalesFiltersV288.screenPriority || previousSalesFiltersV288.nfc || previousSalesFiltersV288.ramGb?.length || previousSalesFiltersV288.storageGb?.length);
if (priceContextV288 || bareBudgetContinuationV288) {
  const moneyMatch = rawFilterTextV288.match(/(?:r\\$\\s*)?(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{1,2})?|\\d{2,6}(?:[.,]\\d{1,2})?)/i);
  const cents = parseMoneyCentsV288(moneyMatch?.[1] || '');
  if (cents) salesFilterPatchV288.maxPriceCents = cents;
}`;
  const newBudget = `// ${MARKER}:budget
// A consulta de preco de um modelo numerico nao e um limite de compra.
// So aceite orcamento quando houver moeda, uma expressao real de limite ou
// uma resposta composta apenas pelo valor dentro de uma conversa de filtros.
const explicitCurrencyBudgetV322 = rawFilterTextV288.match(/\\br\\$\\s*(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d{1,6}(?:[.,]\\d{1,2})?)(?![\\d.])/i);
const explicitBudgetPhraseV322 = normalizedFilterTextV288.match(/\\b(?:ate|maximo|limite|orcamento|investir|gastar|faixa)\\b[^0-9]{0,30}(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d{1,6}(?:[.,]\\d{1,2})?)(?![\\d.])/i);
const bareBudgetContinuationV288 = /^\\s*(?:r\\$\\s*)?(?:\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d{2,6}(?:[.,]\\d{1,2})?)\\s*$/i.test(rawFilterTextV288)
  && Boolean(source.n8nBotControl?.sales_preferences?.active || previousSalesFiltersV288.cameraQuality || previousSalesFiltersV288.cameraPriority || previousSalesFiltersV288.screenQuality || previousSalesFiltersV288.screenPriority || previousSalesFiltersV288.nfc || previousSalesFiltersV288.ramGb?.length || previousSalesFiltersV288.storageGb?.length);
const budgetAmountV322 = explicitCurrencyBudgetV322?.[1]
  || explicitBudgetPhraseV322?.[1]
  || (bareBudgetContinuationV288 ? rawFilterTextV288 : '');
if (budgetAmountV322) {
  const cents = parseMoneyCentsV288(budgetAmountV322);
  if (cents) salesFilterPatchV288.maxPriceCents = cents;
}`;
  code = replaceOnce(code, oldBudget, newBudget, 'budget parser');

  const modelAnchor = `const requestedDeviceModelLabel = requestedDeviceModelQuery || '';`;
  code = replaceOnce(code, modelAnchor, `${modelAnchor}
// ${MARKER}:exact-model-budget
// Uma busca por modelo exato deve informar a disponibilidade real do modelo,
// sem herdar um teto de preco de uma conversa anterior ou de um parse incorreto.
if (specificDeviceModelRequest && !budgetAmountV322) mergedSalesFiltersV288.maxPriceCents = 0;`, 'exact model budget reset');

  new Function('$json', code);
  node.parameters.jsCode = code;
}

function patchProductContext(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`${MARKER}:facts`)) return;

  const clarificationOutput = `      productInStock: [],
      output: 'O senhor esta falando de celulares ' + brandLabel + '?',`;
  code = replaceOnce(code, clarificationOutput, `      productInStock: [],
      productsInStock: [],
      productsContext: '',
      deterministicCatalogOutput: '',
      salesAvailabilityStatus: 'needs_device_clarification',
      requiresSpecialistHandoff: false,
      output: '',`, 'device clarification canned response');

  code = replaceRegexOnce(
    code,
    /const unavailableDeviceIntroMessage = unavailableRequestedDevice[\s\S]*?\n\s*: '';\n/,
    `// ${MARKER}:facts\n`,
    'unavailable device canned response',
  );

  code = replaceRegexOnce(
    code,
    /const unavailablePhoneGuidanceV165 = unavailablePhoneOfferV165 \? [\s\S]*? : '';\n/,
    '',
    'unavailable phone guidance',
  );
  code = replaceRegexOnce(
    code,
    /\/\/ first-contact-cordiality-v227\nconst cordialCatalogIntroV227 = greetingLine[\s\S]*?;\n\n/,
    '',
    'fixed catalog introduction',
  );
  code = replaceRegexOnce(
    code,
    /const structuredFilterGuidanceV288 = structuredFilterNeedsHandoffV288[\s\S]*?\n\s*: '';\n/,
    '',
    'structured filter canned guidance',
  );

  const followupAnchor = `const phoneCatalogFollowupEligibleV289 = Boolean(isCompleteCategoryRequest && prefersSmartphones && products.length > 0);`;
  const facts = `${followupAnchor}
const salesAvailabilityStatusV322 = base.needsDeviceClarification === true
  ? 'needs_device_clarification'
  : (structuredFilterNeedsHandoffV288
    ? 'search_inconclusive'
    : (unavailableRequestedDevice && products.length > 0
      ? 'requested_model_not_confirmed_with_alternatives'
      : (products.length > 0 ? 'confirmed_products_available' : 'search_inconclusive')));
const requiresSpecialistHandoffV322 = products.length === 0 && salesAvailabilityStatusV322 !== 'needs_device_clarification';
const deterministicCatalogOutputV322 = finalQuoteMessages.filter(Boolean).join('[[MSG]]');`;
  code = replaceOnce(code, followupAnchor, facts, 'structured sales facts');

  const oldReturn = `    stockAssistantContext: structuredFilterGuidanceV288 || unavailablePhoneGuidanceV165 || String(base.stockAssistantContext || ''),
    aiResponseGuidance: structuredFilterGuidanceV288 || unavailablePhoneGuidanceV165 || String(base.aiResponseGuidance || ''),
    output: [greetingLine, cordialCatalogIntroV227, smartwatchAvailabilityIntroV162, unavailableDeviceIntroMessage, ...finalQuoteMessages].filter(Boolean).join('[[MSG]]'),`;
  const newReturn = `    salesAvailabilityStatus: salesAvailabilityStatusV322,
    requiresSpecialistHandoff: requiresSpecialistHandoffV322,
    deterministicCatalogOutput: deterministicCatalogOutputV322,
    stockAssistantContext: '',
    aiResponseGuidance: '',
    output: '',`;
  code = replaceOnce(code, oldReturn, newReturn, 'sales response contract');

  for (const stale of [
    'unavailableDeviceIntroMessage',
    'unavailablePhoneGuidanceV165',
    'structuredFilterGuidanceV288',
    'cordialCatalogIntroV227',
    'acabou no momento',
    'Vou atualizar as opções disponíveis para você',
    'Obrigado pelas informações 😊 Não consegui identificar',
    'O senhor esta falando de celulares',
  ]) {
    assert.equal(code.includes(stale), false, `Stale canned response remains: ${stale}`);
  }
  new Function('$json', '$input', '$getWorkflowStaticData', '$', code);
  node.parameters.jsCode = code;
}

function patchSalesAgent(node) {
  node.parameters.text = `={{
  ($('Vendas - Contexto Produtos').first().json.conversationHistory
    ? 'Historico recente da conversa (use apenas como contexto; priorize a mensagem atual):\\n' + $('Vendas - Contexto Produtos').first().json.conversationHistory + '\\n\\n'
    : '')
  + ($('Vendas - Contexto Produtos').first().json.clienteNome
    ? 'Nome confiavel do cliente: ' + $('Vendas - Contexto Produtos').first().json.clienteNome + '.\\n'
    : '')
  + 'Mensagem atual: ' + $('Vendas - Contexto Produtos').first().json.conversation + '\\n'
  + 'Modelo ou termo solicitado: ' + ($('Vendas - Contexto Produtos').first().json.requestedDeviceModelQuery || $('Vendas - Contexto Produtos').first().json.productSearchTerm || '') + '\\n'
  + 'Status deterministico da consulta: ' + $('Vendas - Contexto Produtos').first().json.salesAvailabilityStatus + '\\n'
  + 'Saudacao pendente: ' + ($('Vendas - Contexto Produtos').first().json.saudacaoDetectada === true ? 'sim' : 'nao') + '\\n'
  + 'A lista oficial sera anexada depois da sua fala: ' + ($('Vendas - Contexto Produtos').first().json.deterministicCatalogOutput ? 'sim' : 'nao') + '\\n\\n'
  + 'Produtos confirmados em estoque:\\n' + ($('Vendas - Contexto Produtos').first().json.productsContext || 'NENHUM PRODUTO CONFIRMADO PARA ESTA CONSULTA')
}}`;
  node.parameters.options = node.parameters.options || {};
  node.parameters.options.systemMessage = `Voce e o Especialista de Vendas da Mercado do Vale. Sua responsabilidade e escrever a parte conversacional da resposta em portugues brasileiro. Os fatos de produto, estoque, preco, memoria, cor e link sao calculados pelo sistema e nao podem ser alterados.

O campo "Status deterministico da consulta" e a fonte de verdade:
- confirmed_products_available: ha produtos confirmados. Responda naturalmente a pergunta e introduza brevemente as opcoes. Nao repita a lista, precos, links, cores ou memorias; a lista oficial sera anexada depois.
- requested_model_not_confirmed_with_alternatives: o modelo exato nao foi confirmado entre os itens disponiveis, mas existem alternativas. Explique isso com naturalidade, sem dizer que acabou, sem estoque ou que a loja nao possui definitivamente. Avise que as opcoes confirmadas aparecerao em seguida.
- search_inconclusive: a automacao nao conseguiu confirmar uma opcao. Nao conclua que o produto acabou. Explique naturalmente que um atendente fara a conferencia. Nao ofereca lista nem faca outra pergunta.
- needs_device_clarification: faca uma pergunta curta e natural para confirmar se o cliente procura o aparelho/celular da marca mencionada.

Regras obrigatorias:
- Escreva cada resposta do zero de acordo com a mensagem atual e o historico recente. Nao use frase pronta nem copie exemplos.
- Use somente os fatos recebidos. Nao invente nem deduza estoque, preco, produto, cor, memoria, link, prazo ou disponibilidade.
- Nunca transforme busca vazia em afirmacao de indisponibilidade.
- Nao reproduza a lista deterministica nem seus valores.
- Responda de forma curta, simpatica, vendedora e natural, com emojis moderados.
- Nao use Markdown nem listas com marcadores.
- Separe mensagens de WhatsApp com exatamente [[MSG]].
- Use exatamente [[BR]] para quebra de linha dentro da mesma mensagem.
- Use [[SAUDACAO]] somente quando a entrada contiver literalmente "Saudacao pendente: sim". Nesse caso, comece com [[SAUDACAO]] e use o primeiro nome somente quando fornecido como confiavel. Quando constar "nao", continue sem nova saudacao.

Esta instrucao substitui as antigas respostas gravadas de disponibilidade. // ${MARKER}:agent`;
}

function composerCode() {
  return `// ${MARKER}:composer
const source = $('Vendas - Contexto Produtos').first().json || {};
const aiOutput = String($json.output || '').trim();
if (!aiOutput) throw new Error('Especialista de vendas retornou resposta vazia');
const catalogOutput = String(source.deterministicCatalogOutput || '').trim();
return [{
  json: {
    ...source,
    output: [aiOutput, catalogOutput].filter(Boolean).join('[[MSG]]'),
    requiresSpecialistHandoff: source.requiresSpecialistHandoff === true,
  },
}];`;
}

function patchGraph(nodes, connections) {
  const context = findNode(nodes, CONTEXT_NODE);
  const agent = findNode(nodes, AGENT_NODE);
  const router = findNode(nodes, ROUTER_NODE);

  let composer = nodes.find((node) => node.name === COMPOSER_NODE);
  if (!composer) {
    composer = {
      id: 'sales-ai-response-composer-v322',
      name: COMPOSER_NODE,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [Number(agent.position?.[0] || 0) + 240, Number(agent.position?.[1] || 0)],
      parameters: { jsCode: composerCode() },
    };
    nodes.push(composer);
  } else {
    composer.parameters = { jsCode: composerCode() };
  }

  router.name = 'Vendas - Precisa Handoff?';
  router.parameters = {
    options: {},
    conditions: {
      options: { version: 2, leftValue: '', caseSensitive: true, typeValidation: 'strict' },
      combinator: 'and',
      conditions: [{
        id: 'sales-ai-handoff-condition-v322',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
        leftValue: '={{$json.requiresSpecialistHandoff === true}}',
        rightValue: true,
      }],
    },
  };

  delete connections[ROUTER_NODE];
  connections[CONTEXT_NODE] = { main: [[{ node: AGENT_NODE, type: 'main', index: 0 }]] };
  connections[AGENT_NODE] = { main: [[{ node: COMPOSER_NODE, type: 'main', index: 0 }]] };
  connections[COMPOSER_NODE] = { main: [[{ node: router.name, type: 'main', index: 0 }]] };
  connections[router.name] = {
    main: [
      [{ node: HANDOFF_PREPARE_NODE, type: 'main', index: 0 }],
      [{ node: SPLIT_NODE, type: 'main', index: 0 }],
    ],
  };

  // Keep the node id and canvas location, but remove every old-name reference.
  for (const value of Object.values(connections)) {
    for (const outputs of value.main || []) {
      for (const target of outputs || []) assert.notEqual(target.node, ROUTER_NODE, 'Old router name remains in graph');
    }
  }
  assert.equal(context.name, CONTEXT_NODE);
}

function patchWorkflow(workflow) {
  const nodes = workflow.nodes;
  patchPrepareSearch(findNode(nodes, PREPARE_NODE));
  patchProductContext(findNode(nodes, CONTEXT_NODE));
  patchSalesAgent(findNode(nodes, AGENT_NODE));
  const model = findNode(nodes, MODEL_NODE);
  model.retryOnFail = true;
  model.maxTries = 3;
  model.waitBetweenTries = 5000;
  patchGraph(nodes, workflow.connections);
  return workflow;
}

function summarize(workflow) {
  const nodes = workflow.nodes;
  const prepare = findNode(nodes, PREPARE_NODE).parameters.jsCode;
  const context = findNode(nodes, CONTEXT_NODE).parameters.jsCode;
  const agent = findNode(nodes, AGENT_NODE);
  const router = findNode(nodes, 'Vendas - Precisa Handoff?');
  const composer = findNode(nodes, COMPOSER_NODE);
  return {
    budgetParserSafe: prepare.includes(`${MARKER}:budget`),
    exactModelClearsStaleBudget: prepare.includes(`${MARKER}:exact-model-budget`),
    structuredFacts: context.includes(`${MARKER}:facts`),
    noCannedStockClaim: !/acabou no momento|acabou todo estoque|nao temos disponivel/i.test(context),
    noFixedCatalogIntro: !context.includes('Vou atualizar as opções disponíveis para você'),
    agentOwnsConversation: agent.parameters.options.systemMessage.includes(`${MARKER}:agent`),
    deterministicCatalogPreserved: context.includes('deterministicCatalogOutputV322'),
    composerPresent: composer.parameters.jsCode.includes(`${MARKER}:composer`),
    contextFeedsAgent: workflow.connections[CONTEXT_NODE]?.main?.[0]?.[0]?.node === AGENT_NODE,
    agentFeedsComposer: workflow.connections[AGENT_NODE]?.main?.[0]?.[0]?.node === COMPOSER_NODE,
    composerFeedsRouter: workflow.connections[COMPOSER_NODE]?.main?.[0]?.[0]?.node === router.name,
    handoffTrueBranch: workflow.connections[router.name]?.main?.[0]?.[0]?.node === HANDOFF_PREPARE_NODE,
    normalFalseBranch: workflow.connections[router.name]?.main?.[1]?.[0]?.node === SPLIT_NODE,
    modelRetries: findNode(nodes, MODEL_NODE).retryOnFail === true
      && findNode(nodes, MODEL_NODE).maxTries === 3
      && findNode(nodes, MODEL_NODE).waitBetweenTries === 5000,
  };
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const database = (await runRemote(
      connection,
      "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1",
    )).trim();
    assert.ok(database, 'n8n database container must be running');

    const readSql = `COPY (
      SELECT encode(convert_to(json_build_object(
        'nodes', nodes::jsonb,
        'connections', connections::jsonb,
        'activeVersionId', "activeVersionId",
        'versionId', "versionId",
        'active', active
      )::text, 'UTF8'), 'hex')
      FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const hex = (await psql(connection, database, readSql)).trim();
    const workflow = patchWorkflow(JSON.parse(Buffer.from(hex, 'hex').toString('utf8')));
    const summary = summarize(workflow);

    for (const node of workflow.nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
      assert.doesNotThrow(
        () => new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', String(node.parameters?.jsCode || '')),
        `${node.name} must compile`,
      );
    }
    assert.deepEqual(Object.values(summary).every(Boolean), true, `Dry-run validation failed: ${JSON.stringify(summary)}`);

    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, workflowId: WORKFLOW_ID, ...summary }, null, 2));
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-${MARKER}-${timestamp}.json`;
    await runRemote(connection, `mkdir -p /root/n8n-backups`);
    const backupSql = `COPY (
      SELECT json_build_object('workflow', row_to_json(we), 'activeHistory', row_to_json(wh))::text
      FROM workflow_entity we
      LEFT JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
      WHERE we.id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const backup = await psql(connection, database, backupSql);
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(backupPath, Buffer.from(backup, 'utf8'), (writeError) => {
        sftp.end();
        writeError ? reject(writeError) : resolve();
      });
    }));

    await runRemote(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 0);
    await runRemote(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    servicesStopped = true;

    const updateSql = `BEGIN;
      UPDATE workflow_entity
      SET nodes=${shQuote(JSON.stringify(workflow.nodes))}::json,
          connections=${shQuote(JSON.stringify(workflow.connections))}::json,
          "versionId"="activeVersionId",
          "updatedAt"=NOW()
      WHERE id=${shQuote(WORKFLOW_ID)};
      UPDATE workflow_history
      SET nodes=${shQuote(JSON.stringify(workflow.nodes))}::json,
          connections=${shQuote(JSON.stringify(workflow.connections))}::json,
          "updatedAt"=NOW()
      WHERE "workflowId"=${shQuote(WORKFLOW_ID)}
        AND "versionId"=${shQuote(workflow.activeVersionId)};
      COMMIT;`;
    await psql(connection, database, updateSql);

    await runRemote(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await runRemote(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    const verifySql = `COPY (
      SELECT json_build_object(
        'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
        'active', we.active,
        'versionAligned', we."versionId"=we."activeVersionId",
        'markerPresent', we.nodes::text LIKE '%${MARKER}%'
      )::text
      FROM workflow_entity we
      JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId"
      WHERE we.id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, database, verifySql)).trim());
    assert.deepEqual(verification, {
      entityHistoryEqual: true,
      active: true,
      versionAligned: true,
      markerPresent: true,
    });
    console.log(JSON.stringify({ apply: true, workflowId: WORKFLOW_ID, backupPath, ...summary, verification }, null, 2));
  } finally {
    if (servicesStopped) {
      await runRemote(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await runRemote(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = {
  MARKER,
  patchPrepareSearch,
  patchProductContext,
  patchSalesAgent,
  patchGraph,
  patchWorkflow,
  composerCode,
  summarize,
};

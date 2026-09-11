const assert = require('node:assert/strict');
const vm = require('node:vm');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const SMARTPHONES_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const MARKER = 'sales-alphanumeric-model-grounded-facts-v1';
const NUMBERED_SELECTION_MARKER = 'sales-ambiguous-model-numbered-selection-v1';
const APPLY = process.argv.includes('--apply');
const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function run(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0
      ? resolve(stdout)
      : reject(new Error(stderr || stdout || `remote command failed: ${code}`)));
  }));
}

function psql(connection, container, sql) {
  return new Promise((resolve, reject) => {
    connection.exec(`docker exec -i ${shQuote(container)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0
        ? resolve(stdout)
        : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
      stream.end(sql);
    });
  });
}

async function waitService(connection, service, expected, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await run(connection, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
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

function patchPrepare(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`${MARKER}:prepare`)) return;
  const implicitAnchor = `const implicitPhoneModelRequestV134 = !accessoryRequest && /\\b(?:note\\s*\\d{1,3}(?:\\s*(?:pro|plus|max|ultra|lite|neo|5g|4g|\\+))*)\\b/.test(implicitPhoneModelCandidateV134);`;
  code = replaceOnce(code, implicitAnchor, `${implicitAnchor}
// ${MARKER}:prepare
// Codigos de modelo alfanumericos curtos (C71, A15, G54) tambem sao modelos
// quando o cliente deixa claro que esta falando do aparelho, nao de acessorio.
const implicitAlphanumericPhoneModelRequestV1 = explicitPhoneDeviceRequest
  && !accessoryRequest
  && modelTokens.some((token) => /^(?=.*[a-z])(?=.*\\d)[a-z0-9+.-]{2,20}$/i.test(token));`, 'implicit alphanumeric model detector');
  code = replaceOnce(
    code,
    `  || implicitPhoneModelRequestV134\n);`,
    `  || implicitPhoneModelRequestV134\n  || implicitAlphanumericPhoneModelRequestV1\n);`,
    'specific model decision',
  );
  code = replaceOnce(
    code,
    `const requestedDeviceModelQuery = specificDeviceModelRequest\n  ? String(classifiedSearchQuery || tokens.join(' ')).trim()\n  : '';`,
    `const requestedDeviceModelQuery = specificDeviceModelRequest\n  ? String(implicitAlphanumericPhoneModelRequestV1 ? modelTokens.join(' ') : (classifiedSearchQuery || tokens.join(' '))).trim()\n  : '';`,
    'safe model query',
  );
  new Function('$json', code);
  node.parameters.jsCode = code;
}

function patchContext(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes(`${MARKER}:context`)) return;
  const memoryAnchor = `    const memoryPartsV155 = getPhysicalMemoryPartsV155(product);`;
  code = replaceOnce(code, memoryAnchor, `${memoryAnchor}
    // ${MARKER}:context
    // Lista branca: nunca encaminhar IMEI, serial, UUID interno ou campos livres
    // ao modelo. Apenas caracteristicas tecnicas estruturadas do cadastro.
    const specsV1 = product?.specs && typeof product.specs === 'object' && !Array.isArray(product.specs) ? product.specs : {};
    const cleanTextV1 = (value, max = 120) => String(value ?? '').replace(/\\s+/g, ' ').trim().slice(0, max);
    const positiveNumberV1 = (value) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; };
    const positiveIntegerFromTextV1 = (value) => { const match = String(value ?? '').match(/\\d+(?:[.,]\\d+)?/); return match ? Math.round(Number(match[0].replace(',', '.'))) : 0; };
    const verifiedSalesFactsV1 = Object.fromEntries(Object.entries({
      ram: cleanTextV1(specsV1.ram, 20),
      storage: cleanTextV1(specsV1.storage, 20),
      batteryMah: positiveNumberV1(specsV1.battery_mah),
      screenInches: positiveNumberV1(specsV1.display),
      refreshRateHz: positiveIntegerFromTextV1(specsV1.celular_fps_display || specsV1.fps_do_display),
      displayType: cleanTextV1(specsV1.tipo_de_display, 40),
      mainCameraMp: positiveIntegerFromTextV1(specsV1.cam_principal_mpx),
      charging: cleanTextV1(specsV1.carregamento, 100),
      chipset: cleanTextV1(specsV1.chipset, 80),
      processor: cleanTextV1(specsV1.processador, 120),
      network: cleanTextV1(specsV1.rede_operadora, 20),
      nfc: /^(sim|nao|não)$/i.test(cleanTextV1(specsV1.nfc, 10)) ? cleanTextV1(specsV1.nfc, 10) : '',
      biometrics: cleanTextV1(specsV1.celular_biometria, 80),
      resistance: /^(nao informado|não informado)$/i.test(cleanTextV1(specsV1.resistencia, 40)) ? '' : cleanTextV1(specsV1.resistencia, 40),
    }).filter(([, value]) => value !== '' && value !== 0));`, 'verified sales facts');
  code = replaceOnce(code, `      storageGb: memoryPartsV155.storageGb,\n      url,`, `      storageGb: memoryPartsV155.storageGb,\n      verifiedSalesFacts: verifiedSalesFactsV1,\n      url,`, 'facts on catalog product');
  const detailsAnchor = `  const details = [\n    product.brand ? 'Marca: ' + product.brand : '',\n    product.memory ? 'Memoria: ' + product.memory : '',`;
  code = replaceOnce(code, detailsAnchor, `  const factsV1 = product.verifiedSalesFacts || {};
  const technicalFactsV1 = [
    factsV1.batteryMah ? 'Bateria: ' + factsV1.batteryMah + 'mAh' : '',
    factsV1.screenInches ? 'Tela: ' + factsV1.screenInches + ' polegadas' : '',
    factsV1.refreshRateHz ? 'Taxa da tela: ' + factsV1.refreshRateHz + 'Hz' : '',
    factsV1.displayType ? 'Tipo de tela: ' + factsV1.displayType : '',
    factsV1.mainCameraMp ? 'Camera principal: ' + factsV1.mainCameraMp + 'MP' : '',
    factsV1.charging ? 'Carregamento: ' + factsV1.charging : '',
    factsV1.chipset ? 'Chipset: ' + factsV1.chipset : '',
    factsV1.processor ? 'Processador: ' + factsV1.processor : '',
    factsV1.network ? 'Rede: ' + factsV1.network : '',
    factsV1.nfc ? 'NFC: ' + factsV1.nfc : '',
    factsV1.biometrics ? 'Biometria: ' + factsV1.biometrics : '',
    factsV1.resistance ? 'Resistencia: ' + factsV1.resistance : '',
  ].filter(Boolean).join(' | ');
  const details = [
    product.brand ? 'Marca: ' + product.brand : '',
    product.memory ? 'Memoria: ' + product.memory : '',
    technicalFactsV1 ? 'Caracteristicas confirmadas: ' + technicalFactsV1 : '',`, 'facts in AI context');
  new Function('$json', '$input', '$getWorkflowStaticData', '$', code);
  node.parameters.jsCode = code;
}

function patchAgent(node) {
  const options = node.parameters.options || (node.parameters.options = {});
  let prompt = String(options.systemMessage || '');
  if (!prompt.includes(`${MARKER}:agent`)) {
    prompt = replaceOnce(
      prompt,
      'Os fatos de produto, estoque, preco, memoria, cor e link sao calculados pelo sistema e nao podem ser alterados.',
      `Os fatos de produto, estoque, preco, memoria, cor, link e caracteristicas tecnicas sao calculados pelo sistema e nao podem ser alterados. // ${MARKER}:agent`,
      'agent source-of-truth rule',
    );
    prompt = replaceOnce(
      prompt,
      '- Use somente os fatos recebidos. Nao invente nem deduza estoque, preco, produto, cor, memoria, link, prazo ou disponibilidade.',
      `- Use somente os fatos recebidos. Nao invente nem deduza estoque, preco, produto, cor, memoria, link, prazo, disponibilidade ou caracteristica tecnica.
- Quando o cliente perguntar se um aparelho e bom, responda diretamente como consultor de vendas e destaque de 2 a 4 vantagens sustentadas pelas Caracteristicas confirmadas. Traduza bateria, tela, memoria, camera e carregamento em beneficios claros, sem superlativos ou promessas nao comprovadas.
- Se o mesmo codigo curto corresponder a modelos de marcas diferentes, nunca misture as fichas. Diga que existem as duas opcoes, apresente no maximo um diferencial confirmado de cada uma e pergunte qual delas o cliente quis dizer.`,
      'grounded sales behavior',
    );
  }
  if (!prompt.includes(NUMBERED_SELECTION_MARKER)) {
    prompt = replaceOnce(
      prompt,
      '- Se o mesmo codigo curto corresponder a modelos de marcas diferentes, nunca misture as fichas. Diga que existem as duas opcoes, apresente no maximo um diferencial confirmado de cada uma e pergunte qual delas o cliente quis dizer.',
      `- Se o mesmo codigo curto corresponder a modelos de marcas diferentes, nunca misture as fichas. Apresente obrigatoriamente cada modelo em uma opcao numerada, com uma opcao por linha, seguindo exatamente a ordem em que os produtos aparecem no contexto: 1., 2. e assim por diante. Mostre no maximo um diferencial confirmado de cada modelo e termine pedindo para o cliente responder com o numero ou o nome da opcao. // ${NUMBERED_SELECTION_MARKER}`,
      'numbered ambiguous-model selection',
    );
  }
  options.systemMessage = prompt;
}

function patchWorkflow(workflow) {
  patchPrepare(findNode(workflow.nodes, 'Vendas - Preparar Busca'));
  patchContext(findNode(workflow.nodes, 'Vendas - Contexto Produtos'));
  patchAgent(findNode(workflow.nodes, 'Especialista - Vendas'));
  return workflow;
}

function runPrepare(code, conversation, salesSearchQuery) {
  const source = {
    conversation,
    classificacaoMensagem: conversation,
    intencao: 'vendas_produtos',
    salesRequestKind: 'busca',
    salesSearchQuery,
    salesCategoryName: '',
    salesCategoryId: '',
    remoteJid: '559999999999@s.whatsapp.net',
    Instancia: 'botmercadodovale',
  };
  return vm.runInNewContext(`(function(){${code}})()`, { $json: source })[0].json;
}

async function validate(workflow) {
  for (const node of workflow.nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
    if (node.parameters?.jsCode) new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', node.parameters.jsCode);
  }
  const prepareCode = findNode(workflow.nodes, 'Vendas - Preparar Busca').parameters.jsCode;
  const contextCode = findNode(workflow.nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  const c71 = runPrepare(prepareCode, 'Você tem o celular c71 qual o valor', 'celular c71');
  assert.equal(c71.specificDeviceModelRequest, true);
  assert.equal(c71.requestedDeviceModelQuery.toLowerCase(), 'c71');
  assert.equal(c71.productCategoryId, SMARTPHONES_CATEGORY_ID);
  const a15 = runPrepare(prepareCode, 'Você tem o celular A15?', 'celular a15');
  assert.equal(a15.specificDeviceModelRequest, true);
  assert.equal(a15.requestedDeviceModelQuery.toLowerCase(), 'a15');
  const note = runPrepare(prepareCode, 'Você tem o Note 15 Pro+?', 'note 15 pro+');
  assert.equal(note.specificDeviceModelRequest, true);
  const accessory = runPrepare(prepareCode, 'Você tem capa para C71?', 'capa para c71');
  assert.equal(accessory.accessoryRequest, true);
  assert.equal(accessory.specificDeviceModelRequest, false);
  const genericPhone = runPrepare(prepareCode, 'Você tem celular?', 'celular');
  assert.equal(genericPhone.specificDeviceModelRequest, false);

  const [productsResponse, feesResponse] = await Promise.all([
    fetch(`https://api.xiaomipetrolina.com.br/products?category=${SMARTPHONES_CATEGORY_ID}&status=active&compact=true&limit=500&sort_by=stock_quantity&sort_direction=desc`),
    fetch('https://api.xiaomipetrolina.com.br/payment-fees'),
  ]);
  assert.equal(productsResponse.ok, true);
  assert.equal(feesResponse.ok, true);
  const products = await productsResponse.json();
  const fees = await feesResponse.json();
  const selectors = {
    'Vendas - Preparar Busca': { first: () => ({ json: c71 }) },
    'Vendas - Buscar Produtos': { all: () => products.map((json) => ({ json })) },
    'switc Mensagens': { first: () => ({ json: c71 }) },
  };
  const staticData = {};
  const result = vm.runInNewContext(`(function(){${contextCode}})()`, {
    $input: { all: () => fees.map((json) => ({ json })) },
    $getWorkflowStaticData: () => staticData,
    $: (name) => selectors[name],
    Date,
    Intl,
  })[0].json;
  const names = result.productsInStock.map((product) => product.name);
  assert.ok(names.includes('Poco C71'));
  assert.ok(names.includes('Realme C71'));
  const poco = result.productsInStock.find((product) => product.name === 'Poco C71');
  const realme = result.productsInStock.find((product) => product.name === 'Realme C71');
  assert.equal(poco.verifiedSalesFacts.batteryMah, 5200);
  assert.equal(realme.verifiedSalesFacts.batteryMah, 6300);
  assert.match(result.productsContext, /Bateria: (5200|6300)mAh/);
  assert.match(result.productsContext, /Taxa da tela: 120Hz/);
  assert.doesNotMatch(result.productsContext, /imei|serial|battery_health|[0-9a-f]{8}-[0-9a-f-]{27,}/i);
  const selectionOptions = staticData.salesPostList?.[c71.remoteJid]?.options || [];
  assert.ok(selectionOptions.length >= 2);
  assert.equal(selectionOptions[0].number, 1);
  assert.equal(selectionOptions[1].number, 2);
  assert.ok(selectionOptions.some((option) => option.name === 'Poco C71'));
  assert.ok(selectionOptions.some((option) => option.name === 'Realme C71'));
  const postListCode = findNode(workflow.nodes, 'Vendas - Verificar Pos Lista').parameters.jsCode;
  const validateNumberChoice = async (number, expectedName) => {
    const choiceSource = {
      remoteJid: c71.remoteJid,
      Instancia: c71.Instancia,
      conversation: String(number),
      classificacaoMensagem: String(number),
      intencao: 'vendas_produtos',
      salesRequestKind: '',
      salesSearchQuery: '',
      salesCategoryName: '',
      salesCategoryId: '',
      salesFlowAction: 'selecionar_item_lista',
      salesFlowItemNumber: number,
      salesFlowItemNumbers: [number],
    };
    const choiceState = JSON.parse(JSON.stringify(staticData));
    const choiceSelectors = {
      'switc Mensagens': { first: () => ({ json: choiceSource }) },
      'Vendas - Preparar Contexto IA': { first: () => ({ json: choiceSource }) },
    };
    const choiceResult = await vm.runInNewContext(`(async function(){${postListCode}})()`, {
      $json: choiceSource,
      $input: { all: () => [] },
      $getWorkflowStaticData: () => choiceState,
      $: (name) => choiceSelectors[name] || { first: () => ({ json: {} }), all: () => [] },
      helpers: { httpRequest: async () => [] },
      Date,
      Intl,
    });
    assert.equal(choiceResult[0].json.salesPostListHandled, true, JSON.stringify({
      result: choiceResult[0].json,
      state: choiceState.salesPostList?.[c71.remoteJid] || null,
    }));
    assert.equal(choiceState.salesPostList[c71.remoteJid].selectedOptionNumber, number);
    assert.match(String(choiceResult[0].json.output || ''), new RegExp(expectedName, 'i'));
    return expectedName;
  };
  const numericChoices = [
    await validateNumberChoice(1, 'Poco C71'),
    await validateNumberChoice(2, 'Realme C71'),
  ];
  const prompt = findNode(workflow.nodes, 'Especialista - Vendas').parameters.options.systemMessage;
  assert.ok(prompt.includes(`${MARKER}:agent`));
  assert.ok(prompt.includes(NUMBERED_SELECTION_MARKER));
  assert.match(prompt, /seguindo exatamente a ordem em que os produtos aparecem no contexto/);
  assert.match(prompt, /responder com o numero ou o nome da opcao/);
  return {
    modelQuery: c71.requestedDeviceModelQuery,
    smartphoneCategory: c71.productCategoryId === SMARTPHONES_CATEGORY_ID,
    regressionScenarios: ['C71', 'A15', 'Note 15 Pro+', 'acessorio C71', 'celular generico'],
    matchedModels: names.filter((name) => /c71/i.test(name)),
    selectionOptions: selectionOptions.slice(0, 2).map((option) => ({ number: option.number, name: option.name })),
    numericChoices,
    groundedFactsPresent: /Caracteristicas confirmadas:/.test(result.productsContext),
    sensitiveFieldsAbsent: !/imei|serial|battery_health/i.test(result.productsContext),
    specialistPromptGrounded: prompt.includes('destaque de 2 a 4 vantagens'),
    numberedSelectionPrompt: prompt.includes(NUMBERED_SELECTION_MARKER),
  };
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let servicesStopped = false;
  try {
    const dbContainer = (await run(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(dbContainer, 'n8n Postgres container not found');
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
    const hex = (await psql(connection, dbContainer, readSql)).trim();
    const workflow = JSON.parse(Buffer.from(hex, 'hex').toString('utf8'));
    assert.equal(workflow.active, true, 'workflow must be active');
    assert.equal(workflow.versionId, workflow.activeVersionId, 'active workflow version must be aligned');
    const numberedSelectionAlreadyActive = JSON.stringify(workflow.nodes).includes(NUMBERED_SELECTION_MARKER);
    patchWorkflow(workflow);
    const validation = await validate(workflow);
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, workflowId: WORKFLOW_ID, marker: MARKER, numberedSelectionAlreadyActive, validation }, null, 2));
      return;
    }

    const activeExecutionsSql = `COPY (
      SELECT count(*) FROM execution_entity
      WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND status IN ('new', 'running')
    ) TO STDOUT;`;
    assert.equal(Number((await psql(connection, dbContainer, activeExecutionsSql)).trim()), 0, 'workflow has active executions; retry after they finish');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-${MARKER}-${timestamp}.json`;
    await run(connection, 'mkdir -p /root/n8n-backups');
    const backupSql = `COPY (
      SELECT json_build_object('workflow', row_to_json(workflow), 'activeHistory', row_to_json(history))::text
      FROM workflow_entity workflow
      LEFT JOIN workflow_history history
        ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId"
      WHERE workflow.id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const backup = await psql(connection, dbContainer, backupSql);
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(backupPath, Buffer.from(backup, 'utf8'), (writeError) => {
        sftp.end();
        writeError ? reject(writeError) : resolve();
      });
    }));

    await run(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 0);
    await run(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    servicesStopped = true;
    assert.equal(Number((await psql(connection, dbContainer, activeExecutionsSql)).trim()), 0, 'workflow received an execution during shutdown');
    const activeVersionAfterStop = (await psql(connection, dbContainer, `COPY (SELECT "activeVersionId" FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`)).trim();
    assert.equal(activeVersionAfterStop, workflow.activeVersionId, 'active workflow version changed during preparation');

    const nodesPath = `/tmp/${WORKFLOW_ID}-${MARKER}-${timestamp}-nodes.json`;
    const connectionsPath = `/tmp/${WORKFLOW_ID}-${MARKER}-${timestamp}-connections.json`;
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(nodesPath, Buffer.from(JSON.stringify(workflow.nodes), 'utf8'), (nodesError) => {
        if (nodesError) {
          sftp.end();
          return reject(nodesError);
        }
        sftp.writeFile(connectionsPath, Buffer.from(JSON.stringify(workflow.connections), 'utf8'), (connectionsError) => {
          sftp.end();
          connectionsError ? reject(connectionsError) : resolve();
        });
      });
    }));
    await run(connection, `docker cp ${shQuote(nodesPath)} ${shQuote(dbContainer)}:${shQuote(nodesPath)}`);
    await run(connection, `docker cp ${shQuote(connectionsPath)} ${shQuote(dbContainer)}:${shQuote(connectionsPath)}`);
    try {
      await psql(connection, dbContainer, `BEGIN;
        UPDATE workflow_entity
        SET nodes=pg_read_file('${nodesPath}')::json,
            connections=pg_read_file('${connectionsPath}')::json,
            "versionId"="activeVersionId",
            "updatedAt"=NOW()
        WHERE id=${shQuote(WORKFLOW_ID)};
        UPDATE workflow_history
        SET nodes=pg_read_file('${nodesPath}')::json,
            connections=pg_read_file('${connectionsPath}')::json,
            "updatedAt"=NOW()
        WHERE "workflowId"=${shQuote(WORKFLOW_ID)}
          AND "versionId"=${shQuote(workflow.activeVersionId)};
        COMMIT;`);
    } finally {
      await run(connection, `rm -f ${shQuote(nodesPath)} ${shQuote(connectionsPath)}`).catch(() => {});
      await run(connection, `docker exec ${shQuote(dbContainer)} rm -f ${shQuote(nodesPath)} ${shQuote(connectionsPath)}`).catch(() => {});
    }

    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    servicesStopped = false;

    const verifySql = `COPY (
      SELECT json_build_object(
        'active', workflow.active,
        'versionAligned', workflow."versionId"=workflow."activeVersionId",
        'entityHistoryEqual', workflow.nodes::jsonb=history.nodes::jsonb AND workflow.connections::jsonb=history.connections::jsonb,
        'prepareMarker', workflow.nodes::text LIKE '%${MARKER}:prepare%',
        'contextMarker', workflow.nodes::text LIKE '%${MARKER}:context%',
        'agentMarker', workflow.nodes::text LIKE '%${MARKER}:agent%',
        'numberedSelectionMarker', workflow.nodes::text LIKE '%${NUMBERED_SELECTION_MARKER}%'
      )::text
      FROM workflow_entity workflow
      JOIN workflow_history history
        ON history."workflowId"=workflow.id AND history."versionId"=workflow."activeVersionId"
      WHERE workflow.id=${shQuote(WORKFLOW_ID)}
    ) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, dbContainer, verifySql)).trim());
    assert.deepEqual(verification, {
      active: true,
      versionAligned: true,
      entityHistoryEqual: true,
      prepareMarker: true,
      contextMarker: true,
      agentMarker: true,
      numberedSelectionMarker: true,
    });
    console.log(JSON.stringify({ apply: true, workflowId: WORKFLOW_ID, marker: MARKER, backupPath, validation, verification }, null, 2));
  } finally {
    if (servicesStopped) {
      await run(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { MARKER, patchPrepare, patchContext, patchAgent, patchWorkflow, validate };
if (require.main === module) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

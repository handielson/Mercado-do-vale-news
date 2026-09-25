'use strict';

const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const MARKER = 'generic-photo-catalog-choice-v1';
const CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const POST_LIST = 'Vendas - Verificar Pos Lista';
const CATALOG = 'Vendas - Contexto Produtos';
const COMPOSER = 'Vendas - Compor Resposta IA';
const DETAILS_MARKER = 'blueprint-with-characteristics-v1';

function patchPostList(code) {
  if (code.includes(MARKER)) return code;
  const noList = `    return [{\n      json: {\n        ...source,\n        salesPostListHandled: true,\n        // rapid-catalog-all-color-photos-v344-no-color-question\n          output: withGreeting(String(source.salesSearchQuery || '').trim()\n            ? 'Nao encontrei esse modelo disponivel no estoque agora. Posso te enviar a lista dos celulares disponiveis.'\n            : 'Consigo te mandar a foto sim 😊 Me informa qual modelo voce quer ver.'),\n      },\n    }];`;
  assert.ok(code.includes(noList), 'generic no-list photo fallback changed');
  code = code.replace(noList, `    // ${MARKER}: an unqualified photo request needs the real smartphone catalog first.\n    const genericPhotoCatalogV1 = !String(source.salesSearchQuery || '').trim()\n      && !/\\b(?:relogio|smartwatch|capa|capinha|pelicula|carregador|fone|fonte)\\b/.test(normalized);\n    if (genericPhotoCatalogV1) {\n      return [{ json: {\n        ...source, salesPostListHandled: false,\n        salesRequestKind: 'categoria', salesCategoryId: '${CATEGORY_ID}',\n        salesCategoryName: 'smartphones', salesSearchQuery: '',\n        photoCatalogRequestedV1: true,\n      } }];\n    }\n${noList}`);

  const beforeNewSearch = `if (aiAction === 'nova_busca') {\n  return buildContinueItem();\n}`;
  assert.ok(code.includes(beforeNewSearch), 'new-search anchor changed');
  code = code.replace(beforeNewSearch, `// ${MARKER}: "todos" means all photos only after we offered model photos.\nconst allPhotoChoiceV1 = activeState?.photoChoiceOfferedV1 === true\n  && /^(?:todos|todas|todos os (?:modelos|celulares|aparelhos)|todas as fotos)$/.test(normalized);\nif (allPhotoChoiceV1) {\n  activeState.photoChoiceOfferedV1 = false;\n  activeState.updatedAt = new Date(now).toISOString();\n  return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step,\n    output: withGreeting('Como são muitos modelos, não consigo mandar todas as fotos de uma vez pelo WhatsApp. 😊' + lineBreak\n      + 'Você pode ver todos com fotos aqui: https://www.mercadodovale.com.br/?categoria=Smartphones' + lineBreak\n      + 'Se quiser fotos de algum modelo específico, me diga o número ou nome dele que envio por aqui.'),\n  } }];\n}\n\nif (aiAction === 'nova_busca' && !(wantsPhoto && !String(source.salesSearchQuery || '').trim())) {\n  return buildContinueItem();\n}`);

  const activeGeneric = `const allPhotosRequestedV300 = (wantsPhoto || wantsPhotoFromAI) && !selectedNumber;\nif (allPhotosRequestedV300) {`;
  assert.ok(code.includes(activeGeneric), 'active-list generic photo anchor changed');
  code = code.replace(activeGeneric, `const allPhotosRequestedV300 = (wantsPhoto || wantsPhotoFromAI) && !selectedNumber;\nif (allPhotosRequestedV300) {\n  activeState.photoChoiceOfferedV1 = true;\n  activeState.updatedAt = new Date(now).toISOString();`);
  const oldAllPhotosText = `'Temos fotos e detalhes de todos os modelos no nosso catálogo online! 😊' + lineBreak + lineBreak\n        + 'Você pode ver a galeria completa de todos eles aqui:' + lineBreak\n        + '🔗 https://www.mercadodovale.com.br/?categoria=Smartphones' + lineBreak + lineBreak\n        + 'Ou se preferir ver por aqui mesmo, me diga o número do aparelho (de 1 a ' + activeState.options.length + ') que envio as fotos! 👍'`;
  assert.ok(code.includes(oldAllPhotosText), 'old all-photos reply changed');
  code = code.replace(oldAllPhotosText, `'Claro 😊 De qual modelo você quer ver fotos? Pode me dizer o número da lista (de 1 a ' + activeState.options.length + ') ou o nome.'`);
  const multiStart = code.indexOf("const requestedPhotoNumbersV343 = aiAction === 'pedir_foto' ? aiSelectedNumbersV343 : [];");
  const multiEnd = code.indexOf("\nif (!variant && (wantsPhoto || wantsPhotoFromAI)) {", multiStart);
  assert.ok(multiStart >= 0 && multiEnd > multiStart, 'multi-model photo branch changed');
  const multiBranch = code.slice(multiStart, multiEnd);
  assert.ok(multiBranch.includes('multiplePhotoMessagesV343.push(...buildAllPhotoMessages('), 'multi-model photo builder changed');
  code = code.slice(0, multiStart) + multiBranch
    .replace("    const multiplePhotoMessagesV343 = [];", `    if (requestedOptionsV343.length > 3) {
      return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step,
        output: withGreeting('Posso enviar fotos e a ficha técnica de até 3 modelos por vez. Quais 3 números ou nomes você quer ver primeiro? 😊') } }];
    }
    const multiplePhotoMessagesV343 = [];`)
    .replace(`    requestedOptionsV343.forEach((selectedOptionV343, optionIndexV343) => {
      multiplePhotoMessagesV343.push(...buildAllPhotoMessages(
        uniqueColorItems(selectedOptionV343?.colors || []),
        selectedOptionV343,
        optionIndexV343 === 0,
      ));
    });`, `    for (const selectedOptionV343 of requestedOptionsV343) {
      const photoVariantV343 = uniqueColorItems(selectedOptionV343?.colors || [])[0];
      if (!photoVariantV343) {
        multiplePhotoMessagesV343.push({ type: 'text', text: 'Ainda não tenho foto cadastrada de ' + selectedOptionV343.name + '.' });
        continue;
      }
      const photoMessagesV343 = await buildPhotoMessages(photoVariantV343, selectedOptionV343);
      multiplePhotoMessagesV343.push(...photoMessagesV343);
      if (!normalizeBlueprintUrlV309(photoVariantV343.blueprintImageUrl)
          && !photoMessagesV343.some((message) => String(message.fileName || '').startsWith('blueprint-'))) {
        multiplePhotoMessagesV343.push({ type: 'text', text: 'A ficha técnica de ' + selectedOptionV343.name + ' ainda não está cadastrada.' });
      }
    }`)
    + code.slice(multiEnd);
  assert.ok(code.includes('requestedOptionsV343.length > 3'), 'three-model cap not installed');
  assert.ok(code.includes('await buildPhotoMessages(photoVariantV343, selectedOptionV343)'), 'blueprint-aware photo builder not installed');
  new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', code);
  return code;
}

function patchCatalog(code) {
  if (code.includes(MARKER)) return code;
  const question = `if (products.length > 1) messages.push('Qual modelo voce quer ver em mais detalhes? 😊');`;
  assert.ok(code.includes(question), 'catalog follow-up anchor changed');
  code = code.replace(question, `// ${MARKER}: ask for a photo choice only after the official list is sent.\n  if (products.length > 1) messages.push(base.photoCatalogRequestedV1 === true\n    ? 'De qual modelo você quer ver fotos? Pode me dizer o número ou o nome. 😊'\n    : 'Qual modelo voce quer ver em mais detalhes? 😊');`);
  const state = `      step: 'awaiting_product_choice',\n      createdAt: new Date().toISOString(),`;
  assert.ok(code.includes(state), 'catalog state anchor changed');
  code = code.replace(state, `      step: 'awaiting_product_choice',\n      photoChoiceOfferedV1: base.photoCatalogRequestedV1 === true,\n      createdAt: new Date().toISOString(),`);
  new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', code);
  return code;
}

function patchComposer(code) {
  if (code.includes(DETAILS_MARKER)) return code;
  const anchor = `return [{
  json: {
    ...source,
    output: catalogReadyV366 ? catalogOutput : aiOutput,`;
  assert.ok(code.includes(anchor), 'sales AI composer anchor changed');
  code = code.replace(anchor, `// ${DETAILS_MARKER}: attach the registered blueprint only for one exact model/configuration in the reply.
const normalizeDetailsV1 = (value) => String(value || '').normalize('NFD')
  .replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const introDetailsV1 = ' ' + normalizeDetailsV1(aiOutput.split(/[.!?:]/, 1)[0]) + ' ';
const exactDetailMatchesV1 = catalogReadyV366 ? [] : (Array.isArray(source.productsInStock) ? source.productsInStock : [])
  .filter((product) => {
    const name = normalizeDetailsV1(product?.name);
    const memory = normalizeDetailsV1(product?.memory);
    return Boolean(name && memory && introDetailsV1.includes(' ' + name + ' ')
      && introDetailsV1.includes(' ' + memory + ' '));
  });
const detailProductV1 = exactDetailMatchesV1.length === 1 ? exactDetailMatchesV1[0] : null;
const detailBlueprintUrlV1 = String(detailProductV1?.blueprintImageUrl || '').trim();
const detailBlueprintV1 = !source.specificProductBlueprintMedia
  && /^https:\\/\\/(?:api\\.xiaomipetrolina\\.com\\.br\\/images\\/|imagens\\.xiaomipetrolina\\.com\\.br\\/)/i.test(detailBlueprintUrlV1)
  ? {
      type: 'image', mediaUrl: detailBlueprintUrlV1,
      mimetype: detailBlueprintUrlV1.split(/[?#]/, 1)[0].toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
      fileName: 'blueprint-caracteristicas.' + (detailBlueprintUrlV1.split(/[?#]/, 1)[0].toLowerCase().endsWith('.png') ? 'png' : 'jpg'),
      caption: 'Ficha técnica • ' + detailProductV1.name + ' ' + detailProductV1.memory,
      delayMs: 4500,
    }
  : null;
return [{
  json: {
    ...source,
    specificProductBlueprintMedia: source.specificProductBlueprintMedia || detailBlueprintV1,
    output: catalogReadyV366 ? catalogOutput : aiOutput,`);
  new Function('$json', '$', code);
  return code;
}

function patchNodes(nodes) {
  const updated = structuredClone(nodes);
  for (const [name, patch] of [[POST_LIST, patchPostList], [CATALOG, patchCatalog], [COMPOSER, patchComposer]]) {
    const node = updated.find((entry) => entry.name === name);
    assert.ok(node, `missing workflow node: ${name}`);
    node.parameters.jsCode = patch(String(node.parameters.jsCode || ''));
  }
  return updated;
}

async function runFixtures(nodes) {
  const postList = nodes.find((entry) => entry.name === POST_LIST).parameters.jsCode;
  const catalog = nodes.find((entry) => entry.name === CATALOG).parameters.jsCode;
  const composer = nodes.find((entry) => entry.name === COMPOSER).parameters.jsCode;
  const compose = new Function('$json', '$', composer);
  const blueprintProducts = [
    { name: 'Redmi 15', memory: '6GB/128GB', blueprintImageUrl: 'https://api.xiaomipetrolina.com.br/images/redmi-15-blueprint.jpg' },
    { name: 'Redmi 15', memory: '8GB/256GB', blueprintImageUrl: 'https://api.xiaomipetrolina.com.br/images/redmi-15-256-blueprint.jpg' },
    { name: 'Poco C71', memory: '4GB/128GB', blueprintImageUrl: 'https://api.xiaomipetrolina.com.br/images/poco-c71-blueprint.jpg' },
  ];
  const composeReply = (output, products = blueprintProducts, catalogOutput = '') =>
    compose({ output }, () => ({ first: () => ({ json: { productsInStock: products, deterministicCatalogOutput: catalogOutput } }) }))[0].json;
  const detailReply = composeReply('Vamos começar pelo Redmi 15 6GB/128GB: tela grande, bateria e câmera. Quer ver outro?');
  assert.match(detailReply.specificProductBlueprintMedia?.mediaUrl || '', /redmi-15-blueprint\.jpg$/);
  assert.match(detailReply.specificProductBlueprintMedia?.caption || '', /Redmi 15 6GB\/128GB/);
  assert.equal(composeReply('O Redmi 15 e o Poco C71 têm bateria grande.').specificProductBlueprintMedia, null);
  assert.equal(composeReply('Temos várias opções.').specificProductBlueprintMedia, null);
  assert.equal(composeReply('Redmi 15 6GB/128GB', blueprintProducts, 'Lista oficial').specificProductBlueprintMedia, null);
  assert.equal(composeReply('Redmi 15 6GB/128GB', [{ ...blueprintProducts[0], blueprintImageUrl: '' }]).specificProductBlueprintMedia, null);
  assert.equal(composeReply('Redmi 15 6GB/128GB', [{ ...blueprintProducts[0], blueprintImageUrl: 'https://example.com/image.jpg' }]).specificProductBlueprintMedia, null);
  assert.match(catalog, /base\.photoCatalogRequestedV1 === true\s*\? 'De qual modelo você quer ver fotos/);
  assert.match(catalog, /photoChoiceOfferedV1: base\.photoCatalogRequestedV1 === true/);
  const executeCatalog = new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', catalog);
  const catalogState = {};
  const base = {
    remoteJid: 'fixture@s.whatsapp.net', conversation: 'Vcs podem manda fotos?',
    productCategoryId: CATEGORY_ID, productSearchKind: 'categoria',
    photoCatalogRequestedV1: true, salesCategoryId: CATEGORY_ID,
  };
  const productRows = [
    { id: 'fixture-1', name: 'Modelo de teste A', sku: 'FIXTURE1', slug: 'modelo-a', category_name: 'Smartphones', status: 'active', stock_quantity: 1, price_retail: 100000, specs: { color: 'Preto', ram: '8GB', storage: '256GB' } },
    { id: 'fixture-2', name: 'Modelo de teste B', sku: 'FIXTURE2', slug: 'modelo-b', category_name: 'Smartphones', status: 'active', stock_quantity: 1, price_retail: 120000, specs: { color: 'Azul', ram: '8GB', storage: '256GB' } },
  ];
  const catalogLookup = (name) => ({
    first: () => ({ json: name === 'Vendas - Preparar Busca' ? base : {} }),
    all: () => name === 'Vendas - Buscar Produtos' ? productRows.map((json) => ({ json })) : [],
  });
  const catalogResult = await executeCatalog({}, { all: () => [] }, () => catalogState, catalogLookup, {}, {});
  const catalogOutput = JSON.stringify(catalogResult);
  assert.match(catalogOutput, /De qual modelo você quer ver fotos/);
  assert.equal(catalogState.salesPostList?.[base.remoteJid]?.photoChoiceOfferedV1, true);
  const execute = new Function('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', postList);
  const remoteJid = 'fixture@s.whatsapp.net';
  const invoke = (message, state = null, extra = {}) => {
    const source = { remoteJid, conversation: message, salesFlowAction: 'pedir_foto', ...extra };
    const staticData = { salesPostList: state ? { [remoteJid]: state } : {} };
    const lookup = () => ({ first: () => ({ json: source }), all: () => [{ json: source }] });
    return execute({}, {}, () => staticData, lookup, {}, { httpRequest: async () => [] });
  };
  const initial = await invoke('Vcs podem manda fotos?');
  assert.equal(initial[0].json.salesPostListHandled, false);
  assert.equal(initial[0].json.salesCategoryId, CATEGORY_ID);
  assert.equal(initial[0].json.photoCatalogRequestedV1, true);
  assert.doesNotMatch(String(initial[0].json.output || ''), /Me informa qual modelo/);
  const misclassified = await invoke('Vcs podem manda fotos?', null, { salesFlowAction: 'nova_busca' });
  assert.equal(misclassified[0].json.photoCatalogRequestedV1, true);

  const state = {
    flow: 'sales_post_list', step: 'awaiting_product_choice',
    expiresAt: Date.now() + 60_000, photoChoiceOfferedV1: true,
    options: [{ number: 1, name: 'Modelo de teste', colors: [] }],
  };
  const existingList = await invoke('Vcs podem manda fotos?', { ...state, photoChoiceOfferedV1: false });
  assert.equal(existingList[0].json.salesPostListHandled, true);
  assert.match(existingList[0].json.output, /De qual modelo você quer ver fotos/);
  assert.doesNotMatch(existingList[0].json.output, /mercadodovale\.com\.br/);
  const all = await invoke('Todos', state, { salesFlowAction: 'nova_busca' });
  assert.equal(all[0].json.salesPostListHandled, true);
  assert.match(all[0].json.output, /mercadodovale\.com\.br\/\?categoria=Smartphones/);
  assert.match(all[0].json.output, /algum modelo específico/);
  assert.equal(state.photoChoiceOfferedV1, false);

  const unrelated = await invoke('Todos', { ...state, photoChoiceOfferedV1: false }, { salesFlowAction: 'nova_busca' });
  assert.equal(unrelated[0].json.salesPostListHandled, false);
  const mediaOptions = Array.from({ length: 4 }, (_, index) => ({
    number: index + 1, name: 'Modelo ' + (index + 1), colors: [{
      color: 'Preto', sku: 'PHOTO' + (index + 1),
      images: ['https://api.xiaomipetrolina.com.br/images/photo-' + (index + 1) + '.jpg'],
      blueprintImageUrl: 'https://api.xiaomipetrolina.com.br/images/blueprint-' + (index + 1) + '.jpg',
    }],
  }));
  const mediaState = { ...state, options: mediaOptions, photoChoiceOfferedV1: true };
  const one = await invoke('Foto do modelo 1', structuredClone(mediaState), {
    salesFlowItemNumber: 1, salesFlowItemNumbers: [1],
  });
  assert.equal(one[0].json.salesPostListHandled, true, JSON.stringify(one[0].json));
  assert.ok(one[0].json.messages?.some((item) => String(item.fileName || '').startsWith('blueprint-')));
  assert.ok(one[0].json.messages?.some((item) => item.type === 'image' && !String(item.fileName || '').startsWith('blueprint-')));
  const three = await invoke('Fotos dos modelos 1, 2 e 3', structuredClone(mediaState), {
    salesFlowItemNumber: 1, salesFlowItemNumbers: [1, 2, 3],
  });
  assert.equal(three[0].json.salesPostListHandled, true);
  assert.equal(three[0].json.messages.filter((item) => item.type === 'image').length, 6);
  assert.equal(three[0].json.messages.filter((item) => String(item.fileName || '').startsWith('blueprint-')).length, 3);
  const four = await invoke('Fotos dos modelos 1, 2, 3 e 4', structuredClone(mediaState), {
    salesFlowItemNumber: 1, salesFlowItemNumbers: [1, 2, 3, 4],
  });
  assert.match(four[0].json.output, /até 3 modelos/);
  assert.equal(four[0].json.messages, undefined);
  console.log('photo-catalog fixtures passed: initial list, all-photos link, one and three models with blueprints, four-model limit, characteristics blueprint');
}

const shellQuote = (value) => "'" + String(value).replace(/'/g, "'\\''") + "'";
const sqlQuote = (value) => "'" + String(value).replace(/'/g, "''") + "'";
const dollar = (value, tag) => {
  assert.ok(!String(value).includes(`$${tag}$`), `dollar-quote collision: ${tag}`);
  return `$${tag}$${value}$${tag}$`;
};
function runRemote(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let output = ''; let stderr = '';
    stream.on('data', (chunk) => { output += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(stderr || `remote exit ${code}`)));
  }));
}
function psql(connection, db, sql) {
  return new Promise((resolve, reject) => connection.exec(
    `docker exec -i ${shellQuote(db)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`,
    (error, stream) => {
      if (error) return reject(error);
      let output = ''; let stderr = '';
      stream.on('data', (chunk) => { output += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(stderr || `psql exit ${code}`)));
      stream.end(sql);
    },
  ));
}
async function readWorkflow(connection, db) {
  const raw = await psql(connection, db, `COPY (
    SELECT json_build_object(
      'nodesHex', encode(convert_to(we.nodes::text, 'UTF8'), 'hex'),
      'connectionsHex', encode(convert_to(we.connections::text, 'UTF8'), 'hex'),
      'activeVersionId', we."activeVersionId", 'active', we.active,
      'versionAligned', we."versionId" = we."activeVersionId",
      'entityHistoryEqual', we.nodes::jsonb = wh.nodes::jsonb AND we.connections::jsonb = wh.connections::jsonb
    )::text
    FROM workflow_entity we
    JOIN workflow_history wh ON wh."workflowId" = we.id AND wh."versionId" = we."activeVersionId"
    WHERE we.id = ${sqlQuote(WORKFLOW_ID)}
  ) TO STDOUT;`);
  assert.ok(raw.trim(), 'active workflow history missing');
  const value = JSON.parse(raw.trim());
  return {
    ...value,
    nodes: JSON.parse(Buffer.from(value.nodesHex, 'hex').toString('utf8')),
    connections: JSON.parse(Buffer.from(value.connectionsHex, 'hex').toString('utf8')),
  };
}
async function waitService(connection, service, expected) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const replicas = (await runRemote(connection,
      `docker service ls --filter name=${shellQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}
async function backupRemote(connection, snapshot) {
  const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-${MARKER}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await runRemote(connection, 'mkdir -p /root/n8n-backups');
  const content = JSON.stringify({ workflowId: WORKFLOW_ID, activeVersionId: snapshot.activeVersionId,
    nodes: snapshot.nodes, connections: snapshot.connections });
  const sftp = await new Promise((resolve, reject) => connection.sftp((error, handle) => error ? reject(error) : resolve(handle)));
  await new Promise((resolve, reject) => sftp.writeFile(backupPath, Buffer.from(content), { flag: 'wx' },
    (error) => error ? reject(error) : resolve()));
  return backupPath;
}
async function main() {
  const apply = process.argv.includes('--apply');
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let runnerStopped = false;
  let mainStopped = false;
  try {
    const db = (await runRemote(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n database container missing');
    const current = await readWorkflow(connection, db);
    assert.equal(current.active, true, 'workflow must be active');
    assert.equal(current.versionAligned, true, 'workflow draft/active version mismatch');
    assert.equal(current.entityHistoryEqual, true, 'workflow entity/history mismatch');
    const patched = patchNodes(current.nodes);
    assert.equal(patched.length, current.nodes.length);
    assert.deepEqual(patchNodes(patched), patched, 'workflow patch must be idempotent');
    await runFixtures(patched);
    const changed = JSON.stringify(patched) !== JSON.stringify(current.nodes);
    if (!apply) {
      console.log(JSON.stringify({ dryRun: true, workflowId: WORKFLOW_ID, changed,
        nodesChanged: [POST_LIST, CATALOG, COMPOSER], nodeCount: current.nodes.length,
        activeVersionId: current.activeVersionId, entityHistoryEqual: current.entityHistoryEqual }));
      return;
    }
    assert.equal(changed, true, 'workflow already patched');
    const activeExecutions = Number((await psql(connection, db, `COPY (
      SELECT count(*) FROM execution_entity
      WHERE "workflowId" = ${sqlQuote(WORKFLOW_ID)} AND status IN ('new', 'running')
    ) TO STDOUT;`)).trim());
    assert.equal(activeExecutions, 0, 'workflow has active executions; aborting publication');
    const backupPath = await backupRemote(connection, current);
    await runRemote(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    runnerStopped = true;
    await waitService(connection, 'n8n_n8n-runner', 0);
    await runRemote(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    mainStopped = true;
    await waitService(connection, 'n8n_n8n', 0);
    const stoppedSnapshot = await readWorkflow(connection, db);
    assert.equal(stoppedSnapshot.activeVersionId, current.activeVersionId, 'active version changed during preflight');
    assert.deepEqual(stoppedSnapshot.nodes, current.nodes, 'workflow changed during preflight');
    assert.deepEqual(stoppedSnapshot.connections, current.connections, 'connections changed during preflight');
    const payload = dollar(JSON.stringify(patched), 'photoNodes');
    const result = await psql(connection, db, `BEGIN;
      UPDATE workflow_entity SET nodes = ${payload}::json, "updatedAt" = NOW()
      WHERE id = ${sqlQuote(WORKFLOW_ID)} AND "activeVersionId" = ${sqlQuote(current.activeVersionId)};
      UPDATE workflow_history SET nodes = ${payload}::json, "updatedAt" = NOW()
      WHERE "workflowId" = ${sqlQuote(WORKFLOW_ID)} AND "versionId" = ${sqlQuote(current.activeVersionId)};
      COMMIT;
      COPY (SELECT json_build_object('active', we.active,
        'versionAligned', we."versionId" = we."activeVersionId",
        'entityHistoryEqual', we.nodes::jsonb = wh.nodes::jsonb AND we.connections::jsonb = wh.connections::jsonb,
        'genericPhotoMarker', we.nodes::text LIKE '%${MARKER}%',
        'detailsMarker', we.nodes::text LIKE '%${DETAILS_MARKER}%'
      )::text FROM workflow_entity we JOIN workflow_history wh
      ON wh."workflowId" = we.id AND wh."versionId" = we."activeVersionId"
      WHERE we.id = ${sqlQuote(WORKFLOW_ID)}) TO STDOUT;`);
    const verification = JSON.parse(result.trim());
    assert.equal(verification.active, true);
    assert.equal(verification.versionAligned, true);
    assert.equal(verification.entityHistoryEqual, true);
    assert.equal(verification.genericPhotoMarker, true);
    assert.equal(verification.detailsMarker, true);
    await runRemote(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    mainStopped = false;
    await runRemote(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    runnerStopped = false;
    const live = await readWorkflow(connection, db);
    assert.deepEqual(live.nodes, patched, 'live workflow differs after restart');
    assert.deepEqual(live.connections, current.connections, 'workflow connections changed');
    console.log(JSON.stringify({ applied: true, workflowId: WORKFLOW_ID, backupPath,
      activeVersionId: live.activeVersionId, verification, nodeCount: live.nodes.length }));
  } finally {
    if (mainStopped) {
      await runRemote(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n', 1).catch(() => {});
    }
    if (runnerStopped) {
      await runRemote(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

if (require.main === module) {
  if (!process.argv.includes('--dry-run-production') && !process.argv.includes('--apply')) {
    console.error('Use --dry-run-production or --apply.');
    process.exitCode = 2;
  } else main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
}

module.exports = { patchPostList, patchCatalog, patchComposer, patchNodes, runFixtures, MARKER };

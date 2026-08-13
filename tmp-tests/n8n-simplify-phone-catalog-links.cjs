const assert = require('node:assert/strict');
const path = require('node:path');
const { Client } = require('ssh2');

for (const root of [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'mercado-do-vale')]) {
  require('dotenv').config({ path: path.join(root, '.env.vps.local'), quiet: true });
  require('dotenv').config({ path: path.join(root, '.env.local'), quiet: true });
}

const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const CONTEXT_NODE = 'Vendas - Contexto Produtos';
const POST_LIST_NODE = 'Vendas - Verificar Pos Lista';
const MARKER = 'phone-catalog-adjacent-variations-no-links-v245';
const LINK_MARKER = 'explicit-product-link-request-v245';
const APPLY = process.argv.includes('--apply');

const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function runRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => (
        code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`))
      ));
    });
  });
}

function putRemote(conn, remotePath, value) {
  return new Promise((resolve, reject) => {
    conn.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(remotePath, Buffer.from(value, 'utf8'), (writeError) => {
        sftp.end();
        writeError ? reject(writeError) : resolve();
      });
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitService(conn, service, replicas) {
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const current = (await runRemote(
      conn,
      `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`,
    )).trim();
    if (current === `${replicas}/${replicas}`) return;
    await sleep(2500);
  }
  throw new Error(`Timeout waiting for ${service}=${replicas}`);
}

function nodeByName(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  assert.ok(node, `${name} must exist`);
  return node;
}

function patchContext(code) {
  let result = code;
  if (!result.includes(MARKER)) {
    const legacyGrouping = /const quoteProductGroupKey = \(product\) => isQuoteDeviceProduct\(product\)\s*\? 'device\|' \+ normalizeKey\(product\.name\)\s*: 'single\|' \+ normalizeKey\(product\.name\) \+ '\|' \+ normalizeKey\(product\.memory\) \+ '\|' \+ product\.priceCents;/;
    if (legacyGrouping.test(result)) {
      result = result.replace(legacyGrouping, `// product-variation-numbering-v229\nconst quoteProductGroupKey = (product) => [\n  'product',\n  normalizeKey(product.name),\n  normalizeKey(product.memory),\n  product.priceCents,\n].join('|');`);
    }
    assert.ok(result.includes('product-variation-numbering-v229'), 'numbered variation grouping must exist');
    const oldSort = "const products = mergeQuoteProducts(rawProducts).sort((a, b) => {\n  if (!prefersSmartphones) return 0;\n  const ga = quoteBrandGroupV227(a);\n  const gb = quoteBrandGroupV227(b);\n  return ga.rank - gb.rank || ga.label.localeCompare(gb.label, 'pt-BR') || toNumber(a.priceCents) - toNumber(b.priceCents);\n});";
    const adjacentSort = `// ${MARKER}\nconst products = mergeQuoteProducts(rawProducts).sort((a, b) => {\n  if (!prefersSmartphones) return 0;\n  const ga = quoteBrandGroupV227(a);\n  const gb = quoteBrandGroupV227(b);\n  return ga.rank - gb.rank\n    || ga.label.localeCompare(gb.label, 'pt-BR')\n    || normalizeKey(a.name).localeCompare(normalizeKey(b.name), 'pt-BR')\n    || toNumber(a.storageGb) - toNumber(b.storageGb)\n    || toNumber(a.ramGb) - toNumber(b.ramGb)\n    || toNumber(a.priceCents) - toNumber(b.priceCents);\n});`;
    assert.ok(result.includes(oldSort), 'known smartphone sorting must exist');
    result = result.replace(oldSort, adjacentSort);
  }

  result = result
    .replace(/\s*product\.url \? 'Link: ' \+ product\.url : '',/g, '')
    .replace(/\n\s*if \(product\.url\) quoteLines\.push\('   🔗 ' \+ product\.url\);/g, '')
    .replace(/\n\s*if \(product\.url\) chunkLines\.push\('   🔗 ' \+ product\.url\);/g, '');

  assert.ok(result.includes(MARKER), 'model grouping marker must be present');
  assert.ok(result.includes('product-variation-numbering-v229'), 'variation numbering must be preserved');
  assert.ok(!/quoteLines\.push\('   🔗 '/.test(result), 'initial quote must not contain links');
  assert.ok(!/chunkLines\.push\('   🔗 '/.test(result), 'chunked quote must not contain links');
  assert.doesNotThrow(() => new Function('$json', '$items', '$getWorkflowStaticData', result));
  return result;
}

function patchPostList(code) {
  if (code.includes(LINK_MARKER)) return code;
  let result = code;
  result = result.replace(
    "const wantsPhoto = /\\b(foto|fotos|imagem|imagens|manda foto|ver foto|mostrar foto)\\b/.test(normalized);",
    `const wantsPhoto = /\\b(foto|fotos|imagem|imagens|manda foto|ver foto|mostrar foto)\\b/.test(normalized);\n// ${LINK_MARKER}\nconst wantsProductLink = /\\b(?:link|site|pagina|página)\\b/.test(normalized) && /\\b(?:manda|mandar|envia|enviar|pode|quero|abre|abrir|ver|produto|aparelho|celular|modelo|item|opcao|opção|numero|número)\\b/.test(normalized);`,
  );
  assert.ok(result.includes(LINK_MARKER), 'explicit link detector must be added');

  result = result.replace(
    "const selectedNumber = requestedQuantity\n  ? Number(activeState?.selectedOptionNumber || 0)\n  : (aiExplicitListNumber || (aiUsesCurrentSelection ? Number(activeState?.selectedOptionNumber || 0) : 0));",
    "const explicitLinkListNumberV245 = wantsProductLink && numberMatch ? Number(numberMatch[1]) : 0;\nconst selectedNumber = requestedQuantity\n  ? Number(activeState?.selectedOptionNumber || 0)\n  : (explicitLinkListNumberV245 || aiExplicitListNumber || (aiUsesCurrentSelection || wantsProductLink ? Number(activeState?.selectedOptionNumber || 0) : 0));",
  );
  result = result.replace(
    'if (!selectedNumber && !wantsPhoto && !wantsPhotoFromAI && !mentionedColor) {',
    'if (!selectedNumber && !wantsPhoto && !wantsPhotoFromAI && !wantsProductLink && !mentionedColor) {',
  );
  result = result.replace(
    "const isQuantityStep = hasOrderDraft && ['awaiting_quantity', 'awaiting_photo_confirmation'].includes(String(activeState?.step || ''));",
    "const isQuantityStep = hasOrderDraft && ['awaiting_quantity', 'awaiting_photo_confirmation', 'awaiting_fulfillment'].includes(String(activeState?.step || ''));",
  );
  result = result.replace(
    'const optionColorItems = uniqueColorItems(option?.colors || []);',
    `const optionColorItems = uniqueColorItems(option?.colors || []);\nconst selectedOptionLinkV245 = String(\n  activeState?.orderDraft?.url\n  || option?.url\n  || option?.memoryOptions?.find((item) => item?.url)?.url\n  || optionColorItems.find((item) => item?.url)?.url\n  || ''\n).trim();\nconst selectedOptionSummaryV245 = [\n  option?.name || '',\n  option?.memory ? '📱 ' + option.memory : '',\n  optionColorItems.length ? '🎨 Cores: ' + joinPt(optionColorItems.map((item) => titleCase(item.color)).filter(Boolean)) : '',\n  selectedOptionLinkV245 ? '' : null,\n  selectedOptionLinkV245 ? 'Veja fotos, vídeos e mais detalhes neste link:' : '',\n  selectedOptionLinkV245,\n].filter((line) => line !== null && line !== undefined).join(lineBreak);`,
  );
  result = result.replace(
    '].filter((line) => line !== null && line !== undefined).join(lineBreak);',
    "].filter((line) => line !== null && line !== undefined).join(lineBreak);\nconst pendingSelectedOptionSummaryV245 = activeState?.selectedOptionSummarySentV245 === true ? '' : selectedOptionSummaryV245;",
  );

  const optionGuard = `if (!option) {\n  return [{`;
  const explicitLinkBranch = `if (wantsProductLink) {\n  return [{\n    json: {\n      ...source,\n      salesPostListHandled: true,\n      salesPostListStep: activeState.step,\n      output: withGreeting(selectedOptionLinkV245\n        ? 'Claro 😊 Aqui está o link do ' + option.name + ':' + lineBreak + selectedOptionLinkV245\n        : 'Esse aparelho está sem link cadastrado no momento. Posso conferir os detalhes para você.'),\n    },\n  }];\n}\n\n${optionGuard}`;
  assert.ok(result.includes(optionGuard), 'option guard must exist');
  result = result.replace(optionGuard, explicitLinkBranch);

  result = result.replace(
    /output: withGreeting\('Perfeito [^']*Temos ' \+ colorsText \+ '\. Qual cor voce prefere\?'\),/,
    "output: withGreeting([pendingSelectedOptionSummaryV245, 'Qual cor voce prefere? 😊'].filter(Boolean).join(lineBreak + lineBreak)),",
  );
  result = result.replace(
    /activeState\.updatedAt = new Date\(now\)\.toISOString\(\);\s*const colorsText = joinPt\(allColors\.map\(titleCase\)\);/,
    "activeState.updatedAt = new Date(now).toISOString();\n  activeState.selectedOptionSummarySentV245 = true;\n  const colorsText = joinPt(allColors.map(titleCase));",
  );
  result = result.replace(
    /output: withGreeting\('Perfeito [^']*Separei o ' \+ option\.name \+ \(option\.memory \? ' ' \+ option\.memory : ''\) \+ ' na cor ' \+ titleCase\(variant\.color\) \+ '\.' \+ lineBreak \+ 'Quantas unidades voce deseja\?'\),/,
    "output: withGreeting([pendingSelectedOptionSummaryV245, 'Voce prefere retirada na loja ou entrega? 😊'].filter(Boolean).join(lineBreak + lineBreak)),",
  );
  result = result.replace(
    "activeState.step = 'awaiting_quantity';\nactiveState.selectedOptionNumber = option.number;\nactiveState.selectedColor = variant.color;\nactiveState.orderDraft = buildOrderDraft(variant);",
    "activeState.step = 'awaiting_fulfillment';\nactiveState.selectedOptionNumber = option.number;\nactiveState.selectedColor = variant.color;\nactiveState.orderDraft = { ...buildOrderDraft(variant), quantity: 1 };",
  );
  result = result.replace(
    "if (activeState?.step === 'awaiting_fulfillment') {",
    `// default-one-unit-v245\nif (activeState?.step === 'awaiting_fulfillment') {\n  if (requestedQuantity > 0) {\n    activeState.orderDraft = { ...activeState.orderDraft, quantity: requestedQuantity };\n    activeState.updatedAt = new Date(now).toISOString();\n    const unidadeV245 = requestedQuantity === 1 ? 'unidade' : 'unidades';\n    return [{ json: { ...source, salesPostListHandled: true, salesPostListStep: activeState.step, orderDraft: activeState.orderDraft, output: withGreeting('Certo 😊 Atualizei para ' + requestedQuantity + ' ' + unidadeV245 + '.' + lineBreak + 'Voce prefere retirada na loja ou entrega?') } }];\n  }`,
  );

  result = result.replace(/\s*draft\.url \? 'Link: ' \+ draft\.url : '',/g, '');

  assert.ok(result.includes('selectedOptionSummaryV245'), 'number selection must carry the selected variation summary and link');
  assert.ok(result.includes("quantity: 1"), 'a selected variation must default to one unit');
  assert.ok(result.includes('default-one-unit-v245'), 'an explicit larger quantity must still update the draft');
  assert.ok(result.includes("'awaiting_fulfillment'"), 'quantity changes must be accepted after the default quantity is set');
  assert.ok(result.includes('selectedOptionSummarySentV245'), 'the selected summary and link must not repeat after color choice');
  assert.ok(!/draft\.url \? 'Link: '/.test(result), 'order summary must not append links automatically');
  assert.doesNotThrow(() => new Function('$json', '$getWorkflowStaticData', result));
  return result;
}

function summarize(contextCode, postListCode) {
  return {
    modelGrouping: contextCode.includes(MARKER),
    variationNumberingPreserved: contextCode.includes('product-variation-numbering-v229'),
    initialLinksRemoved: !/quoteLines\.push\('   🔗 '|chunkLines\.push\('   🔗 '|product\.url \? 'Link: '/.test(contextCode),
    explicitLinkRequest: postListCode.includes(LINK_MARKER),
    selectedNumberSendsLink: postListCode.includes('selectedOptionSummaryV245'),
    defaultsToOneUnit: postListCode.includes('default-one-unit-v245') && postListCode.includes('quantity: 1'),
    noRepeatedSelectionSummary: postListCode.includes('selectedOptionSummarySentV245'),
    orderSummaryLinksRemoved: !/draft\.url \? 'Link: '/.test(postListCode),
  };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await runRemote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n database container must be running');
    const readSql = `COPY (SELECT encode(convert_to(json_build_object('nodes', nodes::jsonb, 'activeVersionId', "activeVersionId")::text, 'UTF8'), 'hex') FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const raw = await runRemote(conn, `docker exec ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A -c ${shQuote(readSql)}`);
    const workflow = JSON.parse(Buffer.from(raw.trim(), 'hex').toString('utf8'));
    const contextNode = nodeByName(workflow.nodes, CONTEXT_NODE);
    const postListNode = nodeByName(workflow.nodes, POST_LIST_NODE);
    contextNode.parameters.jsCode = patchContext(String(contextNode.parameters?.jsCode || ''));
    postListNode.parameters.jsCode = patchPostList(String(postListNode.parameters?.jsCode || ''));
    const summary = summarize(contextNode.parameters.jsCode, postListNode.parameters.jsCode);
    if (!APPLY) {
      console.log(JSON.stringify({ apply: false, ...summary }, null, 2));
      return;
    }

    await runRemote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 0);
    await runRemote(conn, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(conn, 'n8n_n8n', 0);
    stopped = true;

    const remotePath = '/tmp/mdv-n8n-phone-catalog-no-links-v245.json';
    await putRemote(conn, remotePath, JSON.stringify(workflow.nodes));
    await runRemote(conn, `docker cp ${shQuote(remotePath)} ${shQuote(db)}:${shQuote(remotePath)}`);
    const sql = `BEGIN;
UPDATE workflow_entity SET nodes=pg_read_file('${remotePath}')::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=pg_read_file('${remotePath}')::json WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(workflow.activeVersionId)};
COMMIT;`;
    await runRemote(conn, `docker exec ${shQuote(db)} psql -U postgres -d n8n -X -v ON_ERROR_STOP=1 -c ${shQuote(sql)}`);

    await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(conn, 'n8n_n8n', 1);
    await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(conn, 'n8n_n8n-runner', 1);
    stopped = false;

    const verifySql = `COPY (SELECT json_build_object(
      'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb,
      'contextMarker', we.nodes::text LIKE '%${MARKER}%',
      'linkMarker', we.nodes::text LIKE '%${LINK_MARKER}%',
      'variationNumberingPreserved', we.nodes::text LIKE '%product-variation-numbering-v229%',
      'active', we.active,
      'versionAligned', we."versionId"=we."activeVersionId"
    )::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification = JSON.parse((await runRemote(conn, `docker exec ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A -c ${shQuote(verifySql)}`)).trim());
    console.log(JSON.stringify({ apply: true, ...summary, ...verification }, null, 2));
    await runRemote(conn, `rm -f ${shQuote(remotePath)}`).catch(() => {});
  } finally {
    if (stopped) {
      await runRemote(conn, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(conn, 'n8n_n8n', 1).catch(() => {});
      await runRemote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
    }
    conn.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { patchContext, patchPostList, summarize };

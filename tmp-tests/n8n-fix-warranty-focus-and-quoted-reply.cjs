const assert = require('node:assert/strict');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const { readWorkflow } = require('./n8n-warranty-policy.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const FOCUS_MARKER = 'warranty-recommended-model-focus-v2';
const QUOTE_MARKER = 'quoted-customer-question-v2';
const q = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

function replaceOnce(source, before, after, label) {
  assert.equal(source.split(before).length, 2, `${label} anchor must occur exactly once`);
  return source.replace(before, after);
}

function patchWarranty(code) {
  if (code.includes(FOCUS_MARKER)) return code;
  assert.match(code, /warranty-table-source-v1/);
  let next = replaceOnce(
    code,
    "  const safeReplyV1 = 'Para te passar o prazo correto da garantia, me diga a marca e o modelo do produto, por favor. 😊';",
    "  let safeReplyV1 = 'Para te passar o prazo correto da garantia, me diga a marca e o modelo do produto, por favor. 😊';",
    'warranty fallback',
  );
  next = replaceOnce(
    next,
    "    salesPostListStep: String(activeState?.step || ''), output: withGreeting(message) } }];",
    "    salesPostListStep: String(activeState?.step || ''), output: withGreeting(message),\n    replyToWaMessageId: String(source.messageId || source.waMessageId || '').trim(),\n    replyToText: String(source.conversation || '').trim() } }];",
    'warranty reply metadata',
  );
  const focusBlock = String.raw`
  // warranty-recommended-model-focus-v2: use the recommendation the client accepted, not the whole catalog.
  const acceptedRecommendationV2 = recentV1.slice(-10).some((row) => row?.direction === 'inbound'
    && /\b(?:gostei|esse|desse|valor)\b/.test(normV1(row?.text || row?.message_text || '')));
  const recentRecommendationV2 = acceptedRecommendationV2 ? [...recentV1].reverse().find((row) => {
    if (row?.direction !== 'outbound') return false;
    const reply = String(row?.text || row?.message_text || '');
    if (reply.length > 500 || !/recomend|r\s*\$/i.test(reply)) return false;
    const normalizedReply = normV1(reply);
    return optionsV1.some((item) => normalizedReply.includes(normV1(item?.name)));
  }) : null;
  const recommendationTextV2 = normV1(recentRecommendationV2?.text || recentRecommendationV2?.message_text || '');
  const mentionedModelsV2 = [...new Map(optionsV1.map((item) => [normV1(item?.name), item?.name])).entries()]
    .filter(([key]) => key.length >= 3 && recommendationTextV2.includes(key))
    .map(([key, name]) => ({ key, name, position: recommendationTextV2.indexOf(key) }))
    .sort((left, right) => left.position - right.position || right.key.length - left.key.length);
  const explicitlyNamedV2 = [...new Set(optionsV1.filter((item) => {
    const key = normV1(item?.name);
    return key.length >= 3 && directQueryV1.includes(key);
  }).map((item) => normV1(item.name)))];
  const focusedNameV2 = String((explicitlyNamedV2.length === 1
    ? optionsV1.find((item) => normV1(item?.name) === explicitlyNamedV2[0])?.name : '')
    || mentionedModelsV2[0]?.name || activeState?.focusedModelName || '');
  const focusedVariantsV2 = focusedNameV2 && (!explicitModelV1 || explicitlyNamedV2.length === 1)
    ? optionsV1.filter((item) => normV1(item?.name) === normV1(focusedNameV2)) : [];
  if (focusedVariantsV2.length && activeState) {
    activeState.focusedModelName = focusedVariantsV2[0].name;
    activeState.updatedAt = new Date(now).toISOString();
    safeReplyV1 = 'Já identifiquei o ' + focusedVariantsV2[0].name
      + ', mas não consegui confirmar o prazo da garantia agora. Vou pedir a um atendente que confira para você. 😊';
  }
`;
  next = replaceOnce(
    next,
    '  const recentV1 = Array.isArray(source.recentMessages) ? source.recentMessages : [];\n',
    '  const recentV1 = Array.isArray(source.recentMessages) ? source.recentMessages : [];\n' + focusBlock,
    'warranty conversation focus',
  );
  next = replaceOnce(
    next,
    '  let optionV1 = explicitNumberV1 ? optionsV1.find((item) => Number(item?.number) === Number(explicitNumberV1[1])) : null;',
    '  let optionV1 = explicitNumberV1 ? optionsV1.find((item) => Number(item?.number) === Number(explicitNumberV1[1])) : null;\n'
      + '  if (!optionV1 && focusedVariantsV2.length === 1) optionV1 = focusedVariantsV2[0];',
    'warranty selected option',
  );
  const variantBlock = String.raw`    // Compare every stocked variant before applying a model-wide warranty term.
    if (!optionV1 && !activeState?.orderDraft?.productId && focusedVariantsV2.length > 1) {
      const idsV2 = [...new Set(focusedVariantsV2.flatMap((item) => [
        ...(Array.isArray(item?.colors) ? item.colors.map((color) => color?.productId) : []),
        ...(Array.isArray(item?.memoryOptions) ? item.memoryOptions.flatMap((memory) => memory?.productIds || []) : []),
      ]).filter(Boolean).map(String))];
      if (idsV2.length > 0 && idsV2.length <= 20) {
        const variantsV2 = await Promise.all(idsV2.map(async (id) => {
          const response = await fetch('https://api.xiaomipetrolina.com.br/products/' + encodeURIComponent(id));
          return response.ok ? response.json() : null;
        }));
        if (variantsV2.every(Boolean)) {
          const policiesV2 = new Set(variantsV2.map((item) => [
            String(item.warranty_type || 'brand').toLowerCase(),
            String(item.warranty_template_id || ''),
            normV1(item.brand),
            String(item.category_id || ''),
          ].join('|')));
          if (policiesV2.size === 1) productV1 = variantsV2[0];
          else safeReplyV1 = 'As versões do ' + focusedVariantsV2[0].name
            + ' têm condições de garantia diferentes. Qual versão de memória você prefere?';
        }
      }
    }
`;
  next = replaceOnce(
    next,
    "    let productV1 = null;\n    const productIdV1 = String(activeState?.orderDraft?.productId || optionIdV1(optionV1) || '');\n    if (productIdV1) {",
    "    let productV1 = null;\n" + variantBlock
      + "    const productIdV1 = String(activeState?.orderDraft?.productId || optionIdV1(optionV1) || '');\n    if (!productV1 && productIdV1) {",
    'warranty variant policy check',
  );
  next = replaceOnce(
    next,
    '    if (!productV1 && directQueryV1 && !optionV1) {',
    '    if (!productV1 && directQueryV1 && !optionV1 && focusedVariantsV2.length === 0) {',
    'warranty name search guard',
  );
  new Function('$json', '$', '$getWorkflowStaticData', 'fetch', next);
  return next;
}

function patchSplitter(code) {
  if (code.includes(QUOTE_MARKER)) return code;
  let next = replaceOnce(
    code,
    '  return { json: { message: safeMessageTextV320,',
    String.raw`  // quoted-customer-question-v2: only quote when the upstream answer names a real inbound message.
  const replyToWaMessageIdV2 = String(message?.replyToWaMessageId || $json.replyToWaMessageId || '').trim();
  const replyToTextV2 = String(message?.replyToText || $json.replyToText || '').trim();
  const quoteThisTextV2 = index === 0 && message?.type !== 'image'
    && Boolean(replyToWaMessageIdV2 && replyToTextV2);
  return { json: { message: safeMessageTextV320,`,
    'splitter quote input',
  );
  next = replaceOnce(
    next,
    'totalMessages: all.length, remoteJid, instancia, inboundWaMessageId } };',
    'totalMessages: all.length, remoteJid, instancia, inboundWaMessageId,\n'
      + "      replyToWaMessageId: quoteThisTextV2 ? replyToWaMessageIdV2 : '',\n"
      + "      replyToText: quoteThisTextV2 ? replyToTextV2 : '' } };",
    'splitter quote output',
  );
  new Function('$json', '$', next);
  return next;
}

function patchWorkflow(workflow) {
  const cloned = structuredClone(workflow);
  const warrantyNode = cloned.nodes.find((node) => node.name === 'Vendas - Verificar Pos Lista');
  const splitterNode = cloned.nodes.find((node) => node.name === 'Dividir mensagens');
  assert.ok(warrantyNode?.parameters?.jsCode && splitterNode?.parameters?.jsCode, 'required bot nodes missing');
  warrantyNode.parameters.jsCode = patchWarranty(warrantyNode.parameters.jsCode);
  splitterNode.parameters.jsCode = patchSplitter(splitterNode.parameters.jsCode);
  return cloned;
}

function remote(conn, command) {
  return new Promise((resolve, reject) => conn.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '', stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote exit ${code}`)));
  }));
}

async function writeRemote(conn, path, content) {
  await new Promise((resolve, reject) => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    sftp.writeFile(path, Buffer.from(content, 'utf8'), (writeError) => { sftp.end(); writeError ? reject(writeError) : resolve(); });
  }));
}

async function psql(conn, container, sql) {
  return remote(conn, `docker exec -i ${q(container)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1 <<'SQL'\n${sql}\nSQL`);
}

async function waitService(conn, service, count, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const replicas = (await remote(conn, `docker service ls --filter name=${q(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${count}/${count}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${count}/${count}`);
}

async function applyWorkflow(conn, workflow) {
  const container = (await remote(conn, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
  assert.ok(container, 'n8n Postgres unavailable');
  assert.equal(workflow.versionId, workflow.activeVersionId, 'active workflow version mismatch');
  const inFlightSql = `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${q(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`;
  assert.equal(Number((await psql(conn, container, inFlightSql)).trim()), 0, 'workflow has in-flight executions');
  const historySql = `COPY (SELECT json_build_object('entity',row_to_json(e),'history',row_to_json(h))::text FROM workflow_entity e JOIN workflow_history h ON h."workflowId"=e.id AND h."versionId"=e."activeVersionId" WHERE e.id=${q(WORKFLOW_ID)}) TO STDOUT;`;
  const backup = await psql(conn, container, historySql);
  assert.ok(backup.trim(), 'active workflow history missing');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `/root/n8n-backups/${WORKFLOW_ID}-before-${FOCUS_MARKER}-${stamp}.json`;
  await remote(conn, 'mkdir -p /root/n8n-backups');
  await writeRemote(conn, backupPath, backup);
  const nodesPath = `/tmp/${WORKFLOW_ID}-${FOCUS_MARKER}-${stamp}.json`;
  let runnerScaled = false, mainScaled = false;
  try {
    await remote(conn, 'docker service scale n8n_n8n-runner=0 >/dev/null'); runnerScaled = true; await waitService(conn, 'n8n_n8n-runner', 0);
    await remote(conn, 'docker service scale n8n_n8n=0 >/dev/null'); mainScaled = true; await waitService(conn, 'n8n_n8n', 0);
    await writeRemote(conn, nodesPath, JSON.stringify(workflow.nodes));
    await remote(conn, `docker cp ${q(nodesPath)} ${q(container)}:${q(nodesPath)}`);
    await psql(conn, container, `BEGIN; UPDATE workflow_entity SET nodes=pg_read_file('${nodesPath}')::json, "updatedAt"=NOW() WHERE id=${q(WORKFLOW_ID)} AND "activeVersionId"=${q(workflow.activeVersionId)}; UPDATE workflow_history SET nodes=pg_read_file('${nodesPath}')::json, "updatedAt"=NOW() WHERE "workflowId"=${q(WORKFLOW_ID)} AND "versionId"=${q(workflow.activeVersionId)}; COMMIT;`);
  } finally {
    await remote(conn, `docker exec ${q(container)} rm -f ${q(nodesPath)}`).catch(() => {}); await remote(conn, `rm -f ${q(nodesPath)}`).catch(() => {});
    if (mainScaled) { await remote(conn, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(conn, 'n8n_n8n', 1); }
    if (runnerScaled) { await remote(conn, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(conn, 'n8n_n8n-runner', 1); }
  }
  const verifySql = `COPY (SELECT json_build_object('active',e.active,'versionAligned',e."versionId"=e."activeVersionId",'entityHistoryEqual',e.nodes::jsonb=h.nodes::jsonb,'focusMarker',e.nodes::text LIKE '%${FOCUS_MARKER}%','quoteMarker',e.nodes::text LIKE '%${QUOTE_MARKER}%')::text FROM workflow_entity e JOIN workflow_history h ON h."workflowId"=e.id AND h."versionId"=e."activeVersionId" WHERE e.id=${q(WORKFLOW_ID)}) TO STDOUT;`;
  const verified = JSON.parse((await psql(conn, container, verifySql)).trim());
  assert.deepEqual(verified, { active: true, versionAligned: true, entityHistoryEqual: true, focusMarker: true, quoteMarker: true });
  return { backupPath, verified };
}

async function validate(workflow) {
  const warrantyCode = workflow.nodes.find((node) => node.name === 'Vendas - Verificar Pos Lista').parameters.jsCode;
  const splitCode = workflow.nodes.find((node) => node.name === 'Dividir mensagens').parameters.jsCode;
  const textSend = workflow.nodes.find((node) => node.name === 'Enviar WhatsApp');
  const quoted = textSend.parameters.bodyParameters.parameters.find((field) => field.name === 'quoted');
  assert.match(quoted?.value || '', /replyToWaMessageId/);
  assert.match(quoted?.value || '', /replyToText/);

  const jid = '5599000000000@s.whatsapp.net';
  const source = {
    remoteJid: jid,
    messageId: 'INBOUND-WARRANTY-1',
    conversation: 'Tem garantia também né',
    saudacaoDetectada: false,
    recentMessages: [
      { direction: 'outbound', text: 'Eu recomendo o Redmi Note 14S 8GB/256GB. Se preferir, temos o Redmi Note 14 5G.', created_at: new Date().toISOString() },
      { direction: 'inbound', text: 'Gostei desse que você falou', created_at: new Date().toISOString() },
      { direction: 'outbound', text: 'O Redmi Note 14S 8GB/256GB que eu recomendei custa R$ 1.346,00. A versão 12GB/512GB custa R$ 1.639,00. O Redmi Note 14 5G custa R$ 1.438,00.', created_at: new Date().toISOString() },
      { direction: 'inbound', text: 'Gostei do valor também', created_at: new Date().toISOString() },
      { direction: 'outbound', text: 'Aceitamos cartão em até 12x.', created_at: new Date().toISOString() },
      { direction: 'inbound', text: 'Tem garantia também né', created_at: new Date().toISOString() },
    ],
  };
  const state = {
    flow: 'sales_post_list', step: 'awaiting_product_choice', expiresAt: Date.now() + 60_000,
    options: [
      { number: 6, name: 'Redmi Note 14S', colors: [{ productId: '14s-8', color: 'Roxo' }], memory: '8GB/256GB' },
      { number: 7, name: 'Redmi Note 14S', colors: [{ productId: '14s-12', color: 'Preto' }], memory: '12GB/512GB' },
      { number: 9, name: 'Redmi Note 14 5G', colors: [{ productId: '14-5g', color: 'Verde' }], memory: '6GB/128GB' },
    ],
  };
  const fetchMock = async (url) => ({
    ok: true,
    json: async () => String(url).includes('/products/14s-8') || String(url).includes('/products/14s-12')
      ? { name: 'Redmi Note 14S', brand: 'Xiaomi', category_id: 'smartphones', warranty_type: 'brand' }
      : String(url).includes('/brands?') ? [{ name: 'Xiaomi', warranty_days: 90 }]
        : String(url).includes('/products/14-5g') ? { name: 'Redmi Note 14 5G', brand: 'Xiaomi', category_id: 'smartphones', warranty_type: 'brand' }
          : [],
  });
  const staticData = { salesPostList: { [jid]: state } };
  const executeWarranty = async (input, data = staticData, lookup = fetchMock) => {
    const result = await new Function('$json', '$', '$getWorkflowStaticData', 'fetch', warrantyCode)(
      {}, (name) => ({ first: () => ({ json: name === 'Parse Classificacao' ? input : {} }) }),
      () => data, lookup,
    );
    return result[0].json;
  };
  const answer = await executeWarranty(source);
  assert.match(answer.output, /Redmi Note 14S tem 90 dias de garantia/);
  assert.equal(state.focusedModelName, 'Redmi Note 14S');
  assert.equal(answer.replyToWaMessageId, source.messageId);
  assert.equal(answer.replyToText, source.conversation);

  const explicit = await executeWarranty({ ...source, conversation: 'Qual a garantia do Redmi Note 14S?', recentMessages: [] },
    { salesPostList: { [jid]: structuredClone({ ...state, focusedModelName: '' }) } });
  assert.match(explicit.output, /Redmi Note 14S tem 90 dias de garantia/);
  const differentPolicies = await executeWarranty(source,
    { salesPostList: { [jid]: structuredClone({ ...state, focusedModelName: '' }) } },
    async (url) => ({ ok: true, json: async () => String(url).includes('/products/14s-12')
      ? { name: 'Redmi Note 14S', brand: 'Xiaomi', category_id: 'smartphones', warranty_type: 'custom' }
      : (await fetchMock(url)).json() }),
  );
  assert.match(differentPolicies.output, /versões do Redmi Note 14S.*condições de garantia diferentes/);
  const noContext = await executeWarranty({ ...source, recentMessages: [] }, { salesPostList: {} });
  assert.match(noContext.output, /me diga a marca e o modelo/);

  const split = new Function('$json', '$', splitCode)(
    answer,
    (name) => ({ first: () => ({ json: name === 'switc Mensagens' ? source : {} }) }),
  );
  assert.equal(split.length, 1);
  assert.equal(split[0].json.replyToWaMessageId, source.messageId);
  assert.equal(split[0].json.replyToText, source.conversation);
  assert.match(quoted.value, /^=\{\{.*\}\}$/);
  const evaluateQuoted = new Function('$json', `return (${quoted.value.slice(3, -2)});`);
  assert.deepEqual(evaluateQuoted(split[0].json), {
    key: { id: source.messageId, remoteJid: jid, fromMe: false },
    message: { conversation: source.conversation },
  });
  const unrelated = new Function('$json', '$', splitCode)(
    { output: 'Mensagem sem citação', remoteJid: jid },
    (name) => ({ first: () => ({ json: name === 'switc Mensagens' ? source : {} }) }),
  );
  assert.equal(unrelated[0].json.replyToWaMessageId, '');
  assert.equal(evaluateQuoted(unrelated[0].json), undefined);
  const multiple = new Function('$json', '$', splitCode)(
    { ...answer, output: 'Primeira resposta|||Segunda resposta' },
    (name) => ({ first: () => ({ json: name === 'switc Mensagens' ? source : {} }) }),
  );
  assert.equal(multiple.length, 2);
  assert.equal(multiple[0].json.replyToWaMessageId, source.messageId);
  assert.equal(multiple[1].json.replyToWaMessageId, '');
  return { warranty: answer.output, focus: state.focusedModelName, quoted: split[0].json.replyToWaMessageId, explicitModel: true, variantSafety: true, unquotedSafe: true, multiMessageSafe: true };
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => conn.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  try {
    const current = await readWorkflow(conn);
    assert.equal(current.versionId, current.activeVersionId, 'active workflow version mismatch');
    const patched = patchWorkflow(current);
    const result = await validate(patched);
    assert.deepEqual(patchWorkflow(patched).nodes, patched.nodes, 'patch must be idempotent');
    if (process.argv.includes('--apply')) {
      const alreadyActive = current.nodes.some((node) => String(node.parameters?.jsCode || '').includes(FOCUS_MARKER));
      const workflowResult = alreadyActive ? { alreadyActive: true } : await applyWorkflow(conn, patched);
      console.log(JSON.stringify({ applied: true, workflow: current.name, markers: [FOCUS_MARKER, QUOTE_MARKER], result, workflowResult }, null, 2));
    } else if (process.argv.includes('--validate-live')) {
      console.log(JSON.stringify({ live: { active: current.active, versionAligned: current.versionId === current.activeVersionId, focusMarker: current.nodes.some((node) => String(node.parameters?.jsCode || '').includes(FOCUS_MARKER)), quoteMarker: current.nodes.some((node) => String(node.parameters?.jsCode || '').includes(QUOTE_MARKER)) } }, null, 2));
    } else {
      console.log(JSON.stringify({ mode: 'local dry run; production unchanged', workflow: current.name, markers: [FOCUS_MARKER, QUOTE_MARKER], result }, null, 2));
    }
  } finally {
    conn.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
module.exports = { patchWarranty, patchSplitter, patchWorkflow, validate };

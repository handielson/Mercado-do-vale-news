const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('ssh2');

for (const envRoot of [path.resolve(__dirname, '..'), path.resolve(__dirname, '..', '..', '..')]) {
  try { require('dotenv').config({ path: path.join(envRoot, '.env.vps.local') }); } catch {}
  try { require('dotenv').config({ path: path.join(envRoot, '.env.local') }); } catch {}
}

const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const RESOLVER_NODE = 'Resolver Acao de Conversacao';
const PAYMENT_NODE = 'Pagamento - Politica';
const MARKER = 'payjoy-link-confirmation-v1';
const APPLY = process.argv.includes('--apply');
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const dollar = (value, tag) => `$${tag}$${String(value)}$${tag}$`;

function run(connection, command) {
  return new Promise((resolve, reject) => connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = '';
    let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `remote ${code}`)));
  }));
}

function psql(connection, database, sql) {
  return new Promise((resolve, reject) => connection.exec(
    `docker exec -i ${quote(database)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`,
    (error, stream) => {
      if (error) return reject(error);
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk; });
      stream.stderr.on('data', (chunk) => { stderr += chunk; });
      stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql ${code}`)));
      stream.end(sql);
    },
  ));
}

async function waitService(connection, service, expected) {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const replicas = (await run(connection, `docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (replicas === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

function replaceOnce(text, search, replacement, label) {
  const matches = String(text).split(search).length - 1;
  assert.equal(matches, 1, `${label} anchor must occur exactly once`);
  return String(text).replace(search, replacement);
}

function patchResolver(code) {
  let next = String(code || '');
  if (next.includes(`${MARKER}:resolver`)) return next;
  const previous = `const payjoyExplicitV1 = /\\b(?:payjoy|boleto|financiamento de celular)\\b/.test(payjoyCurrentV1);\nconst payjoyOutcomeV1 = /\\b(?:aprovad[oa]|reprovad[oa]|nao aprovou|deu negado|nao consegui|nao passei|fui negad[oa])\\b/.test(payjoyCurrentV1);\nconst payjoyHumanV1 = /\\b(?:atendente|humano|vendedor|pessoa da equipe)\\b/.test(payjoyCurrentV1);\nconst deterministicPayjoyV1 = !payjoyHumanV1 && (payjoyExplicitV1 || (payjoyContextV1 && payjoyOutcomeV1))\n  ? { acao: 'responder_politica_pagamento', intencao: 'payjoy', confianca: 1, motivo: 'Pergunta ou resultado da analise PayJoy.' }\n  : null;`;
  const replacement = `// ${MARKER}:resolver\nconst payjoyExplicitV1 = /\\b(?:payjoy|boletos?|financiamento de celular)\\b/.test(payjoyCurrentV1);\nconst payjoyOutcomeV1 = /\\b(?:aprovad[oa]|reprovad[oa]|nao aprovou|deu negado|nao consegui|nao passei|fui negad[oa])\\b/.test(payjoyCurrentV1);\nconst payjoyHumanV1 = /\\b(?:atendente|humano|vendedor|pessoa da equipe)\\b/.test(payjoyCurrentV1);\nconst payjoyShortAffirmativeV1 = /^(?:sim|quero|pode|pode sim|manda|envia|claro|ok|beleza|por favor)$/.test(payjoyCurrentV1);\nconst payjoyExplicitLinkReplyV1 = /\\b(?:quero|pode|manda|mande|envia|envie|receber)\\b.{0,35}\\blink\\b|\\blink\\b.{0,35}\\b(?:quero|manda|envia|receber)\\b/.test(payjoyCurrentV1);\nconst payjoyLinkConfirmationV1 = payjoyContextV1 && payjoyStateV1?.status === 'awaiting_link_confirmation'\n  && (payjoyShortAffirmativeV1 || payjoyExplicitLinkReplyV1);\nconst deterministicPayjoyV1 = !payjoyHumanV1 && (payjoyExplicitV1 || payjoyLinkConfirmationV1 || (payjoyContextV1 && payjoyOutcomeV1))\n  ? { acao: 'responder_politica_pagamento', intencao: 'payjoy', confianca: 1, motivo: payjoyLinkConfirmationV1 ? 'Cliente confirmou o envio do link PayJoy.' : 'Pergunta ou resultado da analise PayJoy.' }\n  : null;`;
  next = replaceOnce(next, previous, replacement, 'PayJoy resolver context');
  new Function('$json', '$', '$getWorkflowStaticData', next);
  return next;
}

function patchPayment(code) {
  let next = String(code || '');
  if (next.includes(`${MARKER}:payment`)) return next;
  next = replaceOnce(
    next,
    "const payjoyMention = /\\b(?:payjoy|boleto|financiamento(?: no boleto)?)\\b/.test(normalized);",
    `// ${MARKER}:payment\nconst payjoyMention = /\\b(?:payjoy|boletos?|financiamento(?: no boleto)?)\\b/.test(normalized);`,
    'PayJoy plural boleto recognition',
  );
  next = replaceOnce(
    next,
    "let payjoyNeedsHandoff = false;",
    `let payjoyNeedsHandoff = false;\nconst payjoyAffirmativeV1 = /^(?:sim|quero|pode|pode sim|manda|envia|claro|ok|beleza|por favor)$/.test(normalized);\nconst payjoyExplicitLinkReplyV1 = /\\b(?:quero|pode|manda|mande|envia|envie|receber)\\b.{0,35}\\blink\\b|\\blink\\b.{0,35}\\b(?:quero|manda|envia|receber)\\b/.test(normalized);\nconst payjoyPendingLinkV1 = contextual && active?.status === 'awaiting_link_confirmation'\n  && (payjoyAffirmativeV1 || payjoyExplicitLinkReplyV1);\nconst payjoyGenericBoletoQuestionV1 = payjoyMention\n  && /(?:\\b(?:trabalha(?:m)?|aceita(?:m)?|tem|possui|faz|fazem)\\b.{0,50}\\bboletos?\\b|\\bboletos?\\b.{0,50}\\b(?:trabalha(?:m)?|aceita(?:m)?|tem|possui|faz|fazem)\\b)/.test(normalized)\n  && !payjoyExplicitLinkReplyV1;`,
    'PayJoy confirmation state',
  );
  next = replaceOnce(
    next,
    "} else if ((contextual || payjoyMention) && denied) {",
    `} else if (payjoyPendingLinkV1) {\n  if (officialLink) {\n    remember('awaiting_result');\n    output = 'Claro! 😊 Faça sua análise da PayJoy pelo link abaixo: 👇||' + officialLink + '|||Quando sair o resultado, me avise por aqui para continuarmos sua compra no Mercado do Vale. 📱||Se a página mostrar outra loja, fale comigo antes de prosseguir.';\n    payjoyFollowupKind = 'analysis_check';\n  } else {\n    output = 'Vou confirmar o link oficial da PayJoy com nossa equipe e enviar para você por aqui. 😊';\n    payjoyNeedsHandoff = true;\n  }\n} else if (payjoyGenericBoletoQuestionV1) {\n  remember('awaiting_link_confirmation');\n  output = 'Sim! Temos financiamento de celulares pela PayJoy, com parcelas pagas por boleto ou Pix. 😊|||A aprovação e as condições dependem da análise de crédito da PayJoy. Quer que eu envie o link para você fazer a análise?';\n} else if ((contextual || payjoyMention) && denied) {`,
    'PayJoy pending-link branch',
  );
  next = replaceOnce(
    next,
    "    output = 'Para começar, a PayJoy informa que você precisa de um documento oficial com foto e um número de celular ativo. A aprovação depende da análise de crédito. Se quiser, posso enviar o link para iniciar a análise. 😊';",
    "    remember('awaiting_link_confirmation');\n    output = 'Para começar, a PayJoy informa que você precisa de um documento oficial com foto e um número de celular ativo. A aprovação depende da análise de crédito. Se quiser, posso enviar o link para iniciar a análise. 😊';",
    'PayJoy document offer memory',
  );
  next = replaceOnce(
    next,
    "/\\b(?:aprovacao|aprovar|analise|link|boleto|financiamento|parcelar|comprar)\\b/",
    "/\\b(?:aprovacao|aprovar|analise|link|boletos?|financiamento|parcelar|comprar)\\b/",
    'PayJoy plural link branch',
  );
  next = replaceOnce(
    next,
    "} else {\n  output = 'Recebemos por Pix, transferência bancária, dinheiro, cartão de débito e cartão de crédito. 💳||Para financiar um celular com parcelas em boleto ou Pix, temos a PayJoy, sujeita à análise de crédito. Quer que eu envie o link?';\n}",
    "} else {\n  remember('awaiting_link_confirmation');\n  output = 'Recebemos por Pix, transferência bancária, dinheiro, cartão de débito e cartão de crédito. 💳|||Para financiar um celular com parcelas em boleto ou Pix, temos a PayJoy, sujeita à análise de crédito. Quer que eu envie o link?';\n}",
    'generic payment offer memory',
  );
  new Function('$json', '$', '$getWorkflowStaticData', next);
  return next;
}

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const resolver = workflow.nodes.find((item) => item.name === RESOLVER_NODE);
  const payment = workflow.nodes.find((item) => item.name === PAYMENT_NODE);
  assert.ok(resolver?.parameters?.jsCode, `${RESOLVER_NODE} not found`);
  assert.ok(payment?.parameters?.jsCode, `${PAYMENT_NODE} not found`);
  resolver.parameters.jsCode = patchResolver(resolver.parameters.jsCode);
  payment.parameters.jsCode = patchPayment(payment.parameters.jsCode);
  return workflow;
}

function executeResolver(code, staticData, conversation, parsedAction = 'listar_catalogo') {
  const remoteJid = '558791183196@s.whatsapp.net';
  const source = { remoteJid, conversation, recentMessages: [{ direction: 'outbound', text: 'Quer que eu envie o link?' }] };
  const classifier = {
    remoteJid,
    conversation,
    output: JSON.stringify({ acao: parsedAction, intencao: parsedAction === 'listar_catalogo' ? 'catalogo' : 'escolha_item', produto_busca: 'smartphones' }),
    intencao: 'vendas_produtos',
    salesRequestKind: parsedAction === 'listar_catalogo' ? 'categoria' : '',
  };
  return new Function('$json', '$', '$getWorkflowStaticData', code)(
    classifier,
    () => ({ first: () => ({ json: source }) }),
    () => staticData,
  )[0].json;
}

function executePayment(code, staticData, resolverOutput) {
  const config = { payjoy_analysis_url: 'https://app.payjoy.com/br/d2c?fixture=1' };
  return new Function('$json', '$', '$getWorkflowStaticData', code)(
    config,
    () => ({ first: () => ({ json: resolverOutput }) }),
    () => staticData,
  )[0].json;
}

function validate(workflow) {
  const resolverCode = String(workflow.nodes.find((item) => item.name === RESOLVER_NODE)?.parameters?.jsCode || '');
  const paymentCode = String(workflow.nodes.find((item) => item.name === PAYMENT_NODE)?.parameters?.jsCode || '');
  const remoteJid = '558791183196@s.whatsapp.net';
  const staticData = { salesPostList: { [remoteJid]: { flow: 'sales_post_list', step: 'awaiting_product_choice', expiresAt: Date.now() + 60_000 } }, payjoyByJid: {} };

  const boletoRoute = executeResolver(resolverCode, staticData, 'Vcs trabalham com boletos');
  assert.equal(boletoRoute.conversationAction, 'responder_politica_pagamento');
  const offer = executePayment(paymentCode, staticData, boletoRoute);
  assert.match(offer.output, /parcelas pagas por boleto ou Pix/i);
  assert.match(offer.output, /Quer que eu envie o link/i);
  assert.doesNotMatch(offer.output, /fixture=1/);
  assert.equal(staticData.payjoyByJid[remoteJid].status, 'awaiting_link_confirmation');

  const yesRoute = executeResolver(resolverCode, staticData, 'Sim');
  assert.equal(yesRoute.conversationAction, 'responder_politica_pagamento');
  const linkReply = executePayment(paymentCode, staticData, yesRoute);
  assert.match(linkReply.output, /https:\/\/app\.payjoy\.com\/br\/d2c\?fixture=1/);
  assert.equal(staticData.payjoyByJid[remoteJid].status, 'awaiting_result');

  staticData.payjoyByJid[remoteJid] = { status: 'awaiting_link_confirmation', updatedAt: Date.now() };
  const explicitRoute = executeResolver(resolverCode, staticData, 'Quero receber o link');
  assert.equal(explicitRoute.conversationAction, 'responder_politica_pagamento');
  const explicitReply = executePayment(paymentCode, staticData, explicitRoute);
  assert.match(explicitReply.output, /fixture=1/);

  const unrelatedStatic = { salesPostList: staticData.salesPostList, payjoyByJid: {} };
  const unrelatedYes = executeResolver(resolverCode, unrelatedStatic, 'Sim', 'selecionar_item_lista');
  assert.notEqual(unrelatedYes.conversationIntent, 'payjoy');
  return { pluralBoletoRecognized: true, confirmationRemembered: true, shortYesSendsOfficialLink: true, explicitLinkRequestSendsOfficialLink: true, unrelatedYesPreserved: true };
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.once('ready', resolve).once('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const database = (await run(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(database, 'n8n database not found');
    const raw = await psql(connection, database, `COPY (SELECT json_build_object('nodesHex',encode(convert_to(we.nodes::text,'UTF8'),'hex'),'connectionsHex',encode(convert_to(we.connections::text,'UTF8'),'hex'),'activeVersionId',we.\"activeVersionId\",'active',we.active,'versionAligned',we.\"versionId\"=we.\"activeVersionId\",'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb)::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const row = JSON.parse(raw.trim());
    const workflow = { nodes: JSON.parse(Buffer.from(row.nodesHex, 'hex').toString('utf8')), connections: JSON.parse(Buffer.from(row.connectionsHex, 'hex').toString('utf8')) };
    const updated = patchWorkflow(workflow);
    const validation = validate(updated);
    assert.deepEqual(patchWorkflow(updated).nodes, updated.nodes, 'patch must be idempotent');
    const changed = JSON.stringify(updated.nodes) !== JSON.stringify(workflow.nodes);
    const summary = { apply: APPLY, active: row.active, versionAligned: row.versionAligned, entityHistoryEqual: row.entityHistoryEqual, changed, validation };
    if (!APPLY) return console.log(JSON.stringify(summary, null, 2));

    assert.equal(row.active, true);
    assert.equal(row.versionAligned, true);
    assert.equal(row.entityHistoryEqual, true);
    assert.equal(changed, true, 'workflow already preserves PayJoy link confirmation context');
    const active = Number((await psql(connection, database, `COPY (SELECT count(*) FROM execution_entity WHERE \"workflowId\"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(active, 0, 'workflow has active executions');
    const backupPath = path.join(os.tmpdir(), `n8n-${WORKFLOW_ID}-before-${MARKER}-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ workflowId: WORKFLOW_ID, activeVersionId: row.activeVersionId, ...workflow }, null, 2), { flag: 'wx' });

    await run(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 0);
    await run(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    stopped = true;
    const sql = `BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(updated.nodes), 'nodespayjoylink')}::json,\"versionId\"=\"activeVersionId\",\"updatedAt\"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(updated.nodes), 'historypayjoylink')}::json,\"updatedAt\"=NOW() WHERE \"workflowId\"=${quote(WORKFLOW_ID)} AND \"versionId\"=${quote(row.activeVersionId)};
COMMIT;
COPY (SELECT json_build_object('entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb,'payjoyLinkConfirmation',EXISTS(SELECT 1 FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->>'name'=${quote(PAYMENT_NODE)} AND node->'parameters'->>'jsCode' LIKE '%${MARKER}%') AND EXISTS(SELECT 1 FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->>'name'=${quote(RESOLVER_NODE)} AND node->'parameters'->>'jsCode' LIKE '%${MARKER}%'))::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, database, sql)).trim());
    await run(connection, 'docker service scale n8n_n8n=1 >/dev/null');
    await waitService(connection, 'n8n_n8n', 1);
    await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null');
    await waitService(connection, 'n8n_n8n-runner', 1);
    stopped = false;
    console.log(JSON.stringify({ ...summary, ...verification, backupPath }, null, 2));
  } finally {
    if (stopped) {
      await run(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await run(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {});
      await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { MARKER, patchResolver, patchPayment, patchWorkflow, validate };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });

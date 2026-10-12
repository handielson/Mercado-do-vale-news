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
const INSTALLMENT_OPTIONS = process.argv.includes('--installment-options');
const APPROVAL = process.argv.includes('--approval');
const MARKER = INSTALLMENT_OPTIONS ? 'installment-options-payjoy-v1' : 'payjoy-link-confirmation-v1';
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
  if (next.includes(`${MARKER}:resolver`)) return patchPayJoyContinuation(patchAnalysisConfirmation(next), 'resolver');
  const previous = `const payjoyExplicitV1 = /\\b(?:payjoy|boleto|financiamento de celular)\\b/.test(payjoyCurrentV1);\nconst payjoyOutcomeV1 = /\\b(?:aprovad[oa]|reprovad[oa]|nao aprovou|deu negado|nao consegui|nao passei|fui negad[oa])\\b/.test(payjoyCurrentV1);\nconst payjoyHumanV1 = /\\b(?:atendente|humano|vendedor|pessoa da equipe)\\b/.test(payjoyCurrentV1);\nconst deterministicPayjoyV1 = !payjoyHumanV1 && (payjoyExplicitV1 || (payjoyContextV1 && payjoyOutcomeV1))\n  ? { acao: 'responder_politica_pagamento', intencao: 'payjoy', confianca: 1, motivo: 'Pergunta ou resultado da analise PayJoy.' }\n  : null;`;
  const replacement = `// ${MARKER}:resolver\nconst payjoyExplicitV1 = /\\b(?:payjoy|boletos?|financiamento de celular)\\b/.test(payjoyCurrentV1);\nconst payjoyOutcomeV1 = /\\b(?:aprovad[oa]|reprovad[oa]|nao aprovou|deu negado|nao consegui|nao passei|fui negad[oa])\\b/.test(payjoyCurrentV1);\nconst payjoyHumanV1 = /\\b(?:atendente|humano|vendedor|pessoa da equipe)\\b/.test(payjoyCurrentV1);\nconst payjoyShortAffirmativeV1 = /^(?:sim|quero|pode|pode sim|manda|envia|claro|ok|beleza|por favor)$/.test(payjoyCurrentV1);\nconst payjoyExplicitLinkReplyV1 = /\\b(?:quero|pode|manda|mande|envia|envie|receber)\\b.{0,35}\\blink\\b|\\blink\\b.{0,35}\\b(?:quero|manda|envia|receber)\\b/.test(payjoyCurrentV1);\nconst payjoyLinkConfirmationV1 = payjoyContextV1 && payjoyStateV1?.status === 'awaiting_link_confirmation'\n  && (payjoyShortAffirmativeV1 || payjoyExplicitLinkReplyV1);\nconst deterministicPayjoyV1 = !payjoyHumanV1 && (payjoyExplicitV1 || payjoyLinkConfirmationV1 || (payjoyContextV1 && payjoyOutcomeV1))\n  ? { acao: 'responder_politica_pagamento', intencao: 'payjoy', confianca: 1, motivo: payjoyLinkConfirmationV1 ? 'Cliente confirmou o envio do link PayJoy.' : 'Pergunta ou resultado da analise PayJoy.' }\n  : null;`;
  next = replaceOnce(next, previous, replacement, 'PayJoy resolver context');
  new Function('$json', '$', '$getWorkflowStaticData', next);
  return patchPayJoyContinuation(patchAnalysisConfirmation(next), 'resolver');
}

function patchPayment(code) {
  let next = String(code || '');
  if (next.includes(`${MARKER}:payment`)) return patchPayJoyContinuation(patchAnalysisConfirmation(next), 'payment');
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
  return patchPayJoyContinuation(patchAnalysisConfirmation(next), 'payment');
}

function patchAnalysisConfirmation(code) {
  const marker = 'payjoy-analysis-confirmation-v2';
  if (code.includes(marker)) return code;
  // Amplia a confirmação existente; a condição de contexto continua obrigatória.
  const previous = '/^(?:sim|quero|pode|pode sim|manda|envia|claro|ok|beleza|por favor)$/';
  const replacement = '/^(?:sim|quero|pode|pode sim|manda|envia|claro|ok|beleza|por favor|(?:fazer|quero(?: fazer)?|vou fazer|pode fazer|vamos fazer|iniciar|quero iniciar) (?:[ao] |uma |essa )?analise(?: de credito)?)[.!?]*$/';
  return replaceOnce(code, previous, replacement, marker) + `\n// ${marker}\n`;
}

function patchWorkflow(input) {
  const workflow = structuredClone(input);
  const resolver = workflow.nodes.find((item) => item.name === RESOLVER_NODE);
  const payment = workflow.nodes.find((item) => item.name === PAYMENT_NODE);
  assert.ok(resolver?.parameters?.jsCode, `${RESOLVER_NODE} not found`);
  assert.ok(payment?.parameters?.jsCode, `${PAYMENT_NODE} not found`);
  resolver.parameters.jsCode = patchResolver(resolver.parameters.jsCode);
  payment.parameters.jsCode = patchPayment(payment.parameters.jsCode);
  for (const name of ['Controle Bot - Aplicar Controle', 'Estado Conversa - Preparar']) {
    const stateNode = workflow.nodes.find(item => item.name === name);
    if (stateNode?.parameters.jsCode.includes('payjoy-direct-analysis-v3:persist')) {
      stateNode.parameters.jsCode = replaceOnce(stateNode.parameters.jsCode,
        "// payjoy-direct-analysis-v3:persist\nfor (const key of ['salesPostList', 'pendingDeviceClarification', 'payjoyByJid'])",
        "for (const key of ['salesPostList', 'pendingDeviceClarification'])", name);
      if (name === 'Controle Bot - Aplicar Controle') {
        stateNode.parameters.jsCode = replaceOnce(stateNode.parameters.jsCode,
          '  delete staticData.salesPostList[remoteJid];\n  if (staticData.payjoyByJid) delete staticData.payjoyByJid[remoteJid];',
          '  delete staticData.salesPostList[remoteJid];', 'Restore existing reset');
      }
      new Function('$json', '$', '$getWorkflowStaticData', stateNode.parameters.jsCode);
    }
  }
  const general = workflow.nodes.find(item => item.name === 'Agente Geral - Atendimento');
  if (general) {
    const guard = 'payjoy-direct-analysis-v3:agent';
    if (!general.parameters.options.systemMessage.includes(guard)) {
      general.parameters.options.systemMessage += `\n\nPAYJOY: ANALISE DIRETAMENTE COM A FINANCEIRA (${guard}):\n- A analise de credito da PayJoy e realizada pelo proprio cliente diretamente no link oficial configurado pelo fluxo. O Mercado do Vale nao realiza nem envia essa analise pelo WhatsApp.\n- Nunca solicite nome completo, CPF, documento, foto de documento, data de nascimento ou outros dados para iniciar ou fazer analise PayJoy. Nunca prometa iniciar, encaminhar, aprovar ou consultar uma proposta em nome do cliente.\n- Oriente o cliente a preencher os dados diretamente com a PayJoy e retornar com o resultado para continuarmos a compra. Nao trate dados enviados espontaneamente como inicio de uma analise.\n- Use somente o link oficial fornecido pelo fluxo. Nao invente URL; se ela nao estiver disponivel no contexto, encaminhe para a equipe confirmar.\n- Essa regra e especifica da analise PayJoy; nao altera o cadastro normal de uma venda confirmada.`;
    }
  }
  return workflow;
}

function patchPayJoyContinuation(code, kind) {
  const marker = 'payjoy-direct-analysis-v3';
  if (code.includes(`${marker}:${kind}`)) return code;
  const current = kind === 'resolver' ? 'payjoyCurrentV1' : 'normalized';
  const state = kind === 'resolver' ? 'payjoyStateV1' : 'active';
  const context = kind === 'resolver' ? 'payjoyContextV1' : 'contextual';
  const anchor = kind === 'resolver' ? 'const payjoyLinkConfirmationV1' : 'const payjoyPendingLinkV1';
  const continuation = String.raw`// MARKER:KIND
const payjoyAnalysisQuestionV3 = /\b(?:tem como|posso|como|quero|pode|vamos|fazer|iniciar|comecar)\b.{0,50}\b(?:analise|analisar|aprovacao)\b|^(?:como (?:faz|faco|fazer)(?: pra| para)? (?:saber|conseguir)|como funciona|como faz|o que (?:preciso|devo) fazer)[?!.\s]*$/.test(CURRENT);
const payjoyDeclineV3 = /\bnao\s+(?:quero|vou|desejo|preciso|pretendo)\b.{0,40}\b(?:analise|analisar|link|fazer|continuar)|^(?:nao|nao quero|deixa|deixa pra la|agora nao)[?!.\s]*$/.test(CURRENT);
const payjoyAnalysisContinuationV3 = CONTEXT && ['awaiting_link_confirmation', 'awaiting_result'].includes(STATE?.status)
  && (payjoyAnalysisQuestionV3 || payjoyExplicitLinkReplyV1) && !payjoyDeclineV3;
` .replaceAll('MARKER', marker).replaceAll('KIND', kind).replaceAll('CURRENT', current).replaceAll('CONTEXT', context).replaceAll('STATE', state);
  code = replaceOnce(code, anchor, continuation + anchor, `${marker}:${kind}`);
  const condition = kind === 'resolver'
    ? "const payjoyLinkConfirmationV1 = payjoyContextV1 && payjoyStateV1?.status === 'awaiting_link_confirmation'\n  && (payjoyShortAffirmativeV1 || payjoyExplicitLinkReplyV1);"
    : "const payjoyPendingLinkV1 = contextual && active?.status === 'awaiting_link_confirmation'\n  && (payjoyAffirmativeV1 || payjoyExplicitLinkReplyV1);";
  code = replaceOnce(code, condition, condition.slice(0, -1) + ' && !payjoyDeclineV3 || payjoyAnalysisContinuationV3;', `${marker} continuation condition`);
  if (kind === 'resolver') {
    code = replaceOnce(code, 'const deterministicPayjoyV1 = !payjoyHumanV1 && (payjoyExplicitV1 ||',
      'const deterministicPayjoyV1 = !payjoyHumanV1 && ((payjoyExplicitV1 && !payjoyDeclineV3) || (payjoyContextV1 && payjoyDeclineV3) ||', `${marker} refusal routing`);
  }
  if (kind === 'payment') {
    code = replaceOnce(code, "{ status, updatedAt: Date.now() }", "{ status, updatedAt: Date.now(), expiresAt: Date.now() + 30 * 86400000 }", `${marker} expiry`);
    code = replaceOnce(code, '} else if (payjoyPendingLinkV1) {', "} else if (payjoyDeclineV3 && (contextual || payjoyMention)) {\n  remember('declined');\n  output = 'Tudo bem! Não seguimos com a análise PayJoy. Se quiser, continuamos com as outras formas de pagamento da loja. 😊';\n} else if (payjoyPendingLinkV1 && !approved && !denied) {", `${marker} refusal`);
    const priceReply = "    output = 'A entrada, as parcelas e o custo total aparecem na proposta da PayJoy após a análise. Eles variam conforme o aparelho e as condições aprovadas para você. Não consigo definir esses valores antes da proposta. 😊';";
    code = replaceOnce(code, priceReply, "    remember('awaiting_link_confirmation');\n" + priceReply + "\n    output += '|||Quer que eu envie o link oficial da PayJoy para você fazer a análise diretamente com eles?';", `${marker} price context`);
    code = code.replaceAll("Faça sua análise da PayJoy pelo link abaixo: 👇", "Você faz a análise diretamente com a PayJoy e preenche seus dados no site deles, pelo link abaixo: 👇")
      .replaceAll("Faça sua análise pelo link abaixo: 👇", "Você faz a análise diretamente com a PayJoy e preenche seus dados no site deles, pelo link abaixo: 👇");
  }
  new Function('$json', '$', '$getWorkflowStaticData', code);
  return code;
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
  for (const phrase of ['Fazer o análise', 'Fazer a análise', 'Quero fazer a análise', 'Quero análise', 'Vamos fazer a análise de crédito', 'Pode fazer a análise!']) {
    const pending = { payjoyByJid: { [remoteJid]: { status: 'awaiting_link_confirmation', updatedAt: Date.now() } } };
    const route = executeResolver(resolverCode, pending, phrase, 'perguntar_esclarecimento');
    assert.equal(route.conversationAction, 'responder_politica_pagamento', phrase);
    const reply = executePayment(paymentCode, pending, route);
    assert.match(reply.output, /https:\/\/app\.payjoy\.com/, phrase);
    assert.equal(reply.payjoyFollowupKind, 'analysis_check');
    assert.equal(pending.payjoyByJid[remoteJid].status, 'awaiting_result');
  }
  for (const phrase of ['Quero falar com atendente', 'Quanto custa a análise?']) {
    const pending = { payjoyByJid: { [remoteJid]: { status: 'awaiting_link_confirmation', updatedAt: Date.now() } } };
    assert.notEqual(executeResolver(resolverCode, pending, phrase, 'perguntar_esclarecimento').conversationIntent, 'payjoy', phrase);
  }
  assert.notEqual(executeResolver(resolverCode, { payjoyByJid: {} }, 'Fazer a análise', 'perguntar_esclarecimento').conversationIntent, 'payjoy');
  if (paymentCode.includes('payjoy-direct-analysis-v3:payment')) {
  for (const phrase of ['Como faz pra saber', 'Tem como fazer o análise', 'Sim', 'Pode']) {
    const state = { payjoyByJid: {} };
    const first = executeResolver(resolverCode, state, 'Parcela no boleto', 'perguntar_esclarecimento');
    executePayment(paymentCode, state, first);
    assert.equal(state.payjoyByJid[remoteJid].status, 'awaiting_link_confirmation');
    const route = executeResolver(resolverCode, state, phrase, 'perguntar_esclarecimento');
    assert.equal(route.conversationIntent, 'payjoy', phrase);
    const reply = executePayment(paymentCode, state, route);
    assert.match(reply.output, /fixture=1/, phrase);
    assert.match(reply.output, /diretamente com a PayJoy/);
    assert.doesNotMatch(reply.output, /envie.*CPF|me informe.*CPF|iniciar.*por voce/i);
    assert.equal(state.payjoyByJid[remoteJid].status, 'awaiting_result');
    assert.ok(state.payjoyByJid[remoteJid].expiresAt > Date.now());
  }
  const approvedState = { payjoyByJid: { [remoteJid]: { status: 'awaiting_result', updatedAt: Date.now() } } };
  const approval = executePayment(paymentCode, approvedState, executeResolver(resolverCode, approvedState, 'Fui aprovada', 'perguntar_esclarecimento'));
  assert.equal(approvedState.payjoyByJid[remoteJid].status, 'approved');
  assert.doesNotMatch(approval.output, /fixture=1/);
  const refusalState = { payjoyByJid: { [remoteJid]: { status: 'awaiting_link_confirmation', updatedAt: Date.now() } } };
  const refusal = executePayment(paymentCode, refusalState, { remoteJid, conversation: 'Não quero o link da PayJoy' });
  assert.equal(refusalState.payjoyByJid[remoteJid].status, 'declined');
  assert.doesNotMatch(refusal.output, /fixture=1/);
  const declinedRoute = executeResolver(resolverCode, refusalState, 'Sim', 'perguntar_esclarecimento');
  assert.notEqual(declinedRoute.conversationIntent, 'payjoy');
  }
  return { pluralBoletoRecognized: true, confirmationRemembered: true, shortYesSendsOfficialLink: true, explicitLinkRequestSendsOfficialLink: true, unrelatedYesPreserved: true, analysisConfirmationSendsLink: true, negativesAndUnrelatedContextPreserved: true };
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
    const transform = APPROVAL ? require('./n8n-payjoy-approval-patch.cjs').patchWorkflow : INSTALLMENT_OPTIONS ? require('./n8n-payjoy-workflow-patch.cjs').updateInstallmentOptionsWorkflow : patchWorkflow;
    const updated = transform(workflow);
    if (APPROVAL) require('./n8n-payjoy-approval-patch.cjs').validate(updated);
    else assert.deepEqual(updated.connections, workflow.connections, 'connections must remain unchanged');
    const changedNodes = updated.nodes.filter(node => JSON.stringify(node) !== JSON.stringify(workflow.nodes.find(n=>n.name===node.name))).map(node => node.name);
    assert.ok(changedNodes.every(name => (APPROVAL ? [PAYMENT_NODE,RESOLVER_NODE,'Agente Geral - Atendimento','Dados','PayJoy - Recebeu print?','PayJoy - Print tem arquivo?','PayJoy - Recuperar midia','PayJoy - Restaurar imagem','PayJoy - Preparar imagem','PayJoy - Ler aprovacao','PayJoy - Calcular entrada do print'] : INSTALLMENT_OPTIONS ? [PAYMENT_NODE] : [RESOLVER_NODE, PAYMENT_NODE, 'Agente Geral - Atendimento', 'Controle Bot - Aplicar Controle', 'Estado Conversa - Preparar']).includes(name)), 'only scoped payment nodes may change');
    if (APPROVAL) {
      const retained=Object.fromEntries(Object.entries(updated.connections).filter(([name])=>Object.hasOwn(workflow.connections,name)&&name!=='Controle Bot - Bloqueado?'));
      assert.deepEqual(retained,Object.fromEntries(Object.entries(workflow.connections).filter(([name])=>name!=='Controle Bot - Bloqueado?')));
      assert.deepEqual(updated.connections['Controle Bot - Bloqueado?'].main[0],workflow.connections['Controle Bot - Bloqueado?'].main[0]);
    }
    const validation = validate(updated);
    if (INSTALLMENT_OPTIONS) {
      const state = {};
      const route = executeResolver(updated.nodes.find(n => n.name === RESOLVER_NODE).parameters.jsCode, state, 'Quais são as opções de parcelamento?', 'responder_politica_pagamento');
      const reply = executePayment(updated.nodes.find(n => n.name === PAYMENT_NODE).parameters.jsCode, state, route);
      assert.match(reply.output, /Via Boleto:.*PayJoy.*boleto ou Pix/);
      assert.match(reply.output, /até 12x/);
      assert.doesNotMatch(reply.output, /https:/);
      assert.equal(reply.payjoyFollowupKind, '');
      assert.equal(state.payjoyByJid[route.remoteJid].status, 'awaiting_link_confirmation');
      validation.installmentOptions = true;
    }
    assert.deepEqual(transform(updated).nodes, updated.nodes, 'patch must be idempotent');
    const changed = JSON.stringify(updated.nodes) !== JSON.stringify(workflow.nodes);
    const summary = { apply: APPLY, active: row.active, versionAligned: row.versionAligned, entityHistoryEqual: row.entityHistoryEqual, changed, changedNodes, validation };
    if (!APPLY) return console.log(JSON.stringify(summary, null, 2));

    assert.equal(row.active, true);
    assert.equal(row.versionAligned, true);
    assert.equal(row.entityHistoryEqual, true);
    if (!changed) return console.log(JSON.stringify({ ...summary, alreadyApplied: true }, null, 2));
    const active = Number((await psql(connection, database, `COPY (SELECT count(*) FROM execution_entity WHERE \"workflowId\"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(active, 0, 'workflow has active executions');
    const backupPath = path.join(os.tmpdir(), `n8n-${WORKFLOW_ID}-before-${MARKER}-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ workflowId: WORKFLOW_ID, activeVersionId: row.activeVersionId, ...workflow }, null, 2), { flag: 'wx' });

    await run(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null');
    stopped = true;
    await waitService(connection, 'n8n_n8n-runner', 0);
    await run(connection, 'docker service scale n8n_n8n=0 >/dev/null');
    await waitService(connection, 'n8n_n8n', 0);
    stopped = true;
    const unchanged = await psql(connection, database, `SELECT encode(convert_to(nodes::text,'UTF8'),'hex') FROM workflow_entity WHERE id=${quote(WORKFLOW_ID)};`);
    assert.equal(unchanged.trim(), row.nodesHex, 'workflow changed since preflight; do not overwrite concurrent edits');
    const unchangedGraph = await psql(connection, database, `SELECT COUNT(*) FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)} AND we."activeVersionId"=${quote(row.activeVersionId)} AND we."versionId"=we."activeVersionId" AND encode(convert_to(we.connections::text,'UTF8'),'hex')=${quote(row.connectionsHex)} AND we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb;`);
    assert.equal(unchangedGraph.trim(), '1', 'workflow version, graph or active history changed since preflight');
    const sql = `BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(updated.nodes), 'nodespayjoylink')}::json,connections=${dollar(JSON.stringify(updated.connections),'graphpayjoylink')}::json,\"versionId\"=\"activeVersionId\",\"updatedAt\"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(updated.nodes), 'historypayjoylink')}::json,connections=${dollar(JSON.stringify(updated.connections),'graphhistorypayjoylink')}::json,\"updatedAt\"=NOW() WHERE \"workflowId\"=${quote(WORKFLOW_ID)} AND \"versionId\"=${quote(row.activeVersionId)};
COMMIT;
COPY (SELECT json_build_object('entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb,'payjoyLinkConfirmation',EXISTS(SELECT 1 FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->>'name'=${quote(PAYMENT_NODE)} AND node->'parameters'->>'jsCode' LIKE '%${MARKER}%') AND EXISTS(SELECT 1 FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->>'name'=${quote(RESOLVER_NODE)} AND node->'parameters'->>'jsCode' LIKE '%${INSTALLMENT_OPTIONS ? 'payjoy-link-confirmation-v1' : MARKER}%'))::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification = JSON.parse((await psql(connection, database, sql)).trim());
    assert.equal(verification.entityHistoryEqual, true);
    assert.equal(verification.payjoyLinkConfirmation, true);
    if (!INSTALLMENT_OPTIONS) {
      const continuation = JSON.parse((await psql(connection, database, `SELECT json_build_object('entityNodes',(SELECT count(*) FROM jsonb_array_elements(we.nodes::jsonb) node WHERE node->'parameters'::text IS NOT NULL AND (node->'parameters')::text LIKE '%payjoy-direct-analysis-v3%'),'historyNodes',(SELECT count(*) FROM jsonb_array_elements(wh.nodes::jsonb) node WHERE (node->'parameters')::text LIKE '%payjoy-direct-analysis-v3%'),'connectionsPreserved',encode(convert_to(we.connections::text,'UTF8'),'hex')=${quote(row.connectionsHex)} AND we.connections::jsonb=wh.connections::jsonb) FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)};`)).trim());
      assert.equal(continuation.entityNodes, 3);
      assert.equal(continuation.historyNodes, 3);
      if (!APPROVAL) assert.equal(continuation.connectionsPreserved, true);
      verification.directAnalysisContinuation = continuation;
    }
    if (APPROVAL) {
      const activeWorkflow = JSON.parse((await psql(connection,database,`SELECT json_build_object('nodes',we.nodes,'connections',we.connections,'historyAligned',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb) FROM workflow_entity we JOIN workflow_history wh ON wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)};`)).trim());
      assert.deepEqual(activeWorkflow.nodes,updated.nodes);
      assert.deepEqual(activeWorkflow.connections,updated.connections);
      assert.equal(activeWorkflow.historyAligned,true);
      require('./n8n-payjoy-approval-patch.cjs').validate(activeWorkflow);
      verification.approvalPrintVerified=true;
    }
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

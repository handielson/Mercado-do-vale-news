const fs = require('node:fs');

const paymentCode = String.raw`const source = $('Resolver Acao de Conversacao').first().json || {};
const config = $json || {};
const text = String(source.conversation || source.mensagem || '').trim();
const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const remoteJid = String(source.remoteJid || '').trim();
const staticData = $getWorkflowStaticData('global');
staticData.payjoyByJid = staticData.payjoyByJid || {};
const active = staticData.payjoyByJid[remoteJid];
const contextual = active && Date.now() - Number(active.updatedAt || 0) < 30 * 86400000;
const payjoyMention = /\b(?:payjoy|boleto|financiamento(?: no boleto)?)\b/.test(normalized);
const approved = /\b(?:fui|foi|deu|esta|estou|to|apareceu|saiu|fiquei)\s+aprovad[oa]\b|\b(?:me aprovaram|aprovou|aprovado|aprovada|consegui aprovacao)\b/.test(normalized) && !/\b(?:nao|nem|sem)\s+(?:fui\s+)?aprovad/.test(normalized);
const denied = /\b(?:nao fui aprovad[oa]|nao foi aprovad[oa]|nao aprovou|fui reprovad[oa]|deu negado|nao consegui(?: aprovacao)?|nao passou na analise|nao passei|fui negad[oa])\b/.test(normalized);
const link = String(config.payjoy_analysis_url || '').trim();
const officialLink = /^https:\/\/(?:[a-z0-9-]+\.)*payjoy\.com(?:\/|\?|$)/i.test(link) ? link : '';
const remember = (status) => { if (remoteJid) staticData.payjoyByJid[remoteJid] = { status, updatedAt: Date.now() }; };
let output = '';
let payjoyFollowupKind = '';
let payjoyNeedsHandoff = false;

if ((contextual || payjoyMention) && denied) {
  remember('denied');
  output = 'Poxa, sentimos muito pelo resultado. 💚 A análise é feita pela PayJoy, mas não desanime! Você pode verificar se é possível tentar uma nova análise em cerca de 15 dias. Vamos torcer para dar certo na próxima vez. 😊';
  payjoyFollowupKind = 'retry_check';
} else if ((contextual || payjoyMention) && approved) {
  remember('approved');
  const address = String(config.store_address || '').trim();
  const maps = String(config.store_maps_url || '').trim();
  output = 'Que notícia boa! 🎉 Venha ao Mercado do Vale para vermos juntos os celulares liberados na sua análise da PayJoy. Aqui você escolhe o aparelho disponível e seguimos com a compra. Esperamos você! 📱';
  if (address || maps) output += '|||' + ['📍 Nossa localização:', address, maps].filter(Boolean).join('||');
  else { output += '|||Vou confirmar nossa localização e enviar para você por aqui. 📍'; payjoyNeedsHandoff = true; }
} else if (payjoyMention) {
  if (/\b(?:documento|preciso levar|precisa|requisito|rg|cnh|rne|chip)\b/.test(normalized)) {
    output = 'Para começar, a PayJoy informa que você precisa de um documento oficial com foto e um número de celular ativo. A aprovação depende da análise de crédito. Se quiser, posso enviar o link para iniciar a análise. 😊';
  } else if (/\b(?:entrada|valor|parcela|preco|quanto|taxa|condicao|juros)\b/.test(normalized)) {
    output = 'A entrada, as parcelas e o custo total aparecem na proposta da PayJoy após a análise. Eles variam conforme o aparelho e as condições aprovadas para você. Não consigo definir esses valores antes da proposta. 😊';
  } else if (/\b(?:pagar|pagamento|pix|vencimento|atras|gerar boleto)\b/.test(normalized) && !/\b(?:como comprar|quero comprar)\b/.test(normalized)) {
    output = 'Depois da contratação, você pode gerar no aplicativo PayJoy o boleto ou Pix de cada parcela. As datas e os valores aparecem na sua proposta. 📱';
  } else if (/\b(?:aprovacao|aprovar|analise|link|boleto|financiamento|parcelar|comprar)\b/.test(normalized) || /^payjoy[?!.\s]*$/.test(normalized)) {
    if (officialLink) {
      remember('awaiting_result');
      output = 'Temos a opção de financiar celular pela PayJoy e pagar as parcelas por boleto ou Pix, conforme a análise de crédito. 😊|||Você pode começar por este link:||' + officialLink + '||Quando aparecer o resultado, me avise por aqui para continuarmos sua compra com o Mercado do Vale. Se a página direcionar você para outra loja, me avise antes de prosseguir.';
      payjoyFollowupKind = 'analysis_check';
    } else {
      output = 'Vou confirmar o link oficial da PayJoy com nossa equipe e enviar para você por aqui. 😊';
      payjoyNeedsHandoff = true;
    }
  } else {
    output = 'Boa pergunta! Quero te passar a informação certinha. 😊 Vou encaminhar sua dúvida para um especialista da nossa equipe, que vai falar com você por aqui assim que confirmar a resposta.';
    payjoyNeedsHandoff = true;
  }
} else if (/\b(?:usado|usados|troca)\b/.test(normalized)) {
  output = 'No momento, trabalhamos somente com celulares novos. 😊||Por isso, não compramos aparelhos usados e também não os aceitamos como entrada ou troca.';
} else if (/\b(?:link de pagamento|pagamento por link)\b/.test(normalized)) {
  output = 'Para cartão de crédito, o pagamento é feito presencialmente, no ato da entrega ou retirada. 💳';
} else if (/\b(?:divide|dividir|parcela|parcelas|parcelamento|quantas vezes)\b/.test(normalized)) {
  output = 'No cartão de crédito, dividimos em até 12x. 💳||As parcelas seguem a tabela da maquininha e eu te passo tudo certinho antes de finalizar. O pagamento no cartão é presencial.';
} else {
  output = 'Recebemos por Pix, transferência bancária, dinheiro, cartão de débito e cartão de crédito. 💳||Para financiar um celular com parcelas em boleto ou Pix, temos a PayJoy, sujeita à análise de crédito. Quer que eu envie o link?';
}
return [{ json: { ...source, output, payjoyFollowupKind, payjoyNeedsHandoff } }];`;

function cloneNode(nodes, name, newName, newId, position) {
  const original = nodes.find((node) => node.name === name);
  if (!original) throw new Error(`Missing node: ${name}`);
  return { ...structuredClone(original), id: newId, name: newName, position };
}

function transformWorkflow(input) {
  const workflow = structuredClone(input);
  const nodes = workflow.nodes;
  const connections = workflow.connections;
  const get = (name) => {
    const node = nodes.find((entry) => entry.name === name);
    if (!node) throw new Error(`Missing node: ${name}`);
    return node;
  };
  if (nodes.some((node) => node.name === 'PayJoy - Buscar Configuracao')) throw new Error('PayJoy patch already applied');

  const resolver = get('Resolver Acao de Conversacao');
  const marker = 'const decision = birthdayCorrectionV372 ||';
  if (!resolver.parameters.jsCode.includes(marker)) throw new Error('Resolver changed; review routing before patching');
  const routing = String.raw`// payjoy-routing-v1
const payjoyStateV1 = $getWorkflowStaticData('global').payjoyByJid?.[remoteJid];
const payjoyCurrentV1 = normalize(text);
const payjoyContextV1 = payjoyStateV1 && Date.now() - Number(payjoyStateV1.updatedAt || 0) < 30 * 86400000;
const payjoyExplicitV1 = /\b(?:payjoy|boleto|financiamento de celular)\b/.test(payjoyCurrentV1);
const payjoyOutcomeV1 = /\b(?:aprovad[oa]|reprovad[oa]|nao aprovou|deu negado|nao consegui|nao passei|fui negad[oa])\b/.test(payjoyCurrentV1);
const payjoyHumanV1 = /\b(?:atendente|humano|vendedor|pessoa da equipe)\b/.test(payjoyCurrentV1);
const deterministicPayjoyV1 = !payjoyHumanV1 && (payjoyExplicitV1 || (payjoyContextV1 && payjoyOutcomeV1))
  ? { acao: 'responder_politica_pagamento', intencao: 'payjoy', confianca: 1, motivo: 'Pergunta ou resultado da analise PayJoy.' }
  : null;
`;
  resolver.parameters.jsCode = resolver.parameters.jsCode.replace(marker, routing + marker.replace('birthdayCorrectionV372 ||', 'birthdayCorrectionV372 || deterministicPayjoyV1 ||'));
  get('Pagamento - Politica').parameters.jsCode = paymentCode;

  const split = get('Dividir mensagens');
  const splitMarker = 'phoneCatalogFollowupEligible: $json.phoneCatalogFollowupEligible === true,';
  if (!split.parameters.jsCode.includes(splitMarker)) throw new Error('Message splitter changed');
  split.parameters.jsCode = split.parameters.jsCode.replace(splitMarker, "payjoyFollowupKind: String($json.payjoyFollowupKind || ''),\n      " + splitMarker);

  const attendant = get('Atendente - Horario');
  const attendantMarker = 'const output = source.birthdayCorrectionActive && correctionDate';
  if (!attendant.parameters.jsCode.includes(attendantMarker)) throw new Error('Attendant response changed');
  attendant.parameters.jsCode = attendant.parameters.jsCode.replace(attendantMarker, "const payjoyUnknownV1 = source.payjoyNeedsHandoff === true;\nconst output = payjoyUnknownV1 ? String(source.output || '') : source.birthdayCorrectionActive && correctionDate");

  const config = cloneNode(nodes, 'Vendas - Buscar Configuracoes Loja', 'PayJoy - Buscar Configuracao', 'payjoy-config-v1', [2040, 64]);
  config.parameters.url = 'https://api.xiaomipetrolina.com.br/n8n-bot/payjoy/config';
  config.retryOnFail = true;
  config.maxTries = 2;
  config.onError = 'continueRegularOutput';
  nodes.push(config);
  const needsHandoff = cloneNode(nodes, 'Follow-up Lista - Ultimo bloco?', 'PayJoy - Precisa especialista?', 'payjoy-human-v1', [2440, 64]);
  needsHandoff.parameters.conditions.conditions[0].leftValue = '={{$json.payjoyNeedsHandoff === true}}';
  nodes.push(needsHandoff);
  const shouldSchedule = cloneNode(nodes, 'Follow-up Lista - Ultimo bloco?', 'PayJoy - Agendar retorno?', 'payjoy-schedule-if-v1', [3590, 260]);
  shouldSchedule.parameters.conditions.conditions[0].leftValue = '={{$json.evolutionAccepted === true && Boolean($json.payjoyFollowupKind) && Number($json.messageIndex) === Number($json.totalMessages)}}';
  nodes.push(shouldSchedule);
  const schedule = cloneNode(nodes, 'Follow-up Lista - Agendar 10 min', 'PayJoy - Agendar retorno', 'payjoy-schedule-v1', [3770, 260]);
  schedule.parameters.url = 'https://api.xiaomipetrolina.com.br/n8n-bot/payjoy/followups/schedule';
  schedule.parameters.bodyParameters.parameters = [
    { name: 'remoteJid', value: '={{$json.remoteJid}}' },
    { name: 'kind', value: '={{$json.payjoyFollowupKind}}' },
  ];
  schedule.retryOnFail = true;
  schedule.maxTries = 2;
  schedule.onError = 'continueRegularOutput';
  nodes.push(schedule);

  const paymentOut = connections['Switch Especialistas'].main[6];
  if (paymentOut?.[0]?.node !== 'Pagamento - Politica') throw new Error('Payment route changed');
  paymentOut[0].node = 'PayJoy - Buscar Configuracao';
  connections['PayJoy - Buscar Configuracao'] = { main: [[{ node: 'Pagamento - Politica', type: 'main', index: 0 }]] };
  connections['Pagamento - Politica'] = { main: [[{ node: 'PayJoy - Precisa especialista?', type: 'main', index: 0 }]] };
  connections['PayJoy - Precisa especialista?'] = { main: [
    [{ node: 'Atendente - Horario', type: 'main', index: 0 }],
    [{ node: 'Estado Conversa - Preparar', type: 'main', index: 0 }],
  ] };
  connections['Envio - Restaurar item aceito'].main[0].push({ node: 'PayJoy - Agendar retorno?', type: 'main', index: 0 });
  connections['PayJoy - Agendar retorno?'] = { main: [
    [{ node: 'PayJoy - Agendar retorno', type: 'main', index: 0 }],
    [],
  ] };
  connections['PayJoy - Agendar retorno'] = { main: [[]] };
  return workflow;
}

if (require.main === module) {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) throw new Error('Usage: node n8n-payjoy-workflow-patch.cjs input.json output.json');
  fs.writeFileSync(outputPath, JSON.stringify(transformWorkflow(JSON.parse(fs.readFileSync(inputPath, 'utf8')))));
}

module.exports = { transformWorkflow, paymentCode };

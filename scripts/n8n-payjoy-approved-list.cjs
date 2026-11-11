'use strict';

const assert = require('node:assert/strict');
const MARK = 'payjoy-approved-list-v1';
const ROUTER = 'PayJoy - Lista aprovada?';
const BYPASS = 'PayJoy - Busca sem preferencias?';
const NODES = ['Vendas - Preparar Busca', 'Vendas - Contexto Produtos', 'Vendas - Catalogo pronto?', 'Vendas - Catalogo sem IA', 'Pagamento - Politica', 'Vendas - Verificar Pos Lista'];

function completeCalculation(source) {
  const c = source?.payjoyCalculation;
  return Boolean(c && Number.isSafeInteger(c.amountCents) && c.amountCents > 0 && c.amountCents <= 100000000
    && Number.isInteger(c.percentBp) && c.percentBp >= 0 && c.percentBp <= 10000
    && Number.isSafeInteger(c.entryCents) && c.entryCents === Math.round(c.amountCents * c.percentBp / 10000)
    && /(?:^|\|\|\||\[\[MSG\]\])A PayJoy aprovou /.test(String(source.output || '')));
}
function once(code, anchor, replacement) {
  assert.equal(code.split(anchor).length - 1, 1, 'Âncora alterada: ' + anchor.slice(0, 90));
  return code.replace(anchor, () => replacement);
}
const edge = node => ({ node, type: 'main', index: 0 });

function patchApprovalIntro(workflow) {
  const params = workflow.nodes.find(n => n.name === NODES[0]).parameters;
  const marker = MARK + ':concise-entry';
  if (!params.jsCode.includes(marker)) params.jsCode = once(params.jsCode, 'payjoyApprovalOutputV1: source.output,',
    "payjoyApprovalOutputV1: String(source.output || '').replace(' Qual aparelho você quer escolher dentro do valor aprovado?', ''), /* " + marker + " */");
  patchAboveApprovedList(workflow);
}

function payjoyCatalogRequestV1(source, state) {
  const text = String(source.conversation || source.text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (source.intencao === 'pedido_humano' || /\b(?:atendentes?|humanos?|vendedor(?:es)?|pessoa da equipe|capas?|peliculas?|carregador(?:es)?|fones?|cabos?|smartwatch(?:es)?|relogios?|tablets?|ipads?)\b/.test(text)
    || /\b(?:nao|nem)\b.{0,35}\b(?:quero|preciso|gostaria|ver|mostr|mande|manda|envia|caros|caro)\b/.test(text)
    || /\b(?:se|caso)\b.{0,50}\b(?:aprov|payjoy)/.test(text)) return null;
  const above = /\bmais (?:caros?|caras?)\b|\bacima (?:do|de|da) (?:valor |limite |minha |meu )?(?:aprovad[oa]|aprovacao|limite)\b/.test(text);
  const within = /\b(?:dentro do valor aprovado|(?:os|aparelhos|modelos) que cabem|voltar (?:para |pra )?(?:a lista|os aparelhos) (?:da aprovacao|do valor aprovado))\b/.test(text);
  if (!above && !within) return null;
  const id = String(source.remoteJid || '');
  const approval = state.payjoyByJid?.[id];
  if (!approval && !state.salesPostList?.[id]?.payjoyCatalogModeV1 && !/\b(?:payjoy|aprovad[oa]|aprovacao)\b/.test(text)) return null;
  const now = Date.now(), at = Number(approval?.updatedAt || 0);
  if (approval?.status !== 'approved' || !Number.isFinite(at) || at <= 0 || now < at || now - at >= 30 * 86400000
    || (approval.expiresAt && (!Number.isFinite(Number(approval.expiresAt)) || Number(approval.expiresAt) <= now))) return { needsConfirmation: true };
  const calculation = calculatePayjoyEntryV4({}, approval);
  if (!Number.isSafeInteger(calculation.entryCents)) return { needsConfirmation: true };
  return { mode: above ? 'above' : 'within', calculation, approvalUpdatedAt: at };
}

function patchAboveApprovedList(workflow) {
  const marker = MARK + ':above-approved';
  const get = name => workflow.nodes.find(n => n.name === name).parameters;
  const prepare = get(NODES[0]);
  const targets = [prepare, get(NODES[1]), get(NODES[5]), get('Resolver Acao de Conversacao')];
  const flags = targets.map(p => p.jsCode.includes(marker));
  if (flags.every(Boolean)) return;
  assert.ok(flags.every(v => !v), 'Patch acima do aprovado aplicado parcialmente');
  const payment = get(NODES[4]).jsCode;
  const start = payment.indexOf('const calculatePayjoyEntryV4=function');
  const end = payment.indexOf('const parsePayjoyTextV4=', start);
  assert.ok(start >= 0 && end > start, 'Cálculo canônico da entrada alterado');
  const helper = '// ' + marker + '\n' + payment.slice(start, end) + '\n' + payjoyCatalogRequestV1.toString() + '\n';
  const confirmation = 'Para mostrar os aparelhos com a entrada correta, confirme o valor aprovado pela PayJoy e o percentual de entrada ou envie o print da aprovação. 😊';
  const post = get(NODES[5]);
  post.jsCode = once(post.jsCode, 'staticData.salesPostList = staticData.salesPostList || {};',
    'staticData.salesPostList = staticData.salesPostList || {};\n' + helper + `
const payjoyCatalogContinuationV1 = payjoyCatalogRequestV1(source, staticData);
if (payjoyCatalogContinuationV1) return [{ json: { ...source,
  salesPostListHandled: !!payjoyCatalogContinuationV1.needsConfirmation,
  payjoyCatalogModeV1: payjoyCatalogContinuationV1.mode || '',
  output: payjoyCatalogContinuationV1.needsConfirmation ? ${JSON.stringify(confirmation)} : '',
  needsDeliveryCepLookup: false, needsPaymentOptionsLookup: false, messages: undefined } }];`);
  const resolver = get('Resolver Acao de Conversacao');
  resolver.jsCode = once(resolver.jsCode, "const rawOutput = String($json.output || $json.text || $json.response || '').trim();",
    "const rawOutput = String($json.output || $json.text || $json.response || '').trim();\n" + helper + `
const payjoyCatalogContinuationV1 = payjoyCatalogRequestV1({ ...source, ...$json }, $getWorkflowStaticData('global'));
if (payjoyCatalogContinuationV1?.calculation) return [{ json: { ...source, ...$json,
  remoteJid, conversation: text, conversationAction: 'listar_catalogo', conversationIntent: 'catalogo_payjoy',
  payjoyCatalogModeV1: payjoyCatalogContinuationV1.mode, payjoyCalculation: payjoyCatalogContinuationV1.calculation,
  salesRequestKind: 'categoria', salesCategoryName: 'smartphones', salesSearchQuery: 'smartphones',
  salesPostListAction: '', salesFlowItemNumber: 0, requestedColor: '', requestedMemory: '',
  productSearchTerm: 'smartphones', paymentQuestion: false, output: '', messages: undefined } }];`);
  prepare.jsCode = once(prepare.jsCode, 'const source = $json;', 'const source = { ...$json };\n' + helper + `
const payjoyCatalogContinuationV1 = payjoyCatalogRequestV1(source, $getWorkflowStaticData('global'));
if (payjoyCatalogContinuationV1?.calculation) Object.assign(source, {
  payjoyCalculation: payjoyCatalogContinuationV1.calculation, payjoyCatalogModeV1: payjoyCatalogContinuationV1.mode,
  payjoyApprovalUpdatedAtV1: payjoyCatalogContinuationV1.approvalUpdatedAt, output: '', messages: undefined });`);
  prepare.jsCode = once(prepare.jsCode, 'if ((function completeCalculation(source) {', 'if (payjoyCatalogContinuationV1?.calculation || (function completeCalculation(source) {');
  const context = get(NODES[1]);
  let code = context.jsCode;
  code = once(code, '&& product.card.totalCents <= base.payjoyCalculation.amountCents)',
    '&& (base.payjoyCatalogModeV1 === \'above\' ? product.card.totalCents > base.payjoyCalculation.amountCents : product.card.totalCents <= base.payjoyCalculation.amountCents))');
  code = once(code, 'const buildChunkedQuoteMessages =', `// ${marker}: append the entry to the canonical formatter, without changing card/Pix prices.
function payjoyAboveQuoteV1(product) {
  if (!base.payjoyApprovedListV1 || base.payjoyCatalogModeV1 !== 'above') return null;
  const c = base.payjoyCalculation, totalCents = product.card?.totalCents;
  if (!Number.isSafeInteger(totalCents) || totalCents <= c.amountCents) return null;
  const differenceCents = totalCents - c.amountCents;
  return { ...c, totalCents, differenceCents, entryWithDifferenceCents: c.entryCents + differenceCents,
    approvalUpdatedAt: base.payjoyApprovalUpdatedAtV1 };
}
function payjoyAboveEntryLineV1(product) {
  const q = payjoyAboveQuoteV1(product);
  return q ? '💰 Entrada com a diferença: ' + centsToBRL(q.entryWithDifferenceCents)
    + ' (' + centsToBRL(q.entryCents) + ' + ' + centsToBRL(q.differenceCents) + ').' : '';
}
const buildChunkedQuoteMessages =`);
  for (const [variable, indent] of [['option', '      '], ['product', '   ']]) {
    const anchor = `if (${variable}.card) chunkLines.push('${indent}💳 Cartão: 12x de ' + ${variable}.card.installment + ' (' + ${variable}.card.total + ')');`;
    code = once(code, anchor, anchor + `\n      if (payjoyAboveEntryLineV1(${variable})) chunkLines.push('${indent}' + payjoyAboveEntryLineV1(${variable}));`);
  }
  code = once(code, "const intro = 'Com a sua aprovação de '", "const intro = base.payjoyCatalogModeV1 === 'above'\n    ? 'Estes aparelhos ficam acima da sua aprovação de ' + centsToBRL(approval.amountCents) + '. A entrada de cada um é a entrada PayJoy de ' + centsToBRL(approval.entryCents) + ' mais a diferença:'\n    : 'Com a sua aprovação de '");
  code = once(code, "    'Esses são os aparelhos dentro do valor aprovado. Se quiser um mais caro, é só dar a diferença na entrada. Qual você prefere? 😊',",
    "    base.payjoyCatalogModeV1 === 'above' ? 'A entrada de cada aparelho já inclui a diferença acima do valor aprovado. Qual você prefere? 😊' : 'Esses são os aparelhos dentro do valor aprovado. Se quiser um mais caro, é só dar a diferença na entrada. Qual você prefere? 😊',");
  code = once(code, "? 'Nenhum aparelho disponível cabe no valor aprovado de '", "? base.payjoyCatalogModeV1 === 'above' ? 'No momento, não há aparelhos disponíveis acima do valor aprovado de ' + centsToBRL(approval.amountCents) + '. Quer que eu envie a lista completa? 😊' : 'Nenhum aparelho disponível cabe no valor aprovado de '");
  code = once(code, "      flow: 'sales_post_list',", "      flow: 'sales_post_list',\n      ...(base.payjoyApprovedListV1 ? { payjoyCatalogModeV1: base.payjoyCatalogModeV1 || 'within', payjoyCalculation: base.payjoyCalculation } : {}),");
  code = once(code, "        number: index + 1,", "        number: index + 1,\n        ...(payjoyAboveQuoteV1(product) ? { payjoyQuoteV1: payjoyAboveQuoteV1(product) } : {}),");
  context.jsCode = code;
}

function patchFreshResult(params) {
  let code = params.jsCode;
  code = once(code, "let output = '';", "// " + MARK + ":fresh-result - expose the already calculated first approval, without changing its response.\nlet payjoyFreshCalculationV1;\nlet output = '';");
  code = once(code, '    const approvedValuesV1 = calculatePayjoyEntryV4(approvedInputV1, {});',
    '    const approvedValuesV1 = calculatePayjoyEntryV4(approvedInputV1, {});\n    payjoyFreshCalculationV1 = approvedValuesV1;');
  code = once(code, 'return [{ json: { ...source, output, payjoyFollowupKind, payjoyNeedsHandoff } }];',
    'return [{ json: { ...source, output, payjoyFollowupKind, payjoyNeedsHandoff, ...(payjoyFreshCalculationV1 ? { payjoyCalculation: payjoyFreshCalculationV1 } : {}) } }];');
  params.jsCode = code;
}

function patchApprovalContinuation(params, paymentCode) {
  const reportStart = paymentCode.indexOf('function payjoyReportedOutcomeV1(raw){');
  const reportEnd = paymentCode.indexOf('const payjoyReportedV1 =', reportStart);
  const parseStart = paymentCode.indexOf('const parsePayjoyTextV4=function');
  const parseEnd = paymentCode.indexOf('const payjoyReplyV4=', parseStart);
  assert.ok(reportStart >= 0 && reportEnd > reportStart && parseStart >= 0 && parseEnd > parseStart, 'Interpretadores canônicos PayJoy alterados');
  let code = params.jsCode;
  code = once(code, ' const currentText=String(source.conversation || source.mensagem || \'\');',
    '// ' + MARK + ':approval-continuation - concrete new approvals interrupt a pending color choice.\n' +
    paymentCode.slice(reportStart, reportEnd) + '\n' + paymentCode.slice(parseStart, parseEnd) +
    ' const currentText=String(source.conversation || source.mensagem || \'\');');
  code = once(code, ' if(!humanOrOther && (validReply || isPayjoyEntryQuestionV2(currentText,payjoy)))', ` const approvalReportV1=payjoyReportedOutcomeV1(currentText);
 const approvalFieldsV1=parsePayjoyTextV4(currentText, '');
 const approvalAtV1=Number(payjoy?.updatedAt || 0), approvalNowV1=Date.now();
 const approvalContextV1=payjoy && ['approved','awaiting_result'].includes(payjoy.status)
   && Number.isFinite(approvalAtV1) && approvalAtV1>0 && approvalNowV1>=approvalAtV1
   && approvalNowV1-approvalAtV1<30*86400000 && (!payjoy.expiresAt || Number(payjoy.expiresAt)>approvalNowV1);
 const newApprovalV1=approvalReportV1.status==='approved' && (approvalFieldsV1.ambiguous
   || approvalFieldsV1.approvedAmount!==null || approvalFieldsV1.entryPercent!==null)
   && (approvalContextV1 || /\\bp\\w{1,3}joy\\b/i.test(currentText));
 if(!humanOrOther && (newApprovalV1 || validReply || isPayjoyEntryQuestionV2(currentText,payjoy)))`);
  params.jsCode = code;
}

function patchWorkflow(workflow) {
  const w = structuredClone(workflow);
  const node = name => {
    const matches = w.nodes.filter(n => n.name === name);
    assert.equal(matches.length, 1, 'Nó ausente/duplicado: ' + name);
    return matches[0];
  };
  const marked = NODES.map(name => JSON.stringify(node(name).parameters).includes(MARK));
  const routers = [ROUTER, BYPASS].map(name => w.nodes.some(n => n.name === name));
  if ([...marked, ...routers].every(Boolean)) { patchApprovalIntro(w); validate(w); return w; }
  // The first live smoke exposed an existing first-approval result not forwarded by payment.
  // Upgrade only that known v1 layout; CAS still pins the exact deployed workflow.
  if (marked.slice(0, 4).every(Boolean) && routers.every(Boolean)) {
    if (!marked[4]) {
      const params = node(NODES[0]).parameters;
      params.jsCode = once(params.jsCode, '&& /^A PayJoy aprovou /.test(String(source.output || \'\'))',
        '&& /(?:^|\\|\\|\\||\\[\\[MSG\\]\\])A PayJoy aprovou /.test(String(source.output || \'\'))');
      const condition = node(ROUTER).parameters.conditions.conditions[0];
      assert.ok(condition.leftValue.includes('&& /^A PayJoy aprovou /'), 'Guard de aprovação alterado');
      condition.leftValue = '={{(' + completeCalculation.toString() + ')($json)}}';
      patchFreshResult(node(NODES[4]).parameters);
    }
    if (!marked[5]) patchApprovalContinuation(node(NODES[5]).parameters, node(NODES[4]).parameters.jsCode);
    patchApprovalIntro(w);
    validate(w);
    return w;
  }
  assert.ok([...marked, ...routers].every(v => !v), 'Patch PayJoy aplicado parcialmente');

  const prepare = node(NODES[0]).parameters;
  const categoryMatch = prepare.jsCode.match(/const SMARTPHONES_CATEGORY_ID = '([^']+)';/);
  assert.ok(categoryMatch, 'Categoria canônica de smartphones ausente');
  const category = categoryMatch[1];
  prepare.jsCode = once(prepare.jsCode, 'const source = $json;', `const source = $json;
// ${MARK}: preserve the approval response and use the normal catalog HTTP nodes.
if ((${completeCalculation.toString()})(source)) {
  return [{ json: { ...source, payjoyApprovedListV1: true, payjoyApprovalOutputV1: source.output,
    productSearchTerm: 'smartphones', productSearchKind: 'categoria', productCategoryId: ${JSON.stringify(category)},
    productSearchOriginalText: 'lista de celulares', salesCategoryId: ${JSON.stringify(category)},
    salesFilters: {}, maxPriceCents: 0, cameraPriority: false, cameraMinMpx: 0,
    screenPriority: false, screenType: '', screenMinHz: 0, requestedDeviceBrand: '',
    requestedDeviceFamiliesMetaV1: [], requestedDeviceFamily: '', requestedDeviceBrandLabel: '',
    needsDeviceClarification: false, explicitPhoneDeviceRequest: true, accessoryRequest: false,
    phoneMemoryFilterRequest: false, phoneNfcFilterRequest: false, requestedNfc: '',
    phone5gFilterRequest: false, requestedNetwork: '', requestedRamGb: [], requestedStorageGb: [],
    memoryFilterLabel: '', specificDeviceModelRequest: false, requestedDeviceModelQuery: '',
    requestedDeviceModelLabel: '', salesCheapestFirstV1: false, salesCatalogIntentV1: '',
    tabletCatalogV1: false, photoCatalogRequestedV1: false, structuredPhoneComparison: false,
    salesPostListHandled: false, requiresSpecialistHandoff: false, output: '' } }];
}`);

  const context = node(NODES[1]).parameters;
  let code = context.jsCode;
  code = once(code, 'const selectedCardFee = fees', `// ${MARK}: fail closed on an absent/invalid 12x rate, without changing other catalogs.
const selectedCardFee = fees
  .filter(fee => !base.payjoyApprovedListV1 || (fee?.applied_fee_pct !== null && fee?.applied_fee_pct !== undefined
    && String(fee.applied_fee_pct).trim() !== '' && Number.isFinite(Number(fee.applied_fee_pct)) && Number(fee.applied_fee_pct) >= 0))`);
  code = once(code, '    installments: 12,\n    installment: centsToBRL(installmentCents),',
    '    ...(base.payjoyApprovedListV1 ? { totalCents } : {}),\n    installments: 12,\n    installment: centsToBRL(installmentCents),');
  // Canonical configuration grouping has already selected the largest current effective price.
  code = once(code, 'const sortedProducts = Array.from(groupsByKey.values())', `const sortedProducts = Array.from(groupsByKey.values())
  .filter(product => !base.payjoyApprovedListV1 || (isSmartphoneProduct(product) && !isAccessoryProduct(product)
    && Number.isSafeInteger(product.card?.totalCents) && product.card.totalCents > 0
    && product.card.totalCents <= base.payjoyCalculation.amountCents))`);
  code = once(code, 'const availableBrandLabelsV246 =', `if (base.payjoyApprovedListV1) products.sort((a, b) => b.card.totalCents - a.card.totalCents || String(a.name).localeCompare(String(b.name), 'pt-BR'));
const availableBrandLabelsV246 =`);
  code = once(code, 'const quoteMessages = buildQuoteMessages();', `let quoteMessages = buildQuoteMessages();
if (base.payjoyApprovedListV1) {
  const approval = base.payjoyCalculation;
  const intro = 'Com a sua aprovação de ' + centsToBRL(approval.amountCents) + ' (entrada de ' + centsToBRL(approval.entryCents) + '), estes aparelhos cabem no valor:';
  quoteMessages = products.length ? [
    ...buildChunkedQuoteMessages(products, 0, true, false, intro),
    'Esses são os aparelhos dentro do valor aprovado. Se quiser um mais caro, é só dar a diferença na entrada. Qual você prefere? 😊',
  ] : [selectedCardFee
    ? 'Nenhum aparelho disponível cabe no valor aprovado de ' + centsToBRL(approval.amountCents) + '. Você pode escolher um modelo dando a diferença na entrada. Quer que eu envie a lista completa? 😊'
    : 'Não consegui confirmar a tabela de 12x agora. A entrada calculada continua a mesma. Quer que eu envie a lista completa enquanto confirmamos os valores no cartão? 😊'];
}`);
  code = once(code, 'const suppressRepeatedCatalogV342 = (function', 'const suppressRepeatedCatalogV342 = !base.payjoyApprovedListV1 && (function');
  code = once(code, '  : (isDirectPriceQuestion && products.length === 1 && !unavailableRequestedDevice',
    '  : (!base.payjoyApprovedListV1 && isDirectPriceQuestion && products.length === 1 && !unavailableRequestedDevice');
  code = once(code, 'const deterministicCatalogOutputV322 = [fallbackCatalogIntroV1, ...finalQuoteMessages.filter(Boolean)].filter(Boolean).join(\'[[MSG]]\');',
    `const deterministicCatalogOutputV322 = base.payjoyApprovedListV1
  ? [base.payjoyApprovalOutputV1, ...finalQuoteMessages.filter(Boolean)].filter(Boolean).join('[[MSG]]')
  : [fallbackCatalogIntroV1, ...finalQuoteMessages.filter(Boolean)].filter(Boolean).join('[[MSG]]');`);
  context.jsCode = code;
  const ready = node(NODES[2]).parameters.conditions.conditions[0];
  assert.ok(ready.leftValue.startsWith('={{$json.productSearchKind'), 'Contrato do catálogo direto alterado');
  ready.leftValue = ready.leftValue.replace('={{', '={{/* ' + MARK + ' */ $json.payjoyApprovedListV1 === true || (').replace(/}}$/, ')}}');
  const direct = node(NODES[3]).parameters;
  direct.jsCode = once(direct.jsCode, "const catalog = String(source.deterministicCatalogOutput || '').trim();", `const catalog = String(source.deterministicCatalogOutput || '').trim();
// ${MARK}: keep approval first, the eligible catalog next, and its own final choice message.
if (source.payjoyApprovedListV1 === true && catalog) return [{ json: { ...source, output: catalog,
  requiresSpecialistHandoff: false, phoneCatalogFollowupEligible: false } }];`);

  const template = node('PayJoy - Precisa especialista?');
  const makeIf = (name, suffix, expression, position) => {
    const n = structuredClone(template);
    n.id = MARK + '-' + suffix; n.name = name; n.position = position;
    n.notes = 'Lista PayJoy usa consulta, taxas, agrupamento e estado pós-lista canônicos; não persiste aprovação como preferência de preço.';
    n.notesInFlow = true;
    n.parameters.conditions.conditions = [{ id: n.id, leftValue: expression, rightValue: true,
      operator: { type: 'boolean', operation: 'true', singleValue: true } }];
    return n;
  };
  w.nodes.push(makeIf(ROUTER, 'router', '={{(' + completeCalculation.toString() + ')($json)}}', [2400, 1320]));
  w.nodes.push(makeIf(BYPASS, 'bypass', '={{$json.payjoyApprovedListV1 === true}}', [2600, 1320]));
  assert.deepEqual(w.connections['PayJoy - Calcular entrada do print'].main, [[edge('Estado Conversa - Preparar')]]);
  assert.deepEqual(w.connections['PayJoy - Precisa especialista?'].main[1], [edge('Estado Conversa - Preparar')]);
  assert.deepEqual(w.connections[NODES[0]].main, [[edge('Vendas - Persistir Preferencias')]]);
  w.connections['PayJoy - Calcular entrada do print'].main = [[edge(ROUTER)]];
  w.connections['PayJoy - Precisa especialista?'].main[1] = [edge(ROUTER)];
  w.connections[ROUTER] = { main: [[edge(NODES[0])], [edge('Estado Conversa - Preparar')]] };
  w.connections[NODES[0]].main = [[edge(BYPASS)]];
  w.connections[BYPASS] = { main: [[edge('Vendas - Buscar Produtos')], [edge('Vendas - Persistir Preferencias')]] };
  patchFreshResult(node(NODES[4]).parameters);
  patchApprovalContinuation(node(NODES[5]).parameters, node(NODES[4]).parameters.jsCode);
  patchApprovalIntro(w);
  validate(w);
  return w;
}

function validate(w) {
  const names = new Set(w.nodes.map(n => n.name));
  assert.equal(names.size, w.nodes.length, 'Nomes duplicados');
  for (const [from, outputs] of Object.entries(w.connections)) {
    assert.ok(names.has(from));
    for (const groups of Object.values(outputs)) for (const group of groups) for (const e of group) assert.ok(names.has(e.node), 'Destino ausente');
  }
  for (const name of NODES) {
    const n = w.nodes.find(n => n.name === name);
    assert.ok(JSON.stringify(n.parameters).includes(MARK), 'Marcador ausente');
    if (n.parameters.jsCode) new Function(n.parameters.jsCode);
  }
  for (const name of [ROUTER, BYPASS]) assert.equal(w.nodes.filter(n => n.name === name).length, 1);
  assert.deepEqual(w.connections[ROUTER].main, [[edge(NODES[0])], [edge('Estado Conversa - Preparar')]]);
  assert.deepEqual(w.connections[BYPASS].main, [[edge('Vendas - Buscar Produtos')], [edge('Vendas - Persistir Preferencias')]]);
  assert.deepEqual(w.connections[NODES[0]].main, [[edge(BYPASS)]]);
  assert.deepEqual(w.connections['PayJoy - Calcular entrada do print'].main, [[edge(ROUTER)]]);
  assert.deepEqual(w.connections['PayJoy - Precisa especialista?'].main[1], [edge(ROUTER)]);
}
module.exports = { MARK, NODES, ROUTER, BYPASS, patchWorkflow, completeCalculation, validate };

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { Client } = require('ssh2');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.vps.local'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const { getVpsSshConfig } = require('./vps-ssh-config.cjs');
const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const SMARTPHONES_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const MARKER = 'phone-5g-filter-brand-chunks-v338';
const APPLY = process.argv.includes('--apply-production');

const normalize = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function detectPhone5gFilter(value, { activeSmartphoneCatalog = false, salesProductIntent = false } = {}) {
  const text = normalize(value);
  if (!/\b5\s*g\b/.test(text) || /\b5\s*ghz\b/.test(text)) return '';
  if (/\b5\s*g(?:b)?\s*(?:de\s*)?(?:ram|memoria\s+ram)\b/.test(text)) return '';
  if (/\b(?:roteador|modem|wifi|wi-fi|smartwatch|relogio inteligente|capa|capinha|pelicula|carregador|cabo|fonte|fone|acessorio)\b/.test(text)) return '';
  const explicitPhone = /\b(?:celular|celulares|smartphone|smartphones|aparelho|aparelhos|telefone|telefones|iphone|iphones|redmi|poco|xiaomi|realme|samsung|motorola|infinix)\b/.test(text);
  return explicitPhone || activeSmartphoneCatalog || salesProductIntent ? '5g' : '';
}

function hasConfirmed5g(product) {
  const specs = product?.specs || {};
  const custom = product?.custom_fields || {};
  const explicit5gValue = normalize(specs['5g'] ?? custom['5g']);
  const network = normalize([
    specs.rede_operadora, specs.network, specs.rede, specs.tipo_rede,
    custom.rede_operadora, custom.network, custom.rede, custom.tipo_rede,
  ].filter(Boolean).join(' '));
  const confirmed = /\b5\s*g\b/.test(network) || ['sim', 'yes', 'true', '1', '5g'].includes(explicit5gValue);
  const name = normalize([product?.name, product?.model, product?.originalName].filter(Boolean).join(' '));
  const explicitNameConflict = /\b4\s*g\b/.test(name) && !/\b5\s*g\b/.test(name);
  return confirmed && !explicitNameConflict;
}

function filterRowsBy5g(rows) {
  return (Array.isArray(rows) ? rows : []).filter(hasConfirmed5g);
}

function buildBrandSafeChunks(products, brandOf, chunkSize = 3) {
  const items = Array.isArray(products) ? products : [];
  const chunks = [];
  let groupStart = 0;
  while (groupStart < items.length) {
    const brand = String(brandOf(items[groupStart]) || 'Outros');
    let groupEnd = groupStart + 1;
    while (groupEnd < items.length && String(brandOf(items[groupEnd]) || 'Outros') === brand) groupEnd += 1;
    for (let offset = groupStart; offset < groupEnd; offset += chunkSize) {
      chunks.push({ brand, offset, items: items.slice(offset, Math.min(offset + chunkSize, groupEnd)) });
    }
    groupStart = groupEnd;
  }
  return chunks;
}

function findNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  assert.ok(node, `${name} must exist`);
  return node;
}

function patchClassifier(node) {
  let prompt = String(node.parameters?.options?.systemMessage || '');
  if (prompt.includes(MARKER)) return;
  prompt += `\n- Quando o cliente pedir celulares 5G, somente 5G ou combinar 5G com marca, RAM, armazenamento, NFC ou preco, use venda.tipo="categoria", venda.categoria="smartphones", venda.categoria_id="${SMARTPHONES_CATEGORY_ID}" e venda.filtros.rede="5g". 5G isolado ou no nome do modelo significa rede movel e nunca RAM. Somente 5GB, 5 GB de RAM ou equivalente explicito significa memoria. // ${MARKER}`;
  node.parameters.options.systemMessage = prompt;
}

function patchParse(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('classifierNetworkFilterV338')) return;
  const nfcBlock = /const classifierNfcFilterV228 = \(\(\) => \{[\s\S]*?\n\}\)\(\);/;
  const match = code.match(nfcBlock);
  assert.ok(match, 'Parse classifier NFC block changed');
  code = code.replace(match[0], `${match[0]}
const classifierNetworkFilterV338 = (() => {
  const value = String(vendaFiltrosV228.rede || vendaFiltrosV228.network || vendaFiltrosV228.rede_operadora || vendaFiltrosV228['5g'] || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, '').trim();
  return value === '5g' || ['sim', 'yes', 'true', '1'].includes(value) ? '5g' : '';
})();`);
  const output = '    salesNfcFilter: classifierNfcFilterV228,';
  assert.ok(code.includes(output), 'Parse NFC output changed');
  node.parameters.jsCode = code.replace(output, `${output}\n    salesNetworkFilter: classifierNetworkFilterV338,`);
}

function patchResolver(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('deterministicPhone5gFilterV338')) return;
  const marker = 'const normalizedPhoneMemoryTextV155 = normalize(text);';
  assert.ok(code.includes(marker), 'Resolver memory marker changed');
  const addition = `// ${MARKER}: 5G is mobile network, never an implicit RAM value.
const normalizedPhone5gTextV338 = normalize(text);
const activePhone5gStateV338 = getActivePostList();
const explicitFiveGbRamV338 = /\\b5\\s*g(?:b)?\\s*(?:de\\s*)?(?:ram|memoria\\s+ram)\\b/.test(normalizedPhone5gTextV338);
const phone5gExcludedContextV338 = explicitFiveGbRamV338 || /\\b(?:roteador|modem|wifi|wi-fi|smartwatch|relogio inteligente|capa|capinha|pelicula|carregador|cabo|fonte|fone|acessorio)\\b/.test(normalizedPhone5gTextV338) || /\\b5\\s*ghz\\b/.test(normalizedPhone5gTextV338);
const directPhone5gMentionV338 = /\\b5\\s*g\\b/.test(normalizedPhone5gTextV338);
const explicitPhone5gContextV338 = /\\b(?:celular|celulares|smartphone|smartphones|aparelho|aparelhos|telefone|telefones|iphone|iphones|redmi|poco|xiaomi|realme|samsung|motorola|infinix)\\b/.test(normalizedPhone5gTextV338);
const activeSmartphone5gCatalogV338 = String(activePhone5gStateV338?.categoryId || '') === '${SMARTPHONES_CATEGORY_ID}';
const inheritedPhone5gV338 = String($json.salesNetworkFilter || $json.requestedNetwork || '').toLowerCase().replace(/\\s+/g, '') === '5g';
const phone5gFilterIntentV338 = !phone5gExcludedContextV338 && (inheritedPhone5gV338 || (directPhone5gMentionV338 && (explicitPhone5gContextV338 || activeSmartphone5gCatalogV338 || String($json.intencao || '') === 'vendas_produtos')));
const deterministicPhone5gFilterV338 = phone5gFilterIntentV338
  ? { acao: 'listar_catalogo', intencao: 'catalogo_5g', produto_busca: 'smartphones', rede: '5g', confianca: 1, motivo: 'Filtro deterministico de rede movel 5G em smartphones.' }
  : null;
${marker}`;
  code = code.replace(marker, addition);
  const decisionMarker = 'deterministicFiscalDocumentDecisionV164 || deterministicPhoneNfcFilterV228 ||';
  assert.ok(code.includes(decisionMarker), 'Resolver decision priority changed');
  code = code.replace(decisionMarker, 'deterministicFiscalDocumentDecisionV164 || deterministicPhone5gFilterV338 || deterministicPhoneNfcFilterV228 ||');
  const output = "    requestedNfc: phoneNfcFilterIntentV228 ? 'sim' : '',";
  assert.ok(code.includes(output), 'Resolver NFC output changed');
  node.parameters.jsCode = code.replace(output, `${output}\n    requestedNetwork: phone5gFilterIntentV338 ? '5g' : '',`);
}

function patchPrepare(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('phone5gFilterRequestV338')) return;
  const fallback = `    const gb = capacityToGb(match[1], match[2]);
    if (!gb) continue;
    if (gb <= 24) ram.add(gb); else storage.add(gb);`;
  assert.ok(code.includes(fallback), 'Prepare generic memory fallback changed');
  code = code.replace(fallback, `    const gb = capacityToGb(match[1], match[2]);
    const unitV338 = String(match[2] || '').toLowerCase();
    // Bare 5G is network. Explicit "5 GB de RAM" was already collected and masked above.
    if (!gb || (gb === 5 && unitV338 === 'g')) continue;
    if (gb <= 24) ram.add(gb); else storage.add(gb);`);
  const ramLine = 'const requestedRamGb = phoneMemoryFiltersV155.requestedRamGb.length ? phoneMemoryFiltersV155.requestedRamGb : (Array.isArray(mergedSalesFiltersV288.ramGb) ? mergedSalesFiltersV288.ramGb.map(Number).filter(v => v > 0) : []);';
  assert.ok(code.includes(ramLine), 'Prepare requested RAM line changed');
  const networkBlock = `const explicitFiveGbRamV338 = /\\b(?:5\\s*gb?\\s*(?:de\\s*)?(?:ram|memoria\\s+ram)|(?:ram|memoria\\s+ram)\\s*(?:de|com)?\\s*5\\s*gb?)\\b/.test(normalized);
const directPhone5gMentionV338 = /\\b5\\s*g\\b/.test(normalized) && !/\\b5\\s*ghz\\b/.test(normalized);
const requestedNetworkV338 = String(source.requestedNetwork || source.salesNetworkFilter || mergedSalesFiltersV288.network || mergedSalesFiltersV288.rede || '').toLowerCase().replace(/\\s+/g, '') === '5g' || (directPhone5gMentionV338 && !explicitFiveGbRamV338) ? '5g' : '';
const phone5gFilterRequestV338 = !accessoryRequest && requestedNetworkV338 === '5g';
const requestedRamGb = (phoneMemoryFiltersV155.requestedRamGb.length ? phoneMemoryFiltersV155.requestedRamGb : (Array.isArray(mergedSalesFiltersV288.ramGb) ? mergedSalesFiltersV288.ramGb.map(Number).filter(v => v > 0) : []))
  .filter((value) => !(phone5gFilterRequestV338 && Number(value) === 5 && !explicitFiveGbRamV338));`;
  code = code.replace(ramLine, networkBlock);
  code = code.replace(
    'const phoneMemoryFilterRequest = (explicitPhoneDeviceRequest || phoneNfcFilterRequestV228)',
    'const phoneMemoryFilterRequest = (explicitPhoneDeviceRequest || phoneNfcFilterRequestV228 || phone5gFilterRequestV338)',
  );
  const force = '  || phoneNfcFilterRequestV228\n  || Boolean(selectedListOptionV301)';
  assert.ok(code.includes(force), 'Prepare force category block changed');
  code = code.replace(force, '  || phoneNfcFilterRequestV228\n  || phone5gFilterRequestV338\n  || Boolean(selectedListOptionV301)');
  const output = '    requestedNfc: requestedNfcV228,';
  assert.ok(code.includes(output), 'Prepare NFC output changed');
  node.parameters.jsCode = code.replace(output, `${output}\n    phone5gFilterRequest: phone5gFilterRequestV338,\n    requestedNetwork: requestedNetworkV338,`);
}

function patchContext(node) {
  let code = String(node.parameters?.jsCode || '');
  if (code.includes('networkFilteredRowsV338')) return;
  const structuredMarker = '// structured-sales-filters-v288:start';
  assert.ok(code.includes(structuredMarker), 'Context structured-filter marker changed');
  const networkBlock = `// ${MARKER}: require confirmed structured 5G and reject explicit name/spec conflicts.
const requestedNetworkV338 = String(base.requestedNetwork || base.salesFilters?.network || base.salesFilters?.rede || '').toLowerCase().replace(/\\s+/g, '') === '5g' ? '5g' : '';
const phone5gFilterRequestV338 = base.phone5gFilterRequest === true && requestedNetworkV338 === '5g';
const normalizeNetworkV338 = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
const hasConfirmed5gV338 = (product) => {
  const specs = product?.specs || {};
  const custom = product?.custom_fields || {};
  const explicit5g = normalizeNetworkV338(specs['5g'] ?? custom['5g']).replace(/\\s+/g, '');
  const network = normalizeNetworkV338([specs.rede_operadora, specs.network, specs.rede, specs.tipo_rede, custom.rede_operadora, custom.network, custom.rede, custom.tipo_rede].filter(Boolean).join(' '));
  const confirmed = /\\b5\\s*g\\b/.test(network) || ['sim', 'yes', 'true', '1', '5g'].includes(explicit5g);
  const name = normalizeNetworkV338([product?.name, product?.model, product?.originalName].filter(Boolean).join(' '));
  const explicitNameConflict = /\\b4\\s*g\\b/.test(name) && !/\\b5\\s*g\\b/.test(name);
  return confirmed && !explicitNameConflict;
};
const networkFilteredRowsV338 = phone5gFilterRequestV338 ? featureFilteredRowsV228.filter(hasConfirmed5gV338) : featureFilteredRowsV228;
${structuredMarker}`;
  code = code.replace(structuredMarker, networkBlock);
  const structuredInput = 'let structuredFilteredRowsV288 = featureFilteredRowsV228.filter((p) => {';
  assert.ok(code.includes(structuredInput), 'Context structured input changed');
  code = code.replace(structuredInput, 'let structuredFilteredRowsV288 = networkFilteredRowsV338.filter((p) => {');
  const structuredFlag = 'phoneNfcFilterRequestV228 || phoneMemoryFilterRequestV155);';
  assert.ok(code.includes(structuredFlag), 'Context structured flag changed');
  code = code.replace(structuredFlag, 'phoneNfcFilterRequestV228 || phone5gFilterRequestV338 || phoneMemoryFilterRequestV155);');
  const title = "const phoneFilterLabelV228 = [phoneNfcFilterRequestV228 ? 'NFC' : '', String(base.memoryFilterLabel || '').trim()].filter(Boolean).join(' e ');";
  assert.ok(code.includes(title), 'Context filter title changed');
  code = code.replace(title, "const phoneFilterLabelV228 = [phone5gFilterRequestV338 ? '5G' : '', phoneNfcFilterRequestV228 ? 'NFC' : '', String(base.memoryFilterLabel || '').trim()].filter(Boolean).join(' e ');");
  const chunk = `const chunkSize = 5;`;
  assert.ok(code.includes(chunk), 'Context legacy chunk size changed');
  code = code.replace(chunk, `const chunkSize = 3; // ${MARKER}: maximum three smartphones per WhatsApp message.`);
  const oldBuilder = `const buildChunkedQuoteMessages = (items, startOffset, includeHeader, includeQuestionOnLast, intro) => {
  const messages = [];
  const totalChunks = Math.ceil(items.length / chunkSize);
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const offset = chunkIndex * chunkSize;
    const chunk = items.slice(offset, offset + chunkSize);
    const last = offset + chunk.length >= items.length;
    const message = buildQuoteMessageForProducts(chunk, startOffset + offset, includeHeader && chunkIndex === 0, includeQuestionOnLast && last);
    messages.push([chunkIndex === 0 ? intro : '', message].filter(Boolean).join('[[BR]]'));
  }
  return messages;
};`;
  assert.ok(code.includes(oldBuilder), 'Context legacy global chunk builder changed');
  const newBuilder = `const buildChunkedQuoteMessages = (items, startOffset, includeHeader, includeQuestionOnLast, intro) => {
  const messages = [];
  const chunks = [];
  let groupStart = 0;
  while (groupStart < items.length) {
    const brandLabel = quoteBrandGroupV227(items[groupStart]).label;
    let groupEnd = groupStart + 1;
    while (groupEnd < items.length && quoteBrandGroupV227(items[groupEnd]).label === brandLabel) groupEnd += 1;
    for (let offset = groupStart; offset < groupEnd; offset += chunkSize) {
      chunks.push({ offset, products: items.slice(offset, Math.min(offset + chunkSize, groupEnd)) });
    }
    groupStart = groupEnd;
  }
  chunks.forEach((entry, chunkIndex) => {
    const last = chunkIndex === chunks.length - 1;
    const message = buildQuoteMessageForProducts(entry.products, startOffset + entry.offset, includeHeader && chunkIndex === 0, includeQuestionOnLast && last);
    messages.push([chunkIndex === 0 ? intro : '', message].filter(Boolean).join('[[BR]]'));
  });
  return messages;
};`;
  code = code.replace(oldBuilder, newBuilder);
  const state = `        nfc: requestedNfcV228,
        ramGb: requestedRamGbV155,`;
  assert.ok(code.includes(state), 'Context saved filters changed');
  code = code.replace(state, `        nfc: requestedNfcV228,\n        network: requestedNetworkV338,\n        ramGb: requestedRamGbV155,`);
  const unavailable = 'products.length === 0 && prefersSmartphones && !hasStructuredPreferenceV288 && !phoneNfcFilterRequestV228 && !phoneMemoryFilterRequestV155;';
  assert.ok(code.includes(unavailable), 'Context unavailable guard changed');
  code = code.replace(unavailable, 'products.length === 0 && prefersSmartphones && !hasStructuredPreferenceV288 && !phoneNfcFilterRequestV228 && !phone5gFilterRequestV338 && !phoneMemoryFilterRequestV155;');
  const productsContextPattern = /productsContext: phoneNfcFilterRequestV228 && products\.length === 0[\s\S]*?: lines\.join\([^)]*\),/;
  const productsContext = code.match(productsContextPattern)?.[0] || '';
  assert.ok(productsContext, 'Context no-result response changed');
  node.parameters.jsCode = code.replace(productsContext, `    productsContext: phone5gFilterRequestV338 && products.length === 0
      ? 'FILTRO_INTERNO_5G_SEM_RESULTADO_CONFIRMADO: nenhum smartphone ativo, visivel e com estoque correspondeu simultaneamente aos filtros e a rede 5G confirmada. Valores vazios, Consulte e conflitos entre nome e especificacao foram excluidos. Responda com palavras proprias e nao envie a lista geral.'
      : (phoneNfcFilterRequestV228 && products.length === 0
        ? 'FILTRO_INTERNO_NFC_SEM_RESULTADO_CONFIRMADO: nenhum smartphone ativo, visivel e com estoque correspondeu simultaneamente aos filtros solicitados e ao NFC com valor exato Sim. Valores Consulte, vazios e SKUs conflitantes Sim/Consulte foram excluidos. Responda com palavras proprias e, se for util, ofereca conferencia por especialista.'
        : lines.join('\\n')),`);
}

function patchSalesSpecialist(node) {
  let prompt = String(node.parameters?.options?.systemMessage || '');
  if (prompt.includes('FILTRO_INTERNO_5G_SEM_RESULTADO_CONFIRMADO')) return;
  prompt += `\n- Se o contexto contiver FILTRO_INTERNO_5G_SEM_RESULTADO_CONFIRMADO, responda de forma curta e gentil que nao encontrou no estoque atual aparelho com 5G confirmado e os demais filtros pedidos. Pode oferecer conferencia por especialista. Nao copie o marcador, nao invente modelos e nao envie a lista geral. // ${MARKER}`;
  node.parameters.options.systemMessage = prompt;
}

function patchWorkflow(nodes) {
  patchClassifier(findNode(nodes, 'Agente Inicial - Classificador'));
  patchParse(findNode(nodes, 'Parse Classificacao'));
  patchResolver(findNode(nodes, 'Resolver Acao de Conversacao'));
  patchPrepare(findNode(nodes, 'Vendas - Preparar Busca'));
  patchContext(findNode(nodes, 'Vendas - Contexto Produtos'));
  patchSalesSpecialist(findNode(nodes, 'Especialista - Vendas'));
  for (const node of nodes.filter((item) => item.type === 'n8n-nodes-base.code' && item.parameters?.jsCode)) {
    assert.doesNotThrow(() => new Function(node.parameters.jsCode), `${node.name} must compile`);
  }
  return nodes;
}

function validatePrepare(nodes) {
  const code = findNode(nodes, 'Vendas - Preparar Busca').parameters.jsCode;
  const base = {
    intencao: 'vendas_produtos', salesRequestKind: 'categoria', salesCategoryName: 'smartphones',
    salesCategoryId: SMARTPHONES_CATEGORY_ID, remoteJid: '559999999999@s.whatsapp.net', Instancia: 'botmercadodovale',
  };
  const run = (conversation, extra = {}) => vm.runInNewContext(`(function(){${code}})()`, { $json: { ...base, conversation, classificacaoMensagem: conversation, ...extra } })[0].json;
  return {
    only5g: run('somente 5g', { requestedNetwork: '5g' }),
    explicit5gbRam: run('celulares com 5 GB de RAM'),
    explicit5gRam: run('celulares com 5 G de RAM'),
    combined: run('celulares 5g com 128GB', { requestedNetwork: '5g' }),
  };
}

function validateResolver(nodes) {
  const code = findNode(nodes, 'Resolver Acao de Conversacao').parameters.jsCode;
  const remoteJid = '559999999999@s.whatsapp.net';
  const staticData = { salesPostList: { [remoteJid]: { categoryId: SMARTPHONES_CATEGORY_ID, expiresAt: Date.now() + 60000 } } };
  const run = (conversation) => {
    const input = {
      conversation, classificacaoMensagem: conversation, intencao: 'vendas_produtos',
      remoteJid, Instancia: 'botmercadodovale',
    };
    return vm.runInNewContext(`(function(){${code}})()`, {
    $json: input,
    $: () => ({ first: () => ({ json: input }) }),
    $getWorkflowStaticData: () => staticData,
    Date,
  })[0].json;
  };
  return { only5g: run('somente 5g'), wifi: run('roteador Wi-Fi 5 GHz'), explicitRam: run('celular com 5 G de RAM') };
}

async function validateCatalog(nodes) {
  const prepare = validatePrepare(nodes).only5g;
  const contextCode = findNode(nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  const [productsResponse, feesResponse] = await Promise.all([
    fetch(`https://api.xiaomipetrolina.com.br/products?category=${SMARTPHONES_CATEGORY_ID}&status=active&compact=true&limit=500&sort_by=stock_quantity&sort_direction=desc`),
    fetch('https://api.xiaomipetrolina.com.br/payment-fees'),
  ]);
  assert.ok(productsResponse.ok && feesResponse.ok, 'Catalog APIs must respond');
  const products = await productsResponse.json();
  const fees = await feesResponse.json();
  const source = { ...prepare, saudacaoDetectada: false };
  const staticData = {};
  const selectors = {
    'Vendas - Preparar Busca': { first: () => ({ json: source }) },
    'Vendas - Buscar Produtos': { all: () => products.map((json) => ({ json })) },
    'switc Mensagens': { first: () => ({ json: source }) },
  };
  const result = vm.runInNewContext(`(function(){${contextCode}})()`, {
    $input: { all: () => fees.map((json) => ({ json })) },
    $getWorkflowStaticData: () => staticData,
    $: (name) => selectors[name], Date, Intl,
  })[0].json;
  const messages = String(result.deterministicCatalogOutput || '').split('[[MSG]]').map((message) => message.trim()).filter(Boolean);
  const catalogMessages = messages.filter((message) => /(?:^|\[\[BR\]\])\d+\.\s/.test(message));
  return {
    filteredConfigurations: result.productsInStock?.length || 0,
    sourceConfirmed5gRows: products.filter((product) => Number(product.stock_quantity) > 0 && product.offer_visibility !== 'hidden').filter(hasConfirmed5g).length,
    allOutputsRejectExplicit4g: (result.productsInStock || []).every((product) => !/\b4\s*g\b/i.test(String(product.name || ''))),
    catalogMessageCounts: catalogMessages.map((message) => (message.match(/(?:^|\[\[BR\]\])\d+\.\s/g) || []).length),
    brandHeadersPerMessage: catalogMessages.map((message) => (message.match(/🏷️/g) || []).length),
    lastMessageHasQuestion: /Qual numero chamou mais sua atencao\?/.test(catalogMessages.at(-1) || ''),
    outputPreview: String(result.deterministicCatalogOutput || '').slice(0, 300),
  };
}

const shQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const dollar = (value, tag) => `$${tag}$${value}$${tag}$`;
const runRemote = (connection, command) => new Promise((resolve, reject) => {
  connection.exec(command, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `Remote command failed: ${code}`)));
  });
});
const psql = (connection, db, sql) => new Promise((resolve, reject) => {
  connection.exec(`docker exec -i ${shQuote(db)} psql -U postgres -d n8n -X -q -t -A`, (error, stream) => {
    if (error) return reject(error);
    let stdout = ''; let stderr = '';
    stream.on('data', (chunk) => { stdout += chunk; });
    stream.stderr.on('data', (chunk) => { stderr += chunk; });
    stream.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout || `psql failed: ${code}`)));
    stream.end(sql);
  });
});
async function waitService(connection, service, expected) {
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const state = (await runRemote(connection, `docker service ls --filter name=${shQuote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();
    if (state === `${expected}/${expected}`) return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${service} did not reach ${expected}/${expected}`);
}

async function main() {
  const connection = new Client();
  await new Promise((resolve, reject) => connection.on('ready', resolve).on('error', reject).connect(getVpsSshConfig()));
  let stopped = false;
  try {
    const db = (await runRemote(connection, "docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();
    assert.ok(db, 'n8n Postgres container must be running');
    const raw = await psql(connection, db, `COPY (SELECT json_build_object(
      'nodesHex', encode(convert_to(nodes::text, 'UTF8'), 'hex'),
      'connectionsHex', encode(convert_to(connections::text, 'UTF8'), 'hex'),
      'activeVersionId', "activeVersionId", 'active', active
    )::text FROM workflow_entity WHERE id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`);
    const entity = JSON.parse(raw.trim());
    const nodes = JSON.parse(Buffer.from(entity.nodesHex, 'hex').toString('utf8'));
    const connections = JSON.parse(Buffer.from(entity.connectionsHex, 'hex').toString('utf8'));
    const before = JSON.stringify(nodes);
    patchWorkflow(nodes);
    const afterFirstPatch = JSON.stringify(nodes);
    patchWorkflow(nodes);
    assert.equal(JSON.stringify(nodes), afterFirstPatch, 'Patch must be idempotent');
    const resolver = validateResolver(nodes);
    const prepare = validatePrepare(nodes);
    const catalog = await validateCatalog(nodes);
    assert.equal(JSON.stringify(prepare.only5g.requestedRamGb), '[]', 'bare 5G must not become RAM');
    assert.equal(resolver.only5g.requestedNetwork, '5g');
    assert.equal(resolver.wifi.requestedNetwork, '');
    assert.equal(resolver.explicitRam.requestedNetwork, '');
    assert.equal(prepare.only5g.requestedNetwork, '5g');
    assert.equal(JSON.stringify(prepare.explicit5gbRam.requestedRamGb), '[5]', 'explicit 5 GB RAM must remain RAM');
    assert.equal(prepare.explicit5gbRam.requestedNetwork, '');
    assert.equal(JSON.stringify(prepare.explicit5gRam.requestedRamGb), '[5]', 'explicit 5 G RAM must remain RAM');
    assert.equal(prepare.explicit5gRam.requestedNetwork, '');
    assert.ok(catalog.filteredConfigurations > 0 && catalog.filteredConfigurations < 27);
    assert.equal(catalog.allOutputsRejectExplicit4g, true);
    assert.ok(catalog.catalogMessageCounts.every((count) => count >= 1 && count <= 3));
    assert.ok(catalog.brandHeadersPerMessage.every((count) => count === 1));
    assert.equal(catalog.lastMessageHasQuestion, true, JSON.stringify(catalog));
    const summary = { apply: APPLY, changed: before !== JSON.stringify(nodes), active: entity.active, activeVersionId: entity.activeVersionId, resolver: {
      only5g: resolver.only5g.requestedNetwork, wifi5ghz: resolver.wifi.requestedNetwork,
    }, prepare: {
      only5g: { requestedNetwork: prepare.only5g.requestedNetwork, requestedRamGb: prepare.only5g.requestedRamGb },
      explicit5gbRam: { requestedNetwork: prepare.explicit5gbRam.requestedNetwork, requestedRamGb: prepare.explicit5gbRam.requestedRamGb },
      combined: { requestedNetwork: prepare.combined.requestedNetwork, requestedStorageGb: prepare.combined.requestedStorageGb },
    }, catalog };
    if (!APPLY) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    const activeExecutions = Number((await psql(connection, db, `COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());
    assert.equal(activeExecutions, 0, 'Workflow has active executions; retry after they finish');
    const backupDir = '/var/backups/mdv-n8n';
    const backupPath = `${backupDir}/${WORKFLOW_ID}-before-v338-${Date.now()}.json`;
    await runRemote(connection, `mkdir -p ${shQuote(backupDir)}`);
    const backup = await psql(connection, db, `COPY (SELECT json_build_object('workflow', row_to_json(we), 'activeHistory', row_to_json(wh))::text FROM workflow_entity we LEFT JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`);
    await new Promise((resolve, reject) => connection.sftp((error, sftp) => {
      if (error) return reject(error);
      sftp.writeFile(backupPath, Buffer.from(backup), (writeError) => { sftp.end(); writeError ? reject(writeError) : resolve(); });
    }));
    await runRemote(connection, 'docker service scale n8n_n8n-runner=0 >/dev/null'); await waitService(connection, 'n8n_n8n-runner', 0);
    await runRemote(connection, 'docker service scale n8n_n8n=0 >/dev/null'); await waitService(connection, 'n8n_n8n', 0); stopped = true;
    const sql = `\\set ON_ERROR_STOP on
BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(nodes), 'nodesv338')}::json, connections=${dollar(JSON.stringify(connections), 'connectionsv338')}::json, "versionId"="activeVersionId", "updatedAt"=NOW() WHERE id=${shQuote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(nodes), 'historynodesv338')}::json, connections=${dollar(JSON.stringify(connections), 'historyconnectionsv338')}::json, "updatedAt"=NOW() WHERE "workflowId"=${shQuote(WORKFLOW_ID)} AND "versionId"=${shQuote(entity.activeVersionId)};
COMMIT;`;
    await psql(connection, db, sql);
    await runRemote(connection, 'docker service scale n8n_n8n=1 >/dev/null'); await waitService(connection, 'n8n_n8n', 1);
    await runRemote(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null'); await waitService(connection, 'n8n_n8n-runner', 1); stopped = false;
    const verification = JSON.parse((await psql(connection, db, `COPY (SELECT json_build_object(
      'active', we.active,
      'versionAligned', we."versionId"=we."activeVersionId",
      'entityHistoryEqual', we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,
      'marker', we.nodes::text LIKE '%${MARKER}%',
      'chunkThree', we.nodes::text LIKE '%const chunkSize = 3;%',
      'oldChunkRemoved', we.nodes::text NOT LIKE '%const chunkSize = 5;%'
    )::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${shQuote(WORKFLOW_ID)}) TO STDOUT;`)).trim());
    console.log(JSON.stringify({ ...summary, verification, backupPath }, null, 2));
  } finally {
    if (stopped) {
      await runRemote(connection, 'docker service scale n8n_n8n=1 >/dev/null').catch(() => {}); await waitService(connection, 'n8n_n8n', 1).catch(() => {});
      await runRemote(connection, 'docker service scale n8n_n8n-runner=1 >/dev/null').catch(() => {}); await waitService(connection, 'n8n_n8n-runner', 1).catch(() => {});
    }
    connection.end();
  }
}

module.exports = { detectPhone5gFilter, hasConfirmed5g, filterRowsBy5g, buildBrandSafeChunks, patchWorkflow, validateResolver, validatePrepare, validateCatalog };
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

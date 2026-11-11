'use strict';

// tablet-catalog-v1 (11/11/2026): pedido de tablet usa a categoria Tablet e a mesma lista dos celulares.
// Caso real: "Vc teria o tablet Xiaomi Redmi Pad 2?" — a marca/modelo forçavam a categoria Smartphones e o bot mandou
// a lista de celulares; depois respondeu que "um atendente pode conferir" os tablets.
//  - "Vendas - Preparar Busca": "tablet/tablete/ipad/Redmi Pad/Mi Pad/Galaxy Tab..." (sem ser capa, película, caneta...)
//    vai para a categoria Tablet (a que tem estoque) e marca tabletCatalogV1.
//  - "Vendas - Contexto Produtos": títulos "Tablets disponiveis agora" / "📱 Tablets com ..." na lista de tablets.
//  - "Vendas - Catalogo pronto?": "quais tablets vocês têm" sai pela lista pronta, como a de celulares.

const MARK = 'tablet-catalog-v1';
const TABLET_CATEGORY_ID = 'fd2b4b01-e8d7-4085-848e-18176aa58a66';
const PHONE_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const NODE_SEARCH = 'Vendas - Preparar Busca';
const NODE_CONTEXT = 'Vendas - Contexto Produtos';
const NODE_READY = 'Vendas - Catalogo pronto?';
const NODES = [NODE_SEARCH, NODE_CONTEXT, NODE_READY];

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}
function all(code, before, after, expected, label) {
  const count = code.split(before).length - 1;
  if (count !== expected) throw new Error(`${label}: esperado ${expected}, achou ${count}`);
  return code.split(before).join(after);
}

function patchSearch(code) {
  if (code.includes(MARK)) return code;
  code = once(code,
    "const productCategoryId = classifiedCategoryId || (isGenericPhoneRequest || forceSmartphoneCategory || genericCheapPhoneRequestV1 ? SMARTPHONES_CATEGORY_ID : '');",
    "// " + MARK + ": tablet tem categoria e lista próprias (mesmo formato dos celulares).\n"
    + "const TABLETS_CATEGORY_ID_V1 = '" + TABLET_CATEGORY_ID + "';\n"
    + "const tabletTextV1 = String(normalized || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');\n"
    + "const tabletAccessoryV1 = /\\b(capa|capas|capinha|pelicula|peliculas|caneta|canetas|teclado|suporte|carregador|cabo|fone|mouse)\\b/.test(tabletTextV1);\n"
    + "const tabletMentionV1 = /\\b(tablet|tablets|tablete|tabletes|ipad|ipads)\\b/.test(tabletTextV1)\n"
    + "  || /\\b(redmi|xiaomi|poco|mi)\\s*pad\\b/.test(tabletTextV1) || /\\bgalaxy\\s*tab\\b/.test(tabletTextV1);\n"
    + "const tabletRequestV1 = tabletMentionV1 && !tabletAccessoryV1;\n"
    + "// Acessório de tablet (capa, película...) não pode cair na lista de celulares: busca pelo texto.\n"
    + "const tabletAccessoryRequestV1 = tabletMentionV1 && tabletAccessoryV1;\n"
    + "const productCategoryId = tabletRequestV1 ? TABLETS_CATEGORY_ID_V1 : (tabletAccessoryRequestV1 ? classifiedCategoryId : (classifiedCategoryId || (isGenericPhoneRequest || forceSmartphoneCategory || genericCheapPhoneRequestV1 ? SMARTPHONES_CATEGORY_ID : '')));\n"
    + "if (tabletRequestV1 && (!specificDeviceModelRequest || productSearchTerm === 'smartphones')) productSearchTerm = 'tablets';\n"
    + "if (tabletAccessoryRequestV1 && productSearchTerm === 'smartphones') productSearchTerm = normalizeProductSearchUnits(classifiedSearchQuery || rawText);",
    'categoria do pedido');
  code = once(code, "    productSearchTerm,\n", "    productSearchTerm,\n    tabletCatalogV1: tabletRequestV1, // " + MARK + "\n", 'saída');
  return code;
}

function patchContext(code) {
  if (code.includes(MARK)) return code;
  code = all(code, "(unavailableRequestedDevice ? 'Celulares disponiveis agora' : '📱 Orçamento')",
    "(unavailableRequestedDevice ? (base.tabletCatalogV1 ? 'Tablets disponiveis agora' : 'Celulares disponiveis agora') : (base.tabletCatalogV1 ? '📱 Tablets disponíveis' : '📱 Orçamento'))", 2, 'título indisponível');
  code = once(code, "const memoryFilterTitleV155 = phoneFilterLabelV228 ? '📱 Celulares com ' + phoneFilterLabelV228 : '';",
    "const memoryFilterTitleV155 = phoneFilterLabelV228 ? (base.tabletCatalogV1 ? '📱 Tablets com ' : '📱 Celulares com ') + phoneFilterLabelV228 : ''; // " + MARK, 'título com filtro');
  return code;
}

function patchReady(parameters) {
  const next = JSON.parse(JSON.stringify(parameters));
  const condition = next.conditions?.conditions?.[0];
  if (!condition || typeof condition.leftValue !== 'string') throw new Error('Condição do catálogo pronto ausente');
  if (condition.leftValue.includes(TABLET_CATEGORY_ID)) return next;
  condition.leftValue = once(condition.leftValue, "$json.productCategoryId === '" + PHONE_CATEGORY_ID + "'",
    "['" + PHONE_CATEGORY_ID + "', '" + TABLET_CATEGORY_ID + "'].includes($json.productCategoryId)", 'condição do catálogo pronto');
  return next;
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const find = (name) => { const node = next.nodes.find((item) => item.name === name); if (!node) throw new Error(`Nó ausente: ${name}`); return node; };
  const search = find(NODE_SEARCH); search.parameters.jsCode = patchSearch(search.parameters.jsCode);
  const context = find(NODE_CONTEXT); context.parameters.jsCode = patchContext(context.parameters.jsCode);
  const ready = find(NODE_READY); ready.parameters = patchReady(ready.parameters);
  return next;
}

module.exports = { MARK, TABLET_CATEGORY_ID, PHONE_CATEGORY_ID, NODES, NODE_SEARCH, NODE_CONTEXT, NODE_READY, patchWorkflow, patchSearch, patchContext };

if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  fs.writeFileSync(output, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(input, 'utf8')))), { mode: 0o600 });
  console.log('candidato gravado em', output);
}

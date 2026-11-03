'use strict';

// Conversa real de 03/11/2026 (cliente perdido):
//  1. "Quais as promoções" virou busca por texto ("quais promocoes") e mandou o orçamento de uma capa.
//  2. "Celulares em conta mais barato" virou busca por texto e nenhuma lista de celulares saiu.
//  3. Com a capa como lista aberta, qualquer escolha/pedido de foto caía em
//     "Essa combinação de memória e cor não está disponível" — a checagem de memória é de celular
//     e descartava o acessório (sem memória), travando a conversa.
// Correção (só em três Code nodes, sem mudar o grafo):
//  - Preparar Busca: pedido genérico de celular barato/em conta e "promoções" sem produto
//    viram lista da categoria Celulares, do mais barato para o mais caro.
//  - Contexto Produtos: nesse pedido, até 8 opções do menor preço, título "Celulares mais em conta".
//  - Verificar Pos Lista: item sem memória (acessório) pula a resolução de memória/cor.

const MARK = 'cheapest-promo-accessory-v1';
const NODES = ['Vendas - Preparar Busca', 'Vendas - Contexto Produtos', 'Vendas - Verificar Pos Lista'];

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

function patchPreparar(code) {
  if (code.includes(MARK)) return code;
  code = once(code,
    "const isGenericPhoneRequest = meaningfulTokens.length > 0\n  && meaningfulTokens.every((token) => genericPhoneWords.has(token));\n",
    "const isGenericPhoneRequest = meaningfulTokens.length > 0\n  && meaningfulTokens.every((token) => genericPhoneWords.has(token));\n"
    + "// " + MARK + ": \"celulares em conta/mais baratos\" e \"quais as promoções\" (sem produto) listam celulares do mais barato.\n"
    + "const priceIntentWordsV1 = new Set(['barato', 'baratos', 'barata', 'baratas', 'baratinho', 'baratinhos', 'conta', 'em', 'mais', 'menor', 'menores',\n"
    + "  'economico', 'economicos', 'acessivel', 'acessiveis', 'simples', 'promocao', 'promocoes', 'promo', 'promos', 'oferta', 'ofertas',\n"
    + "  'liquidacao', 'quais', 'algum', 'alguns', 'opcao', 'opcoes', 'precos', 'custo', 'beneficio', 'me', 'mostra', 'mostrar', 'manda', 'mande', 'ver']);\n"
    + "const cheapIntentV1 = /\\b(?:barat[oa]s?|baratinh[oa]s?|em conta|menor(?:es)? precos?|economic[oa]s?|acessive(?:l|is)|custo beneficio)\\b/.test(normalized);\n"
    + "const promoIntentV1 = /\\b(?:promocao|promocoes|promo|promos|oferta|ofertas|liquidacao)\\b/.test(normalized);\n"
    + "const genericCheapPhoneRequestV1 = (cheapIntentV1 || promoIntentV1) && meaningfulTokens.length > 0\n"
    + "  && meaningfulTokens.every((token) => genericPhoneWords.has(token) || priceIntentWordsV1.has(token))\n"
    + "  && (promoIntentV1 || meaningfulTokens.some((token) => genericPhoneWords.has(token)));\n",
    'Preparar Busca: detector genérico');
  code = once(code,
    ": classifiedSearchQuery || (isGenericPhoneRequest ? 'smartphones' : tokens.join(' ').trim()));",
    ": (genericCheapPhoneRequestV1 ? 'smartphones' : classifiedSearchQuery || (isGenericPhoneRequest ? 'smartphones' : tokens.join(' ').trim())));",
    'Preparar Busca: termo');
  code = once(code,
    "const productCategoryId = classifiedCategoryId || (isGenericPhoneRequest || forceSmartphoneCategory ? SMARTPHONES_CATEGORY_ID : '');",
    "const productCategoryId = classifiedCategoryId || (isGenericPhoneRequest || forceSmartphoneCategory || genericCheapPhoneRequestV1 ? SMARTPHONES_CATEGORY_ID : '');",
    'Preparar Busca: categoria');
  code = once(code,
    "    productSearchKind: classifiedRequestKind || (productCategoryId ? 'categoria' : 'busca'),\n",
    "    productSearchKind: genericCheapPhoneRequestV1 ? 'categoria' : (classifiedRequestKind || (productCategoryId ? 'categoria' : 'busca')),\n"
    + "    salesCheapestFirstV1: genericCheapPhoneRequestV1,\n"
    + "    salesCatalogIntentV1: genericCheapPhoneRequestV1 ? (promoIntentV1 && !cheapIntentV1 ? 'promocao' : 'barato') : '',\n",
    'Preparar Busca: saída');
  return code;
}

function patchContexto(code) {
  if (code.includes(MARK)) return code;
  code = once(code,
    "const productsLimit = isCompleteCategoryRequest || unavailableRequestedDevice ? productsSource.length : 6;",
    "// " + MARK + ": celulares do menor preço primeiro (até 8 opções), sem acessórios.\n"
    + "if (base.salesCheapestFirstV1) {\n"
    + "  const cheapPriceV1 = (product) => toNumber(product?.price_retail ?? product?.priceCents ?? 0) || Number.MAX_SAFE_INTEGER;\n"
    + "  productsSource = [...productsSource]\n"
    + "    .filter((product) => isSmartphoneProduct(product) && !isAccessoryProduct(product))\n"
    + "    .sort((a, b) => cheapPriceV1(a) - cheapPriceV1(b));\n"
    + "}\n"
    + "const productsLimit = base.salesCheapestFirstV1 ? Math.min(productsSource.length, 8) : (isCompleteCategoryRequest || unavailableRequestedDevice ? productsSource.length : 6);",
    'Contexto Produtos: limite');
  code = once(code,
    "const products = mergeQuoteProducts(rawProducts).sort((a, b) => {\n  if (!prefersSmartphones) return 0;",
    "const products = mergeQuoteProducts(rawProducts).sort((a, b) => {\n  if (base.salesCheapestFirstV1) return toNumber(a.priceCents) - toNumber(b.priceCents);\n  if (!prefersSmartphones) return 0;",
    'Contexto Produtos: ordem');
  const title = "catalogTitleV162 || memoryFilterTitleV155 || (unavailableRequestedDevice ? 'Celulares disponiveis agora' : '📱 Orçamento')";
  const count = code.split(title).length - 1;
  if (count !== 2) throw new Error(`Contexto Produtos: título encontrado ${count} vezes`);
  code = code.split(title).join("(base.salesCheapestFirstV1 ? '📱 Celulares mais em conta' : '') || " + title);
  return code;
}

function patchPosLista(code) {
  if (code.includes(MARK)) return code;
  return once(code,
    "let option = rawOptionExactV1;\nif (rawOptionExactV1) {",
    "let option = rawOptionExactV1;\n"
    + "// " + MARK + ": acessório (sem memória em nenhuma configuração) não passa pela escolha de memória/cor de celular.\n"
    + "const optionHasMemoryV1 = Boolean(rawOptionExactV1) && [rawOptionExactV1, ...(rawOptionExactV1.memoryOptions || []), ...(rawOptionExactV1.colors || [])]\n"
    + "  .some((item) => String(item?.memory || '').trim());\n"
    + "if (rawOptionExactV1 && optionHasMemoryV1) {",
    'Verificar Pos Lista: memória');
}

const PATCHES = {
  'Vendas - Preparar Busca': patchPreparar,
  'Vendas - Contexto Produtos': patchContexto,
  'Vendas - Verificar Pos Lista': patchPosLista,
};

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  for (const name of NODES) {
    const node = next.nodes.find((item) => item.name === name);
    if (!node?.parameters?.jsCode) throw new Error(`Code node ausente: ${name}`);
    node.parameters.jsCode = PATCHES[name](node.parameters.jsCode);
  }
  return next;
}

module.exports = { MARK, NODES, patchWorkflow };

if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Uso: node scripts/n8n-cheapest-promo-accessory-fix.cjs antes.json candidato.json');
  fs.writeFileSync(output, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(input, 'utf8')))), { mode: 0o600 });
  console.log('candidato gravado em', output);
}

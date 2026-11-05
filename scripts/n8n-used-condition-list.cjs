'use strict';

// used-condition-list-v1 (04/11/2026): seminovo / usado / caixa aberta no robô de vendas.
// Antes: a lista agrupava por modelo + memória sem olhar a condição — um seminovo do mesmo modelo
// era fundido ao novo e herdava o MAIOR preço do grupo (o do novo). O cliente nunca via o seminovo.
// Correção (só no Code node "Vendas - Contexto Produtos", sem mudar o grafo):
//  - lê specs.condition / specs.condition_note (mesma regra de utils/productCondition.js do sistema);
//  - o nome do item não-novo ganha " (Seminovo)" / " (Usado)" / " (Caixa aberta)" — vale para lista,
//    escolha por número e respostas seguintes (que usam option.name);
//  - a condição entra na chave de configuração: seminovo nunca se funde ao novo nem herda o preço dele;
//  - havendo não-novos, eles vão para o fim da lista (numeração = ordem da lista) e saem numa
//    mensagem própria "♻️ Seminovos | Usados", com a observação na linha 📝. Sem não-novos: idêntico ao atual.

const MARK = 'used-condition-list-v1';
const NODE = 'Vendas - Contexto Produtos';

function once(code, before, after, label) {
  const count = code.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: âncora encontrada ${count} vezes`);
  return code.replace(before, () => after);
}

function patchContexto(code) {
  if (code.includes(MARK)) return code;
  // 1) condição e observação de cada produto (ficha da variação, não do modelo)
  code = once(code,
    "    return {\n      id: product.id,\n      modelId: String(product.model_id || '').trim(),\n      modelName: String(product.model_name || '').replace(/\\s+/g, ' ').trim(),\n      name: String(product.model_name || '').replace(/\\s+/g, ' ').trim() || withoutColorSuffix(product.name, color),\n",
    "    // " + MARK + ": condição da variação (new | seminovo | used | open_box) e observação.\n"
    + "    const conditionRawV1 = String(variationSpecsV2.condition ?? variationSpecsV2.condicao ?? product.condition ?? '').trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[\\s_-]+/g, ' ');\n"
    + "    const conditionV1 = ['seminovo', 'semi novo', 'refurbished', 'recondicionado'].includes(conditionRawV1) ? 'seminovo'\n"
    + "      : ['used', 'usado'].includes(conditionRawV1) ? 'used'\n"
    + "      : ['open box', 'caixa aberta', 'vitrine'].includes(conditionRawV1) ? 'open_box' : 'new';\n"
    + "    const conditionLabelV1 = { seminovo: 'Seminovo', used: 'Usado', open_box: 'Caixa aberta' }[conditionV1] || '';\n"
    + "    const conditionNoteV1 = conditionV1 === 'new' ? '' : cleanTextV1(variationSpecsV2.condition_note, 300);\n"
    + "    return {\n      id: product.id,\n      modelId: String(product.model_id || '').trim(),\n      modelName: String(product.model_name || '').replace(/\\s+/g, ' ').trim(),\n"
    + "      name: (String(product.model_name || '').replace(/\\s+/g, ' ').trim() || withoutColorSuffix(product.name, color)) + (conditionLabelV1 ? ' (' + conditionLabelV1 + ')' : ''),\n"
    + "      condition: conditionV1,\n      conditionLabel: conditionLabelV1,\n      conditionNote: conditionNoteV1,\n",
    'mapeamento do produto');
  // 2) chave de configuração separa a condição
  code = once(code,
    "const quoteConfigurationKeyV2 = (product) => [\n  quoteModelIdentityV2(product),\n  product.ramGb || product.storageGb\n    ? [Number(product.ramGb || 0), Number(product.storageGb || 0)].join('/')\n    : normalizeKey(product.memory),\n].join('|');",
    "const quoteConfigurationKeyV2 = (product) => [\n  quoteModelIdentityV2(product),\n  product.ramGb || product.storageGb\n    ? [Number(product.ramGb || 0), Number(product.storageGb || 0)].join('/')\n    : normalizeKey(product.memory),\n"
    + "  // " + MARK + ": seminovo/usado nunca se funde ao novo nem herda o preço dele.\n"
    + "  ...(product.condition && product.condition !== 'new' ? ['condition:' + product.condition] : []),\n].join('|');",
    'chave de configuração');
  // 3) não-novos no fim da lista (a numeração enviada ao cliente é a ordem desta lista)
  code = once(code,
    "});\nconst availableBrandLabelsV246 = new Set(products.map((product) => quoteBrandGroupV227(product).label));",
    "});\n"
    + "// " + MARK + ": ordem = novos (e demais), depois seminovos/usados, depois acessórios — só quando há não-novos.\n"
    + "const isUsedQuoteProductV1 = (product) => Boolean(product && product.condition && product.condition !== 'new') && !isQuoteAccessoryProduct(product);\n"
    + "const usedQuoteRankV1 = (product) => isQuoteAccessoryProduct(product) ? 2 : (isUsedQuoteProductV1(product) ? 1 : 0);\n"
    + "if (products.some(isUsedQuoteProductV1)) {\n"
    + "  const rankedV1 = products.map((product, index) => ({ product, index, rank: usedQuoteRankV1(product) }))\n"
    + "    .sort((a, b) => a.rank - b.rank || a.index - b.index);\n"
    + "  rankedV1.forEach((entry, index) => { products[index] = entry.product; });\n"
    + "}\n"
    + "const availableBrandLabelsV246 = new Set(products.map((product) => quoteBrandGroupV227(product).label));",
    'ordem da lista');
  // 4) observação na lista
  code = once(code,
    "    const featureSummaryV365 = buildFeatureSummaryV365(product);\n    if (featureSummaryV365) chunkLines.push('   ' + featureSummaryV365);\n",
    "    const featureSummaryV365 = buildFeatureSummaryV365(product);\n    if (featureSummaryV365) chunkLines.push('   ' + featureSummaryV365);\n"
    + "    if (product.conditionNote) chunkLines.push('   📝 ' + product.conditionNote); // " + MARK + "\n",
    'observação na lista');
  // 5) mensagem separada "Seminovos | Usados"
  code = once(code,
    "const buildQuoteMessages = () => {\n  if (products.length === 0) return [quoteLines.join('[[BR]]')];\n",
    "const buildQuoteMessages = () => {\n  if (products.length === 0) return [quoteLines.join('[[BR]]')];\n"
    + "  // " + MARK + ": novos como hoje; seminovos/usados em mensagem própria, numeração contínua.\n"
    + "  if (products.some(isUsedQuoteProductV1)) {\n"
    + "    const newV1 = products.filter((product) => usedQuoteRankV1(product) === 0);\n"
    + "    const usedV1 = products.filter((product) => usedQuoteRankV1(product) === 1);\n"
    + "    const accessoriesV1 = products.filter((product) => usedQuoteRankV1(product) === 2);\n"
    + "    const usedMessages = [\n"
    + "      ...buildChunkedQuoteMessages(newV1, 0, true, false, ''),\n"
    + "      ...buildChunkedQuoteMessages(usedV1, newV1.length, newV1.length === 0, false, '♻️ *Seminovos | Usados*'),\n"
    + "      ...(accessoriesV1.length ? buildChunkedQuoteMessages(accessoriesV1, newV1.length + usedV1.length, false, false, 'Temos tambem esses acessorios para esse modelo:') : []),\n"
    + "    ];\n"
    + "    if (products.length > 1) usedMessages.push(base.photoCatalogRequestedV1 === true\n"
    + "      ? 'De qual modelo você quer ver fotos? Pode me dizer o número ou o nome. 😊'\n"
    + "      : 'Qual modelo voce quer ver em mais detalhes? 😊');\n"
    + "    return usedMessages;\n"
    + "  }\n",
    'mensagens');
  // 6) opções guardadas para a resposta do cliente
  code = once(code,
    "        featureSummary: buildFeatureSummaryV365(product),\n",
    "        featureSummary: buildFeatureSummaryV365(product),\n        condition: product.condition || 'new',\n        conditionNote: product.conditionNote || '',\n",
    'opções');
  return code;
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((item) => item.name === NODE);
  if (!node?.parameters?.jsCode) throw new Error(`Code node ausente: ${NODE}`);
  node.parameters.jsCode = patchContexto(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODE, patchWorkflow, patchContexto };

if (require.main === module) {
  const fs = require('node:fs');
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Uso: node scripts/n8n-used-condition-list.cjs antes.json candidato.json');
  fs.writeFileSync(output, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(input, 'utf8')))), { mode: 0o600 });
  console.log('candidato gravado em', output);
}

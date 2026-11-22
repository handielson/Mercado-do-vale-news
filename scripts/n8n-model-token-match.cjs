'use strict';

// model-token-match-v1 (nó "Vendas - Contexto Produtos"), caso 557488087672 (22/11 16h43):
// "Queria saber o valor do redimi 80s e o 60x" → "Nao encontrei esse modelo" + lista inteira,
// mas o Realme Note 80S tinha 4 unidades. A busca exige o nome inteiro (marca errada "redimi" derruba tudo).
// Agora, se nada bate pelo nome inteiro, procura pelo código do modelo (80s, 60x, c71, 15c, a5, x8…) entre os celulares;
// achando, mostra esses e diz quais códigos pedidos não tem.
const MARK = 'model-token-match-v1';
const NODE = 'Vendas - Contexto Produtos';
const NODES = [NODE];

function once(text, search, replacement, label) {
  const count = text.split(search).length - 1;
  if (count !== 1) throw new Error(`${MARK}: trecho "${label}" encontrado ${count}x`);
  return text.replace(search, () => replacement);
}

const OLD = `const matchingRequestedModelProducts = requestedDeviceModelQuery
  ? primaryDeviceProducts.filter((product) => productMatchesRequestedModel(product))
  : [];`;
const NEW = `const matchingRequestedModelProductsByNameV1 = requestedDeviceModelQuery
  ? primaryDeviceProducts.filter((product) => productMatchesRequestedModel(product))
  : [];
// ${MARK}: nome inteiro não bateu (ex.: "redimi 80s e 60x") → procura pelo código do modelo entre os celulares.
const modelTokenNormV1 = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const modelTokensV1 = [...new Set(modelTokenNormV1(requestedDeviceModelQuery).split(/[^a-z0-9]+/)
  .filter((t) => /^(?:[a-z]{1,2}\\d{1,3}[a-z]{0,3}|\\d{2,3}[a-z]{1,3})$/.test(t) && !/^\\d+(?:gb|tb|mp|mah|hz|w|g)$/.test(t)))];
const modelTokenWordsV1 = (product) => modelTokenNormV1(withoutColorSuffix(product.name, getColor(product))).split(/[^a-z0-9]+/);
const modelTokenMatchesV1 = matchingRequestedModelProductsByNameV1.length || !modelTokensV1.length ? [] : primaryDeviceProducts.filter((product) =>
  toNumber(product.stock_quantity ?? product.stock ?? 1) > 0 && modelTokensV1.some((t) => modelTokenWordsV1(product).includes(t)));
const modelTokensMissingV1 = modelTokenMatchesV1.length ? modelTokensV1.filter((t) => !modelTokenMatchesV1.some((p) => modelTokenWordsV1(p).includes(t))) : [];
const matchingRequestedModelProducts = matchingRequestedModelProductsByNameV1.length ? matchingRequestedModelProductsByNameV1 : modelTokenMatchesV1;`;

const OLD_OUT = '    deterministicCatalogOutput: deterministicCatalogOutputV322,';
const NEW_OUT = `    // ${MARK}: diz quais códigos pedidos não tem (antes da pergunta final).
    deterministicCatalogOutput: (() => {
      const text = deterministicCatalogOutputV322;
      if (!text || !modelTokensMissingV1.length) return text;
      const names = modelTokensMissingV1.map((t) => t.toUpperCase());
      const line = (names.length === 1 ? 'O ' + names[0] : 'Os ' + names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1]) + ' não temos em estoque no momento.';
      const parts = String(text).split('[[BR]]');
      const last = parts[parts.length - 1];
      if (/\\?\\s*(?:\\p{Extended_Pictographic}\\s*)*$/u.test(last) && parts.length > 1) parts.splice(parts.length - 1, 0, line);
      else parts.push(line);
      return parts.join('[[BR]]');
    })(),`;

function patchContexto(code) {
  if (code.includes(MARK)) return code;
  return once(once(code, OLD, NEW, 'matchingRequestedModelProducts'), OLD_OUT, NEW_OUT, 'deterministicCatalogOutput');
}

function patchWorkflow(workflow) {
  const next = JSON.parse(JSON.stringify(workflow));
  const node = next.nodes.find((n) => n.name === NODE);
  node.parameters.jsCode = patchContexto(node.parameters.jsCode);
  return next;
}

module.exports = { MARK, NODE, NODES, patchWorkflow, patchContexto };

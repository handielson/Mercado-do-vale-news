'use strict';

const assert = require('node:assert/strict');

const MARK = 'sales-list-nfc-v1';
const NODE = 'Vendas - Contexto Produtos';

function insertBefore(code, anchor, addition) {
  assert.equal(code.split(anchor).length - 1, 1, 'Âncora alterada: ' + anchor);
  return code.replace(anchor, () => addition + '\n' + anchor);
}

function patchWorkflow(workflow) {
  const result = structuredClone(workflow);
  const nodes = result.nodes.filter(node => node.name === NODE);
  assert.equal(nodes.length, 1, 'Nó de contexto ausente ou duplicado');
  const params = nodes[0].parameters;
  let code = params.jsCode;
  if (code.includes(MARK)) return result;

  code = insertBefore(code, "      category: product.category_name || product.categoryName || product.category_slug || '',", [
    '      // ' + MARK + ': use a ficha do modelo, com fallback para o cadastro da variante.',
    '      catalogNfcV1: isSmartphoneProduct(product) && !isAccessoryProduct(product)',
    '        ? normalizeNfcValueV228(String(modelSpecsV2.nfc ?? variationSpecsV2.nfc ?? product?.custom_fields?.nfc ?? ""))',
    '        : "",',
  ].join('\n'));
  code = insertBefore(code, '  existing.stock += toNumber(product.stock);\n  existing.productIds.push(product.id);',
    '  if (existing.catalogNfcV1 !== product.catalogNfcV1) existing.catalogNfcV1 = "";');
  code = insertBefore(code, 'if (products.length > 0) {\n  quoteLines.push(',
    'const catalogNfcLineV1 = product => ({ sim: "NFC: Sim", nao: "NFC: Não" })[product.catalogNfcV1] || "";');
  for (const [pad, list, item] of [
    ['    ', 'quoteLines', 'product'],
    ['        ', 'chunkLines', 'option'],
    ['      ', 'chunkLines', 'product'],
  ]) {
    const spacing = item === 'option' ? '      ' : '   ';
    const anchor = pad + "if (" + item + ".colors?.length) " + list + ".push('" + spacing + "🎨 Cores: ' + " + item + ".colors.join(', '));";
    code = insertBefore(code, anchor,
      pad + 'if (catalogNfcLineV1(' + item + ')) ' + list + '.push("' + spacing + '" + catalogNfcLineV1(' + item + '));');
  }
  new Function(code);
  params.jsCode = code;
  return result;
}

module.exports = { MARK, NODE, patchWorkflow };

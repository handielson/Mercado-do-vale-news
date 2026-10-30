'use strict';

const assert = require('node:assert/strict');

const MARKER = 'meta-catalog-intent-parity-v1';
const NODE = 'Vendas - Preparar Busca';

function patchWorkflow(workflow) {
  const candidate = structuredClone(workflow);
  const node = candidate.nodes.find(item => item.name === NODE);
  assert.ok(node?.parameters?.jsCode, `${NODE} ausente`);
  if (node.parameters.jsCode.includes(MARKER)) return candidate;
  const before = 'const specificDeviceModelRequest = Boolean(';
  const after = `// ${MARKER}: aceitar a lista ou pedir promoções de uma marca não pede modelo específico.
const genericCatalogAcceptanceV1 = /\\b(?:promocoes?|ofertas?|lista|catalogo)\\b/.test(normalized)
  && !/\\b(?:xiaomi|redmi|poco|samsung|galaxy|motorola|moto|realme|iphone|apple|infinix)\\b[^\\n]{0,30}\\b[a-z]*\\d{1,4}\\b/.test(normalized);
const specificDeviceModelRequest = !genericCatalogAcceptanceV1 && Boolean(`;
  assert.equal(node.parameters.jsCode.split(before).length - 1, 1, `${NODE}: trecho inesperado`);
  node.parameters.jsCode = node.parameters.jsCode.replace(before, after);
  return candidate;
}

module.exports = { patchWorkflow, MARKER, NODE };

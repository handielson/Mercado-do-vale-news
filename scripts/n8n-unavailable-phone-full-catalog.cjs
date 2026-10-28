'use strict';

const assert = require('node:assert/strict');

const MARKER = 'unavailable-phone-full-catalog-v1';
const NODES = ['Vendas - Preparar Busca', 'Vendas - Contexto Produtos'];

function replaceOnce(source, before, after, nodeName) {
  const first = source.indexOf(before);
  assert.ok(first >= 0, `${nodeName}: trecho de origem não encontrado`);
  assert.equal(source.indexOf(before, first + before.length), -1, `${nodeName}: trecho de origem duplicado`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function patchWorkflow(workflow) {
  const candidate = structuredClone(workflow);
  const search = candidate.nodes.find(node => node.name === NODES[0]);
  const catalog = candidate.nodes.find(node => node.name === NODES[1]);
  assert.ok(search?.parameters?.jsCode && catalog?.parameters?.jsCode, 'Nós de catálogo não encontrados');
  const alreadyPatched = NODES.map(name => candidate.nodes.find(node => node.name === name).parameters.jsCode.includes(MARKER));
  assert.equal(alreadyPatched[0], alreadyPatched[1], 'Patch parcial detectado');
  if (alreadyPatched[0]) return candidate;

  search.parameters.jsCode = replaceOnce(search.parameters.jsCode,
    `const requestedDeviceModelQuery = specificDeviceModelRequest\n  ? String(implicitAlphanumericPhoneModelRequestV1 ? modelTokens.join(' ') : (classifiedSearchQuery || tokens.join(' '))).trim()\n  : '';`,
    `// ${MARKER}: a pergunta antes do nome não integra a identidade do aparelho.\nconst requestedDeviceModelTextV1 = normalize(implicitAlphanumericPhoneModelRequestV1 ? modelTokens.join(' ') : (classifiedSearchQuery || tokens.join(' ')));\nconst requestedDeviceModelStartV1 = requestedDeviceModelTextV1.match(/\\b(?:xiaomi|redmi|poco|samsung|galaxy|motorola|moto|realme|iphone|infinix|note)\\b/);\nconst requestedDeviceModelQuery = specificDeviceModelRequest\n  ? (requestedDeviceModelStartV1 ? requestedDeviceModelTextV1.slice(requestedDeviceModelStartV1.index) : requestedDeviceModelTextV1)\n  : '';`, NODES[0]);

  let code = catalog.parameters.jsCode;
  code = replaceOnce(code,
    `const sameRequestedModelV1=product=>matchesRequestedModelIdentityV1({...product,name:withoutColorSuffix(product.name,getColor(product))},base.requestedDeviceModelQuery,base.requestedNetwork,base.requestedDeviceBrand,base.requestedDeviceFamily);`,
    `const sameRequestedModelV1=product=>matchesRequestedModelIdentityV1({...product,name:withoutColorSuffix(product.name,getColor(product))},base.requestedDeviceModelQuery,base.requestedNetwork,base.requestedDeviceBrand,base.requestedDeviceFamily);\n// ${MARKER}: se o modelo pedido não tem unidade disponível, a lista volta ao catálogo completo.\nconst unavailableSpecificModelRawV1 = Boolean(String(base.requestedDeviceModelQuery || '').trim()\n  && !rows.some(product => toNumber(product?.stock_quantity) > 0 && String(product?.status || 'active') === 'active' && sameRequestedModelV1(product)));`, NODES[1]);
  code = replaceOnce(code,
    `const phoneMemoryFilterRequestV155 = base.phoneMemoryFilterRequest === true && (requestedRamGbV155.length > 0 || requestedStorageGbV155.length > 0);`,
    `const phoneMemoryFilterRequestV155 = !unavailableSpecificModelRawV1 && base.phoneMemoryFilterRequest === true && (requestedRamGbV155.length > 0 || requestedStorageGbV155.length > 0);`, NODES[1]);
  code = replaceOnce(code,
    `const phoneNfcFilterRequestV228 = base.phoneNfcFilterRequest === true && requestedNfcV228 === 'sim';`,
    `const phoneNfcFilterRequestV228 = !unavailableSpecificModelRawV1 && base.phoneNfcFilterRequest === true && requestedNfcV228 === 'sim';`, NODES[1]);
  code = replaceOnce(code,
    `const phone5gFilterRequestV338 = base.phone5gFilterRequest === true && requestedNetworkV338 === '5g';`,
    `const phone5gFilterRequestV338 = !unavailableSpecificModelRawV1 && base.phone5gFilterRequest === true && requestedNetworkV338 === '5g';`, NODES[1]);
  for (const [before, after] of [
    [`const maxPriceCentsV288 = Number(base.maxPriceCents || base.salesFilters?.maxPriceCents || 0);`, `const maxPriceCentsV288 = unavailableSpecificModelRawV1 ? 0 : Number(base.maxPriceCents || base.salesFilters?.maxPriceCents || 0);`],
    [`const cameraPriorityV288 = base.cameraPriority === true || base.salesFilters?.cameraPriority === true || base.salesFilters?.cameraQuality === 'good';`, `const cameraPriorityV288 = !unavailableSpecificModelRawV1 && (base.cameraPriority === true || base.salesFilters?.cameraPriority === true || base.salesFilters?.cameraQuality === 'good');`],
    [`const cameraMinMpxV288 = Number(base.cameraMinMpx || base.salesFilters?.cameraMinMpx || base.salesFilters?.cameraMinMp || 0);`, `const cameraMinMpxV288 = unavailableSpecificModelRawV1 ? 0 : Number(base.cameraMinMpx || base.salesFilters?.cameraMinMpx || base.salesFilters?.cameraMinMp || 0);`],
    [`const screenPriorityV288 = base.screenPriority === true || base.salesFilters?.screenPriority === true || base.salesFilters?.screenQuality === 'good';`, `const screenPriorityV288 = !unavailableSpecificModelRawV1 && (base.screenPriority === true || base.salesFilters?.screenPriority === true || base.salesFilters?.screenQuality === 'good');`],
    [`const screenTypeV288 = normalizeStructuredV288(base.screenType || base.salesFilters?.screenType || '');`, `const screenTypeV288 = unavailableSpecificModelRawV1 ? '' : normalizeStructuredV288(base.screenType || base.salesFilters?.screenType || '');`],
    [`const screenMinHzV288 = Number(base.screenMinHz || base.salesFilters?.screenMinHz || base.salesFilters?.refreshRateMinHz || 0);`, `const screenMinHzV288 = unavailableSpecificModelRawV1 ? 0 : Number(base.screenMinHz || base.salesFilters?.screenMinHz || base.salesFilters?.refreshRateMinHz || 0);`],
    [`network: requestedNetworkV338,`, `network: unavailableRequestedDevice ? '' : requestedNetworkV338,`],
    [`nfc: requestedNfcV228,`, `nfc: unavailableRequestedDevice ? '' : requestedNfcV228,`],
    [`ramGb: requestedRamGbV155,`, `ramGb: unavailableRequestedDevice ? [] : requestedRamGbV155,`],
    [`storageGb: requestedStorageGbV155,`, `storageGb: unavailableRequestedDevice ? [] : requestedStorageGbV155,`],
  ]) code = replaceOnce(code, before, after, NODES[1]);
  code = replaceOnce(code,
    `? (matchingRequestedModelProducts.length > 0 ? matchingRequestedModelProducts : (sameModelConfigurationAlternativeV1?sameModelProductsV1:primaryDeviceProducts))\n  : (requestedDeviceBrand\n    ? (matchingRequestedBrandProducts.length > 0 ? matchingRequestedBrandProducts : primaryDeviceProducts)\n    : sortedProducts);`,
    `? (matchingRequestedModelProducts.length > 0 ? matchingRequestedModelProducts : (sameModelConfigurationAlternativeV1?sameModelProductsV1:sortedProducts))\n  : (requestedDeviceBrand\n    ? (matchingRequestedBrandProducts.length > 0 ? matchingRequestedBrandProducts : sortedProducts)\n    : sortedProducts);`, NODES[1]);
  catalog.parameters.jsCode = code;
  return candidate;
}

module.exports = { patchWorkflow, MARKER, NODES };

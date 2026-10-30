'use strict';

// Preserve additive brand requests when a Meta customer confirms a promotions list.
// The existing catalog formatter remains the sole owner of prices and message layout.
const assert = require('node:assert/strict');
const fs = require('node:fs');

const MARKER = 'meta-multibrand-promotions-v1';
const NODES = ['Vendas - Preparar Busca', 'Vendas - Contexto Produtos'];

function replaceOnce(code, before, after) {
  assert.equal(code.split(before).length - 1, 1, 'Expected one occurrence: ' + before.slice(0, 90));
  return code.replace(before, after);
}

function patchWorkflow(input) {
  assert.ok(Array.isArray(input?.nodes) && input.connections, 'Workflow snapshot required');
  const workflow = structuredClone(input);
  const node = name => {
    const found = workflow.nodes.find(item => item.name === name);
    assert.ok(found?.parameters?.jsCode, 'Missing Code node: ' + name);
    return found;
  };
  if (NODES.every(name => node(name).parameters.jsCode.includes(MARKER))) return workflow;
  assert.ok(NODES.every(name => !node(name).parameters.jsCode.includes(MARKER)), 'Partial multibrand patch');

  const prepare = node(NODES[0]);
  let code = prepare.parameters.jsCode;
  code = replaceOnce(code,
    "const requestedDeviceBrand = String(source.requestedDeviceBrand || detectDeviceBrand([rawText, classifiedSearchQuery].filter(Boolean).join(' '))).trim();",
    `const requestedDeviceBrand = String(source.requestedDeviceBrand || detectDeviceBrand([rawText, classifiedSearchQuery].filter(Boolean).join(' '))).trim();
// ${MARKER}: a generic Meta confirmation retains recent additive POCO and Realme requests.
// Apply only to a new promotions list, never to a named-model search or an old conversation.
const requestedDeviceFamiliesMetaV1 = (() => {
  if (!source.metaAttendance || !/^sim\\b/.test(normalized) || !/\\b(?:promocoes|promocao|ofertas?)\\b/.test(normalized)) return [];
  const rows = Array.isArray(source.recentMessages) ? source.recentMessages : [];
  const currentIndex = rows.findLastIndex(row => row?.direction === 'inbound' && normalize(row?.text) === normalized);
  const previous = rows.slice(0, currentIndex >= 0 ? currentIndex : rows.length)
    .filter(row => row?.direction === 'inbound').slice(-6);
  // Compare the same clock used for the preceding rows (Meta inbox receipt time).
  const currentAt = Date.parse(String(rows[currentIndex]?.created_at || source.messageTimestamp || ''));
  if (!Number.isFinite(currentAt)) return [];
  const recent = previous.filter(row => {
    const at = Date.parse(String(row?.created_at || ''));
    return Number.isFinite(at) && at <= currentAt && currentAt - at <= 10 * 60 * 1000;
  });
  const seed = recent.findIndex(row => /\\b(?:promocoes|promocao|ofertas?)\\b/.test(normalize(row?.text))
    && /\\b(?:poco|realme)\\b/.test(normalize(row?.text)));
  if (seed < 0) return [];
  const families = [];
  for (const row of recent.slice(seed)) {
    const words = normalize(row?.text);
    for (const family of ['poco', 'realme']) {
      if (new RegExp('\\\\b' + family + '\\\\b').test(words)
        && !new RegExp('\\\\b(?:sem|nao|exceto)\\\\s+(?:o\\\\s+|a\\\\s+)?' + family + '\\\\b').test(words)
        && !families.includes(family)) families.push(family);
    }
  }
  return families.length >= 2 ? families : [];
})();`);
  code = replaceOnce(code,
    'const specificDeviceModelRequest = Boolean(\n  (requestedDeviceBrand',
    'const specificDeviceModelRequest = Boolean(\n  !requestedDeviceFamiliesMetaV1.length && ((requestedDeviceBrand');
  code = replaceOnce(code,
    '  || implicitAlphanumericPhoneModelRequestV1\n);',
    '  || implicitAlphanumericPhoneModelRequestV1)\n);');
  code = replaceOnce(code,
    '    requestedDeviceBrand,\n    requestedDeviceFamily:',
    '    requestedDeviceBrand,\n    requestedDeviceFamiliesMetaV1,\n    requestedDeviceFamily:');
  prepare.parameters.jsCode = code;

  const context = node(NODES[1]);
  code = context.parameters.jsCode;
  code = replaceOnce(code,
    "const requestedDeviceBrand = String(base.requestedDeviceBrand || '').trim();",
    `const requestedDeviceBrand = String(base.requestedDeviceBrand || '').trim();
// ${MARKER}: filter the existing verified catalog by the two requested families.
const requestedDeviceFamiliesMetaV1 = base.metaAttendance && Array.isArray(base.requestedDeviceFamiliesMetaV1)
  ? base.requestedDeviceFamiliesMetaV1.filter(family => ['poco', 'realme'].includes(family)) : [];`);
  code = replaceOnce(code,
    "const productMatchesRequestedBrand = (product) => {\n  if (!requestedDeviceBrand) return false;",
    `const productMatchesRequestedBrand = (product) => {
  if (requestedDeviceFamiliesMetaV1.length) {
    const name = normalize([product.name, product.originalName].filter(Boolean).join(' '));
    const brand = normalize(product.brand);
    return requestedDeviceFamiliesMetaV1.some(family =>
      family === 'poco' ? /\\bpoco\\b/.test(name) : /\\brealme\\b/.test(name) || /\\brealme\\b/.test(brand));
  }
  if (!requestedDeviceBrand) return false;`);
  code = replaceOnce(code,
    'const matchingRequestedBrandProducts = requestedDeviceBrand\n',
    'const matchingRequestedBrandProducts = (requestedDeviceBrand || requestedDeviceFamiliesMetaV1.length)\n');
  code = replaceOnce(code,
    'const unavailableRequestedBrand = Boolean(!requestedDeviceModelQuery && requestedDeviceBrand && matchingRequestedBrandProducts.length === 0);',
    'const unavailableRequestedBrand = Boolean(!requestedDeviceModelQuery && (requestedDeviceBrand || requestedDeviceFamiliesMetaV1.length) && matchingRequestedBrandProducts.length === 0);');
  code = replaceOnce(code,
    '  : (requestedDeviceBrand\n',
    '  : ((requestedDeviceBrand || requestedDeviceFamiliesMetaV1.length)\n');
  context.parameters.jsCode = code;

  for (const name of NODES) new Function('$json', '$input', '$', '$getWorkflowStaticData', node(name).parameters.jsCode);
  return workflow;
}

module.exports = { patchWorkflow, MARKER, NODES };
if (require.main === module) {
  const [sourcePath, destinationPath] = process.argv.slice(2);
  assert.ok(sourcePath && destinationPath, 'Usage: node script source.private.json destination.private.json');
  assert.ok(destinationPath.includes('.local'), 'Private candidate must stay in .local');
  fs.writeFileSync(destinationPath, JSON.stringify(patchWorkflow(JSON.parse(fs.readFileSync(sourcePath, 'utf8'))), null, 2), {flag:'wx',mode:0o600});
  console.log('Created ' + destinationPath);
}

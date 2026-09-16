const assert = require('assert');
const { patchWorkflow, summarize } = require('./n8n-catalog-direct-response.cjs');

const nodes = [
  {
    name: 'Vendas - Preparar Busca',
    parameters: {
      jsCode: `
const broadBrandOnlyRequest = Boolean(requestedDeviceBrand)
  && !specificDeviceModelRequest
  && tokens.length === 1
  && tokens[0] !== 'iphone'
  && !explicitPhoneDeviceRequest
  && !classifiedCategoryId;
const forceSmartphoneCategory = Boolean(
  source.deviceClarificationConfirmed
  || (requestedDeviceBrand && explicitPhoneDeviceRequest)
  || specificDeviceModelRequest
);
return [{ json: { broadBrandOnlyRequest, forceSmartphoneCategory } }];`,
    },
  },
  {
    name: 'Vendas - Compor Resposta IA',
    parameters: {
      jsCode: `
const structuredCatalogOnlyV365 = source.structuredPhoneComparison === true && Boolean(catalogOutput);
return [{ json: {
  output: structuredCatalogOnlyV365 ? catalogOutput : [aiOutput, catalogOutput].filter(Boolean).join('[[MSG]]'),
} }];`,
    },
  },
];

patchWorkflow(nodes);
const summary = summarize(nodes);
assert.ok(Object.values(summary).every(Boolean), JSON.stringify(summary));

const prepare = nodes[0].parameters.jsCode;
assert.match(prepare, /const broadBrandOnlyRequest = false;/);
assert.match(prepare, /\|\| Boolean\(requestedDeviceBrand\)/);
assert.doesNotMatch(prepare, /tokens\.length === 1/);

const composer = nodes[1].parameters.jsCode;
assert.match(composer, /const catalogReadyV366 = Boolean\(catalogOutput\);/);
assert.match(composer, /output: catalogReadyV366 \? catalogOutput : aiOutput,/);
assert.doesNotMatch(composer, /\[aiOutput, catalogOutput\]/);

patchWorkflow(nodes);
assert.ok(Object.values(summarize(nodes)).every(Boolean));

console.log('n8n catalog direct response regression: ok');

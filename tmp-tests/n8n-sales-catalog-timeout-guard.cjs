'use strict';

const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');

const MARKER = 'sales-catalog-timeout-guard-v1';
const SOURCE = 'Vendas - Contexto Produtos';
const GATE = 'Vendas - Catalogo pronto?';
const DIRECT = 'Vendas - Catalogo sem IA';
const AGENT = 'Especialista - Vendas';
const NEXT = 'Vendas - Precisa Handoff?';

const DIRECT_CODE = `// ${MARKER}: lista oficial pronta deve seguir sem aguardar o modelo.
const source = $json || {};
const catalog = String(source.deterministicCatalogOutput || '').trim();
if (source.salesAvailabilityStatus !== 'confirmed_products_available' || !catalog) {
  throw new Error('Catalogo direto sem consulta confirmada');
}
const parts = catalog.split('[[MSG]]').filter(Boolean);
const desired = parts.length > 3 ? 3 : parts.length;
const groups = [];
for (let i = 0; i < desired; i++) {
  const from = Math.floor(i * parts.length / desired);
  const until = Math.floor((i + 1) * parts.length / desired);
  groups.push(parts.slice(from, until).join('[[BR]][[BR]]'));
}
const bounded = groups.every(part => part.length <= 3300);
const body = (bounded ? groups : parts).join('[[MSG]]');
const intro = 'Segue a lista atualizada de celulares disponíveis. 📱[[BR]][[BR]]';
return [{ json: { ...source, output: intro + body, requiresSpecialistHandoff: false } }];`;

function hasDirectCatalog(source) {
  return source?.productSearchKind === 'categoria'
    && source?.productCategoryId === '8b7c4852-c195-4527-8fd7-c3cc2debda42'
    && source?.salesAvailabilityStatus === 'confirmed_products_available'
    && source?.requiresSpecialistHandoff !== true
    && source?.specificDeviceModelRequest !== true
    && source?.structuredPhoneComparison !== true
    && Boolean(String(source?.deterministicCatalogOutput || '').trim());
}

function patchWorkflow(workflow) {
  assert.ok(Array.isArray(workflow.nodes) && workflow.connections);
  const source = workflow.nodes.find(n => n.name === SOURCE);
  const agent = workflow.nodes.find(n => n.name === AGENT);
  const next = workflow.nodes.find(n => n.name === NEXT);
  assert.ok(source && agent && next, 'Sales chain missing');
  const current = workflow.connections[SOURCE]?.main?.[0];
  if (workflow.nodes.some(n => n.name === GATE || n.name === DIRECT)) {
    validate(workflow);
    return {changed:false};
  }
  assert.deepEqual(current, [{node:AGENT,type:'main',index:0}], 'Unexpected sales path');
  const gate = {
    parameters:{options:{},conditions:{options:{version:2,leftValue:'',caseSensitive:true,typeValidation:'strict'},combinator:'and',conditions:[{
      id:randomUUID(),operator:{type:'boolean',operation:'true',singleValue:true},
      leftValue:"={{$json.productSearchKind === 'categoria' && $json.productCategoryId === '8b7c4852-c195-4527-8fd7-c3cc2debda42' && $json.salesAvailabilityStatus === 'confirmed_products_available' && $json.requiresSpecialistHandoff !== true && $json.specificDeviceModelRequest !== true && $json.structuredPhoneComparison !== true && Boolean(String($json.deterministicCatalogOutput || '').trim())}}",
      rightValue:true,
    }]}},
    id:randomUUID(),name:GATE,type:'n8n-nodes-base.if',typeVersion:2.2,
    position:[source.position[0]+260,source.position[1]+180],
  };
  const direct = {
    parameters:{jsCode:DIRECT_CODE},id:randomUUID(),name:DIRECT,type:'n8n-nodes-base.code',typeVersion:2,
    position:[source.position[0]+520,source.position[1]+260],
  };
  workflow.nodes.push(gate,direct);
  workflow.connections[SOURCE].main[0]=[{node:GATE,type:'main',index:0}];
  workflow.connections[GATE]={main:[[{node:DIRECT,type:'main',index:0}],[{node:AGENT,type:'main',index:0}]]};
  workflow.connections[DIRECT]={main:[[{node:NEXT,type:'main',index:0}]]};
  validate(workflow);
  return {changed:true};
}

function validate(workflow) {
  const gate=workflow.nodes.find(n=>n.name===GATE),direct=workflow.nodes.find(n=>n.name===DIRECT);
  assert.ok(gate && direct);
  assert.equal(gate.type,'n8n-nodes-base.if');
  assert.equal(direct.type,'n8n-nodes-base.code');
  assert.ok(direct.parameters.jsCode.includes(MARKER));
  assert.deepEqual(workflow.connections[SOURCE].main[0],[{node:GATE,type:'main',index:0}]);
  assert.deepEqual(workflow.connections[GATE].main,[[{node:DIRECT,type:'main',index:0}],[{node:AGENT,type:'main',index:0}]]);
  assert.deepEqual(workflow.connections[DIRECT].main[0],[{node:NEXT,type:'main',index:0}]);
  assert.deepEqual(workflow.connections[AGENT].main[0],[{node:'Vendas - Compor Resposta IA',type:'main',index:0}]);
}

module.exports={MARKER,SOURCE,GATE,DIRECT,AGENT,NEXT,DIRECT_CODE,hasDirectCatalog,patchWorkflow,validate};

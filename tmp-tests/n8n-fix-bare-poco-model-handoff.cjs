const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { Client } = require('ssh2');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const SMARTPHONES_CATEGORY_ID = '8b7c4852-c195-4527-8fd7-c3cc2debda42';
const APPLY = process.argv.includes('--apply');
const MARKER = 'bare-poco-model-no-handoff-v412';
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
function dollar(value, tag) { if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`); return `$${tag}$${value}$${tag}$`; }
function run(conn, command) { return new Promise((resolve, reject) => conn.exec(command, (error, stream) => { if (error) return reject(error); let out=''; let err=''; stream.on('data',(c)=>{out+=c;}); stream.stderr.on('data',(c)=>{err+=c;}); stream.on('close',(code)=>code===0?resolve(out):reject(new Error(err||out||`remote ${code}`))); })); }
function psql(conn, db, sql) { return new Promise((resolve,reject)=>conn.exec(`docker exec -i ${quote(db)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`,(error,stream)=>{if(error)return reject(error);let out='';let err='';stream.on('data',(c)=>{out+=c;});stream.stderr.on('data',(c)=>{err+=c;});stream.on('close',(code)=>code===0?resolve(out):reject(new Error(err||out||`psql ${code}`)));stream.end(sql);})); }
async function waitService(conn, service, expected, timeoutMs=180000){const deadline=Date.now()+timeoutMs;while(Date.now()<deadline){const replicas=(await run(conn,`docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();if(replicas===`${expected}/${expected}`)return replicas;await new Promise(r=>setTimeout(r,2500));}throw new Error(`${service} did not reach ${expected}/${expected}`);}
function nodeByName(nodes,name){const node=nodes.find(item=>item?.name===name);assert.ok(node,`${name} not found`);return node;}

function patchPrepare(code) {
  let next = String(code || '');
  if (!next.includes(MARKER)) {
    const requestAnchor = `const implicitPhoneModelRequestV134 = !accessoryRequest && /\\b(?:note\\s*\\d{1,3}(?:\\s*(?:pro|plus|max|ultra|lite|neo|5g|4g|\\+))*)\\b/.test(implicitPhoneModelCandidateV134);`;
    assert.ok(next.includes(requestAnchor), 'implicit phone-model anchor not found');
    next = next.replace(requestAnchor, `${requestAnchor}
// ${MARKER}: M6 Pro, M7 Pro, X7 Pro and C71 are smartphone-model queries even without the word Poco.
const implicitPocoModelRequestV412 = !accessoryRequest
  && /\\b(?:poco\\s*)?(?:m|x|c)\\s*\\d{1,3}(?:\\s*(?:pro|plus|max|ultra|lite|neo|5g|4g|\\+))*/.test(implicitPhoneModelCandidateV134);`);
    const modelAnchor = `  || implicitPhoneModelRequestV134
  || implicitAlphanumericPhoneModelRequestV1`;
    assert.ok(next.includes(modelAnchor), 'specific-device model anchor not found');
    next = next.replace(modelAnchor, `  || implicitPhoneModelRequestV134
  || implicitPocoModelRequestV412
  || implicitAlphanumericPhoneModelRequestV1`);
  }
  new Function('$json', next);
  return next;
}

function patchContext(code) {
  let next = String(code || '');
  if (!next.includes(`${MARKER}:intro`)) {
    const anchor = `const fallbackCatalogIntroV1 = structuredFilterFallbackV1 && !suppressRepeatedCatalogV342 ? 'Nao encontrei um celular com todas essas caracteristicas no estoque atual. Vou te encaminhar o que temos hoje em estoque:' : '';`;
    assert.ok(next.includes(anchor), 'catalog fallback intro anchor not found');
    next = next.replace(anchor, `// ${MARKER}:intro
const fallbackCatalogIntroV1 = suppressRepeatedCatalogV342
  ? ''
  : (structuredFilterFallbackV1
    ? 'Nao encontrei um celular com todas essas caracteristicas no estoque atual. Vou te encaminhar o que temos hoje em estoque:'
    : (unavailableRequestedDevice
      ? 'Nao encontrei esse modelo no estoque atual. Vou te encaminhar o que temos hoje em estoque:'
      : ''));`);
  }
  new Function('$input', '$getWorkflowStaticData', '$', next);
  return next;
}

function patchWorkflow(nodes) {
  const patched = structuredClone(nodes);
  nodeByName(patched, 'Vendas - Preparar Busca').parameters.jsCode = patchPrepare(nodeByName(patched, 'Vendas - Preparar Busca').parameters.jsCode);
  nodeByName(patched, 'Vendas - Contexto Produtos').parameters.jsCode = patchContext(nodeByName(patched, 'Vendas - Contexto Produtos').parameters.jsCode);
  return patched;
}

function runPrepare(nodes, source) {
  const code = nodeByName(nodes, 'Vendas - Preparar Busca').parameters.jsCode;
  return vm.runInNewContext(`(function(){${code}})()`, { $json: source })[0].json;
}

async function runContext(nodes, prepared, products, fees) {
  const code = nodeByName(nodes, 'Vendas - Contexto Produtos').parameters.jsCode;
  const staticData = {};
  const selectors = {
    'Vendas - Preparar Busca': { first: () => ({ json: prepared }) },
    'Vendas - Buscar Produtos': { all: () => products.map((json) => ({ json })) },
    'switc Mensagens': { first: () => ({ json: prepared }) },
  };
  const result = vm.runInNewContext(`(function(){${code}})()`, {
    $input: { all: () => fees.map((json) => ({ json })) },
    $getWorkflowStaticData: () => staticData,
    $: (name) => selectors[name], Date, Intl,
  })[0].json;
  return { result, staticData };
}

async function runSelfTests(nodes) {
  const base = {
    intencao: 'vendas_produtos', salesRequestKind: 'busca', salesCategoryName: '', salesCategoryId: '',
    remoteJid: '557488097502@s.whatsapp.net', Instancia: 'mercado_do_vale', saudacaoDetectada: false,
  };
  const m6 = runPrepare(nodes, { ...base, conversation: 'Valor do m6pro', classificacaoMensagem: 'Valor do m6pro', salesSearchQuery: 'm6pro' });
  const m7 = runPrepare(nodes, { ...base, conversation: 'M7 pro', classificacaoMensagem: 'M7 pro', salesSearchQuery: 'M7 pro' });
  const accessory = runPrepare(nodes, { ...base, conversation: 'capa para M7 pro', classificacaoMensagem: 'capa para M7 pro', salesSearchQuery: 'capa para M7 pro' });
  assert.equal(m6.specificDeviceModelRequest, true); assert.equal(m6.productCategoryId, SMARTPHONES_CATEGORY_ID); assert.equal(m6.requestedDeviceModelQuery, 'm6pro'); assert.equal(m6.productSearchTerm, 'smartphones');
  assert.equal(m7.specificDeviceModelRequest, true); assert.equal(m7.productCategoryId, SMARTPHONES_CATEGORY_ID); assert.equal(m7.requestedDeviceModelQuery, 'M7 pro');
  assert.equal(accessory.accessoryRequest, true); assert.equal(accessory.specificDeviceModelRequest, false);

  const [productsResponse, feesResponse] = await Promise.all([
    fetch(`https://api.xiaomipetrolina.com.br/products?category=${SMARTPHONES_CATEGORY_ID}&status=active&compact=true&limit=500&sort_by=stock_quantity&sort_direction=desc`),
    fetch('https://api.xiaomipetrolina.com.br/payment-fees'),
  ]);
  assert.equal(productsResponse.ok, true, `products API ${productsResponse.status}`); assert.equal(feesResponse.ok, true, `fees API ${feesResponse.status}`);
  const products = await productsResponse.json(); const fees = await feesResponse.json();
  const missing = await runContext(nodes, m6, products, fees);
  assert.equal(missing.result.salesAvailabilityStatus, 'requested_model_not_confirmed_with_alternatives');
  assert.equal(missing.result.requiresSpecialistHandoff, false);
  assert.match(missing.result.deterministicCatalogOutput, /^Nao encontrei esse modelo no estoque atual\. Vou te encaminhar o que temos hoje em estoque:/);
  assert.ok((missing.staticData.salesPostList?.[m6.remoteJid]?.options || []).length > 0);
  const found = await runContext(nodes, m7, products, fees);
  assert.equal(found.result.salesAvailabilityStatus, 'confirmed_products_available');
  assert.equal(found.result.requiresSpecialistHandoff, false);
  assert.match(found.result.deterministicCatalogOutput, /Poco M7 Pr[oó] 5G/i);
  assert.match(found.result.deterministicCatalogOutput, /Cartão: 12x de/);
  return { bareM6UsesSmartphoneCatalog: true, unavailableModelSendsCurrentList: true, noAutomaticHandoff: true, m7ReturnsOfficialCard: true, accessoryGuardPreserved: true, catalogRows: products.length };
}

async function serviceMap(conn){const output=await run(conn,"docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");return Object.fromEntries(output.trim().split(/\r?\n/).filter(Boolean).map(line=>line.trim().split(/\s+/)));}

async function main(){
  const conn=new Client(); await new Promise((resolve,reject)=>conn.on('ready',resolve).on('error',reject).connect(getVpsSshConfig())); let stopped=false;
  try {
    const db=(await run(conn,"docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim(); assert.ok(db,'n8n database not found');
    const raw=await psql(conn,db,`COPY (SELECT json_build_object('nodesHex',encode(convert_to(we.nodes::text,'UTF8'),'hex'),'connectionsHex',encode(convert_to(we.connections::text,'UTF8'),'hex'),'activeVersionId',we."activeVersionId",'active',we.active,'versionAligned',we."versionId"=we."activeVersionId",'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb)::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const workflow=JSON.parse(raw.trim()); const originalNodes=JSON.parse(Buffer.from(workflow.nodesHex,'hex').toString('utf8')); const connections=JSON.parse(Buffer.from(workflow.connectionsHex,'hex').toString('utf8')); const patchedNodes=patchWorkflow(originalNodes); const changed=JSON.stringify(originalNodes)!==JSON.stringify(patchedNodes); const selfTest=await runSelfTests(patchedNodes);
    if(!APPLY){const services=await serviceMap(conn);console.log(JSON.stringify({apply:false,active:workflow.active,versionAligned:workflow.versionAligned,entityHistoryEqual:workflow.entityHistoryEqual,changed,selfTest,services},null,2));return;}
    assert.equal(workflow.active,true); assert.equal(workflow.versionAligned,true); assert.equal(workflow.entityHistoryEqual,true); assert.equal(changed,true,'workflow already patched');
    const activeExecutions=Number((await psql(conn,db,`COPY (SELECT count(*) FROM execution_entity WHERE "workflowId"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim()); assert.equal(activeExecutions,0,'workflow has active executions');
    const backupPath=path.join(os.tmpdir(),`n8n-workflow-${WORKFLOW_ID}-before-${MARKER}-${Date.now()}.json`); fs.writeFileSync(backupPath,JSON.stringify({workflowId:WORKFLOW_ID,activeVersionId:workflow.activeVersionId,nodes:originalNodes,connections},null,2),{flag:'wx'});
    await run(conn,'docker service scale n8n_n8n-runner=0 >/dev/null');await waitService(conn,'n8n_n8n-runner',0);await run(conn,'docker service scale n8n_n8n=0 >/dev/null');await waitService(conn,'n8n_n8n',0);stopped=true;
    const sql=`\\set ON_ERROR_STOP on
BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(patchedNodes),'nodes')}::json,connections=${dollar(JSON.stringify(connections),'connections')}::json,"versionId"="activeVersionId","updatedAt"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(patchedNodes),'hnodes')}::json,connections=${dollar(JSON.stringify(connections),'hconnections')}::json,"updatedAt"=NOW() WHERE "workflowId"=${quote(WORKFLOW_ID)} AND "versionId"=${quote(workflow.activeVersionId)};
COMMIT;
COPY (SELECT json_build_object('active',we.active,'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,'markerPresent',we.nodes::text LIKE '%${MARKER}%')::text FROM workflow_entity we JOIN workflow_history wh ON wh."workflowId"=we.id AND wh."versionId"=we."activeVersionId" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification=JSON.parse((await psql(conn,db,sql)).trim()); await run(conn,'docker service scale n8n_n8n=1 >/dev/null');await waitService(conn,'n8n_n8n',1);await run(conn,'docker service scale n8n_n8n-runner=1 >/dev/null');await waitService(conn,'n8n_n8n-runner',1);stopped=false; const services=await serviceMap(conn); console.log(JSON.stringify({apply:true,...verification,selfTest,backupPath,services},null,2));
  } finally { if(stopped){await run(conn,'docker service scale n8n_n8n=1 >/dev/null').catch(()=>{});await waitService(conn,'n8n_n8n',1).catch(()=>{});await run(conn,'docker service scale n8n_n8n-runner=1 >/dev/null').catch(()=>{});await waitService(conn,'n8n_n8n-runner',1).catch(()=>{});} conn.end(); }
}

module.exports={MARKER,patchPrepare,patchContext,patchWorkflow,runSelfTests};
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exit(1);});

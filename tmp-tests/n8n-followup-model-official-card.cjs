const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getVpsSshConfig } = require('./vps-ssh-config.cjs');

const WORKFLOW_ID = 'SkrkB4vyKVDnQ68t';
const APPLY = process.argv.includes('--apply');
const MARKER = 'followup-model-official-card-v367';
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function quote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function dollar(value, tag) { if (String(value).includes(`$${tag}$`)) throw new Error(`Dollar quote collision: ${tag}`); return `$${tag}$${value}$${tag}$`; }
function run(conn, command) { return new Promise((resolve, reject) => conn.exec(command, (error, stream) => { if (error) return reject(error); let out=''; let err=''; stream.on('data',(c)=>out+=c); stream.stderr.on('data',(c)=>err+=c); stream.on('close',(code)=>code===0?resolve(out):reject(new Error(err||out||`remote ${code}`))); })); }
function psql(conn, db, sql) { return new Promise((resolve,reject)=>conn.exec(`docker exec -i ${quote(db)} psql -U postgres -d n8n -X -q -t -A -v ON_ERROR_STOP=1`,(error,stream)=>{if(error)return reject(error);let out='';let err='';stream.on('data',(c)=>out+=c);stream.stderr.on('data',(c)=>err+=c);stream.on('close',(code)=>code===0?resolve(out):reject(new Error(err||out||`psql ${code}`)));stream.end(sql);})); }
async function waitService(conn, service, expected, timeoutMs=180000){const deadline=Date.now()+timeoutMs;while(Date.now()<deadline){const replicas=(await run(conn,`docker service ls --filter name=${quote(service)} --format '{{.Replicas}}' | head -n 1`)).trim();if(replicas===`${expected}/${expected}`)return replicas;await new Promise(r=>setTimeout(r,2500));}throw new Error(`${service} did not reach ${expected}/${expected}`);}
function nodeByName(nodes,name){const node=nodes.find(item=>item?.name===name);assert.ok(node,`${name} not found`);return node;}

const ROUTE_BLOCK = `// ${MARKER}: route a named-model information follow-up through the official catalog formatter.
const namedModelInfoFollowupV367 = aiAction === 'pedir_ficha'
  && Boolean(String(source.salesSearchQuery || '').trim())
  && (!activeState || !Array.isArray(activeState.options) || activeState.options.length === 0);
if (namedModelInfoFollowupV367) return buildContinueItem();

`;

function patchWorkflow(nodes) {
  const patched = structuredClone(nodes);
  const node = nodeByName(patched, 'Vendas - Verificar Pos Lista');
  let code = String(node.parameters?.jsCode || '');
  if (!code.includes(MARKER)) {
    const anchor = `if (!activeState || !Array.isArray(activeState.options) || activeState.options.length === 0) {`;
    assert.ok(code.includes(anchor), 'post-list missing-state anchor not found');
    code = code.replace(anchor, ROUTE_BLOCK + anchor);
  }
  new AsyncFunction('$json', '$input', '$getWorkflowStaticData', '$', '$env', 'helpers', 'fetch', code);
  node.parameters.jsCode = code;
  return patched;
}

async function runSelfTest(nodes) {
  const code = nodeByName(nodes, 'Vendas - Verificar Pos Lista').parameters.jsCode;
  const source = {
    remoteJid: '557491378636@s.whatsapp.net',
    conversation: 'Me envia também do Poco M7 Pró 5g',
    incomingText: 'Me envia também do Poco M7 Pró 5g',
    intencao: 'vendas_produtos',
    salesFlowAction: 'pedir_ficha',
    salesSearchQuery: 'Poco M7 Pró 5G',
    saudacaoDetectada: false,
  };
  const staticData = { salesPostList: {} };
  const selectors = { 'Parse Classificacao': { first: () => ({ json: source }) } };
  let apiCalled = false;
  const result = await new AsyncFunction('$json','$input','$getWorkflowStaticData','$','$env','helpers','fetch',code)(
    {}, { all: () => [] }, () => staticData, (name) => selectors[name] || { first: () => ({ json: {} }), all: () => [] }, {},
    { httpRequest: async () => { apiCalled = true; throw new Error('recovery API must not run'); } },
    async () => { apiCalled = true; throw new Error('recovery fetch must not run'); },
  );
  const output = result[0].json;
  assert.equal(output.salesPostListHandled, false);
  assert.equal(output.salesSearchQuery, 'Poco M7 Pró 5G');
  assert.equal(output.messages, undefined);
  assert.equal(output.output, undefined);
  assert.equal(apiCalled, false);
  return { routedToOfficialCatalog: true, queryPreserved: true, abbreviatedRecoverySkipped: true, extraProductImageSkipped: true };
}

async function serviceMap(conn){const output=await run(conn,"docker service ls --filter name=n8n --format '{{.Name}} {{.Replicas}}'");return Object.fromEntries(output.trim().split(/\r?\n/).filter(Boolean).map(line=>line.trim().split(/\s+/)));}

async function main(){
  const {Client}=require('ssh2');const conn=new Client();
  await new Promise((resolve,reject)=>conn.on('ready',resolve).on('error',reject).connect(getVpsSshConfig()));
  let stopped=false;
  try{
    const db=(await run(conn,"docker ps --filter 'name=n8n_n8n-db' --format '{{.Names}}' | head -n 1")).trim();assert.ok(db,'n8n database not found');
    const raw=await psql(conn,db,`COPY (SELECT json_build_object('nodesHex',encode(convert_to(we.nodes::text,'UTF8'),'hex'),'connectionsHex',encode(convert_to(we.connections::text,'UTF8'),'hex'),'activeVersionId',we.\"activeVersionId\",'active',we.active,'versionAligned',we.\"versionId\"=we.\"activeVersionId\",'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb)::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`);
    const workflow=JSON.parse(raw.trim());const originalNodes=JSON.parse(Buffer.from(workflow.nodesHex,'hex').toString('utf8'));const connections=JSON.parse(Buffer.from(workflow.connectionsHex,'hex').toString('utf8'));const patchedNodes=patchWorkflow(originalNodes);const changed=JSON.stringify(originalNodes)!==JSON.stringify(patchedNodes);const selfTest=await runSelfTest(patchedNodes);
    if(!APPLY){const services=await serviceMap(conn);return console.log(JSON.stringify({apply:false,active:workflow.active,versionAligned:workflow.versionAligned,entityHistoryEqual:workflow.entityHistoryEqual,changed,codeCompiles:true,selfTest,services:{n8n:services.n8n_n8n,runner:services['n8n_n8n-runner'],evolution:services['n8n_evolution-api']}},null,2));}
    assert.equal(workflow.active,true);assert.equal(workflow.versionAligned,true);assert.equal(workflow.entityHistoryEqual,true);assert.equal(changed,true,'workflow already patched');
    const activeExecutions=Number((await psql(conn,db,`COPY (SELECT count(*) FROM execution_entity WHERE \"workflowId\"=${quote(WORKFLOW_ID)} AND status IN ('new','running')) TO STDOUT;`)).trim());assert.equal(activeExecutions,0,'workflow has active executions');
    const backupPath=path.join(os.tmpdir(),`n8n-workflow-${WORKFLOW_ID}-before-${MARKER}-${Date.now()}.json`);fs.writeFileSync(backupPath,JSON.stringify({workflowId:WORKFLOW_ID,activeVersionId:workflow.activeVersionId,nodes:originalNodes,connections},null,2),{flag:'wx'});
    await run(conn,'docker service scale n8n_n8n-runner=0 >/dev/null');await waitService(conn,'n8n_n8n-runner',0);await run(conn,'docker service scale n8n_n8n=0 >/dev/null');await waitService(conn,'n8n_n8n',0);stopped=true;
    const sql=`\\set ON_ERROR_STOP on
BEGIN;
UPDATE workflow_entity SET nodes=${dollar(JSON.stringify(patchedNodes),'nodes')}::json,connections=${dollar(JSON.stringify(connections),'connections')}::json,\"versionId\"=\"activeVersionId\",\"updatedAt\"=NOW() WHERE id=${quote(WORKFLOW_ID)};
UPDATE workflow_history SET nodes=${dollar(JSON.stringify(patchedNodes),'hnodes')}::json,connections=${dollar(JSON.stringify(connections),'hconnections')}::json,\"updatedAt\"=NOW() WHERE \"workflowId\"=${quote(WORKFLOW_ID)} AND \"versionId\"=${quote(workflow.activeVersionId)};
COMMIT;
COPY (SELECT json_build_object('active',we.active,'entityHistoryEqual',we.nodes::jsonb=wh.nodes::jsonb AND we.connections::jsonb=wh.connections::jsonb,'markerPresent',we.nodes::text LIKE '%${MARKER}%')::text FROM workflow_entity we JOIN workflow_history wh ON wh.\"workflowId\"=we.id AND wh.\"versionId\"=we.\"activeVersionId\" WHERE we.id=${quote(WORKFLOW_ID)}) TO STDOUT;`;
    const verification=JSON.parse((await psql(conn,db,sql)).trim());await run(conn,'docker service scale n8n_n8n=1 >/dev/null');await waitService(conn,'n8n_n8n',1);await run(conn,'docker service scale n8n_n8n-runner=1 >/dev/null');await waitService(conn,'n8n_n8n-runner',1);stopped=false;const services=await serviceMap(conn);console.log(JSON.stringify({apply:true,...verification,selfTest,backupPath,services:{n8n:services.n8n_n8n,runner:services['n8n_n8n-runner'],evolution:services['n8n_evolution-api']}},null,2));
  }finally{if(stopped){await run(conn,'docker service scale n8n_n8n=1 >/dev/null').catch(()=>{});await waitService(conn,'n8n_n8n',1).catch(()=>{});await run(conn,'docker service scale n8n_n8n-runner=1 >/dev/null').catch(()=>{});await waitService(conn,'n8n_n8n-runner',1).catch(()=>{});}conn.end();}
}

module.exports={MARKER,ROUTE_BLOCK,patchWorkflow,runSelfTest};
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
